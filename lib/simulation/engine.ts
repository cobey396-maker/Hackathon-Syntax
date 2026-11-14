// The simulation engine: one pure reducer that owns every state change.
// UI components dispatch Actions; they never edit incident status strings directly.
// Invalid actions leave the state untouched except for `lastError`.
import { detect } from "./detector.ts";
import { applyVirtualRule, emptyFirewall, evaluatePacket, isolatedPolicy, quarantineSession, releaseQuarantine, rollbackVirtualRule } from "./firewall.ts";
import { analyze, replay } from "./honeypot.ts";
import { propose } from "./proposals.ts";
import { CONTROL_TRAFFIC, scenario } from "./scenarios.ts";
import type { Action, AuditEvent, Incident, IncidentStatus, Packet, SimState } from "./types.ts";
import { compare, controlPacket } from "./verification.ts";

/** Allowed lifecycle moves. Anything not listed is rejected. */
export const TRANSITIONS: Record<IncidentStatus, IncidentStatus[]> = {
  DETECTED: ["CONTAINED"],
  CONTAINED: ["SIMULATED"],
  SIMULATED: ["ANALYZED"],
  ANALYZED: ["PROPOSED", "INCONCLUSIVE", "BENIGN"],
  PROPOSED: ["AWAITING_REVIEW"],
  AWAITING_REVIEW: ["ENFORCED", "REJECTED"],
  ENFORCED: ["VERIFIED", "VERIFY_FAILED"],
  VERIFY_FAILED: ["ROLLED_BACK", "ROLLBACK_FAILED"],
  VERIFIED: [],
  BENIGN: [],
  INCONCLUSIVE: [],
  REJECTED: [],
  ROLLED_BACK: [],
  ROLLBACK_FAILED: [],
};

export const canTransition = (from: IncidentStatus, to: IncidentStatus) => TRANSITIONS[from].includes(to);

export const SIM_EPOCH = Date.UTC(2026, 10, 14, 15, 0, 0); // fixed start so timestamps are reproducible
export const tickToIso = (tick: number) => new Date(SIM_EPOCH + tick * 1000).toISOString();

export const initialState = (): SimState => ({
  tick: 0,
  packets: {},
  traffic: [],
  incidents: [],
  firewall: emptyFirewall(),
  events: [],
  seq: { packet: 0, incident: 0, rule: 0, event: 0 },
  lastError: null,
});

const pad = (n: number) => String(n).padStart(4, "0");

/** History limits so a long-running live demo stays fast. Incidents and their events are never dropped. */
export const MAX_TRAFFIC = 200;
export const MAX_ROUTINE_EVENTS = 200;

class SimError extends Error {}
const fail = (msg: string): never => {
  throw new SimError(msg);
};

// ── small mutable draft helpers (used on a shallow copy inside reduce) ───────────────────
type Draft = SimState;

function log(s: Draft, e: Omit<AuditEvent, "id" | "tick">) {
  s.seq = { ...s.seq, event: s.seq.event + 1 };
  s.events = [{ ...e, id: `EVT-${pad(s.seq.event)}`, tick: s.tick }, ...s.events];
  // Live traffic produces many routine entries; keep every incident event but only recent routine ones.
  if (s.events.length > MAX_ROUTINE_EVENTS * 2) {
    let routine = 0;
    s.events = s.events.filter((x) => x.incidentId !== null || ++routine <= MAX_ROUTINE_EVENTS);
  }
}

function getIncident(s: Draft, id: string): Incident {
  return s.incidents.find((i) => i.id === id) ?? fail(`incident ${id} not found`);
}

function update(s: Draft, id: string, patch: Partial<Incident>) {
  s.incidents = s.incidents.map((i) => (i.id === id ? { ...i, ...patch, updatedTick: s.tick } : i));
}

/** Moves an incident to `to` if the table allows it, and records the audit event. */
function move(s: Draft, inc: Incident, to: IncidentStatus, ev: Omit<AuditEvent, "id" | "tick" | "from" | "to" | "incidentId">, patch: Partial<Incident> = {}) {
  if (!canTransition(inc.status, to)) fail(`invalid transition ${inc.status} → ${to} for ${inc.id}`);
  update(s, inc.id, { ...patch, status: to });
  log(s, { ...ev, incidentId: inc.id, from: inc.status, to });
}

const packetOf = (s: Draft, inc: Incident): Packet => s.packets[inc.packetId];

function setContainment(s: Draft, inc: Incident, mode: "QUARANTINED" | "RELEASED", actor: string, why: string) {
  const ip = packetOf(s, inc).srcIp;
  s.firewall = mode === "QUARANTINED" ? quarantineSession(ip, s.firewall) : releaseQuarantine(ip, s.firewall);
  update(s, inc.id, { containment: mode });
  if (mode === "RELEASED") log(s, { incidentId: inc.id, type: "QUARANTINE_RELEASED", from: null, to: null, actor, outcome: "ok", summary: `${ip} released from temporary containment: ${why}` });
}

const NEXT: Partial<Record<IncidentStatus, Action["type"]>> = {
  DETECTED: "CONTAIN",
  CONTAINED: "SIMULATE",
  SIMULATED: "ANALYZE",
  ANALYZED: "CLASSIFY",
  PROPOSED: "REQUEST_REVIEW",
  ENFORCED: "VERIFY",
  VERIFY_FAILED: "ROLLBACK",
};

/** Next automatic action for an incident, or null if it needs a human or is finished. */
export function nextAutoAction(inc: Incident): Action | null {
  const t = NEXT[inc.status];
  return t ? ({ type: t, incidentId: inc.id } as Action) : null;
}

function apply(s: Draft, a: Action) {
  switch (a.type) {
    case "RESET": {
      Object.assign(s, initialState());
      return;
    }

    case "TICK": {
      s.tick += a.by ?? 1;
      const expired = s.firewall.rules.filter((r) => r.expiresAtTick !== undefined && s.tick >= r.expiresAtTick);
      if (expired.length) {
        s.firewall = { ...s.firewall, rules: s.firewall.rules.filter((r) => !expired.includes(r)) };
        for (const r of expired) log(s, { incidentId: null, type: "RULE_EXPIRED", from: null, to: null, actor: "system", outcome: "ok", summary: `${r.id} reached its expiry and was removed` });
      }
      return;
    }

    case "INGEST": {
      s.tick += 1;
      s.seq = { ...s.seq, packet: s.seq.packet + 1 };
      const p: Packet = { ...a.packet, id: `PKT-${pad(s.seq.packet)}`, tick: s.tick };
      s.packets = { ...s.packets, [p.id]: p };

      // Policy first: traffic the virtual firewall already blocks never reaches the parser.
      const fw = evaluatePacket(p, s.firewall, s.tick);
      if (fw.verdict === "BLOCK") {
        s.traffic = [{ packetId: p.id, tick: s.tick, verdict: "BLOCKED" as const, detail: `${fw.matchedRule}: ${fw.reason}`, incidentId: null }, ...s.traffic].slice(0, MAX_TRAFFIC);
        log(s, { incidentId: null, type: "TRAFFIC_BLOCKED", from: null, to: null, actor: "system", outcome: "ok", summary: `${p.id} from ${p.srcIp} blocked by ${fw.matchedRule}` });
        return;
      }

      const d = detect(p);
      if (!d.suspicious) {
        s.traffic = [{ packetId: p.id, tick: s.tick, verdict: "ALLOWED" as const, detail: "classified BENIGN: all checks passed", incidentId: null }, ...s.traffic].slice(0, MAX_TRAFFIC);
        log(s, { incidentId: null, type: "TRAFFIC_ALLOWED", from: null, to: null, actor: "system", outcome: "ok", summary: `${p.id} from ${p.srcIp} classified BENIGN, allowed` });
        return;
      }

      s.seq = { ...s.seq, incident: s.seq.incident + 1 };
      const inc: Incident = {
        id: `INC-${pad(s.seq.incident)}`,
        packetId: p.id,
        scenarioId: a.scenarioId ?? null,
        status: "DETECTED",
        containment: "NONE",
        detection: d,
        createdTick: s.tick,
        updatedTick: s.tick,
      };
      s.incidents = [inc, ...s.incidents];
      s.traffic = [{ packetId: p.id, tick: s.tick, verdict: "FLAGGED" as const, detail: d.summary, incidentId: inc.id }, ...s.traffic].slice(0, MAX_TRAFFIC);
      log(s, { incidentId: inc.id, type: "DETECTED", from: null, to: "DETECTED", actor: "system", outcome: "warn", summary: `${p.id} from ${p.srcIp}: ${d.summary}` });
      return;
    }

    case "CONTAIN": {
      const inc = getIncident(s, a.incidentId);
      const ip = packetOf(s, inc).srcIp;
      move(s, inc, "CONTAINED", { type: "CONTAINED", actor: "system", outcome: "ok", summary: `${ip} placed under temporary containment pending investigation` });
      setContainment(s, inc, "QUARANTINED", "system", "");
      return;
    }

    case "SIMULATE": {
      const inc = getIncident(s, a.incidentId);
      const e = replay(packetOf(s, inc));
      move(s, inc, "SIMULATED", { type: "SIMULATED", actor: "system", outcome: e.crashed ? "warn" : "ok", summary: `Honeypot replay outcome: ${e.outcome}` }, { evidence: e });
      return;
    }

    case "ANALYZE": {
      const inc = getIncident(s, a.incidentId);
      if (!inc.evidence) fail(`${inc.id} has no simulation evidence`);
      const an = analyze(inc.detection, inc.evidence!);
      move(s, inc, "ANALYZED", { type: "ANALYZED", actor: "system", outcome: an.conclusion === "malicious" ? "warn" : "ok", summary: `Conclusion: ${an.conclusion}. ${an.rationale}` }, { analysis: an });
      return;
    }

    case "CLASSIFY": {
      const inc = getIncident(s, a.incidentId);
      if (!inc.analysis) fail(`${inc.id} has not been analyzed`);
      const c = inc.analysis!.conclusion;
      if (c === "benign") {
        move(s, inc, "BENIGN", { type: "CLASSIFIED", actor: "system", outcome: "ok", summary: "Classified BENIGN; no patch proposed" });
        setContainment(s, getIncident(s, inc.id), "RELEASED", "system", "classified benign");
        return;
      }
      if (c === "inconclusive") {
        move(s, inc, "INCONCLUSIVE", { type: "CLASSIFIED", actor: "system", outcome: "warn", summary: "Evidence insufficient for a persistent rule; held for further investigation" });
        return;
      }
      s.seq = { ...s.seq, rule: s.seq.rule + 1 };
      const p = packetOf(s, inc);
      const prop = propose(p, inc.detection, `VP-${pad(s.seq.rule)}`, s.firewall, s.tick, inc.scenarioId ? scenario(inc.scenarioId)?.ruleOverride : undefined);
      move(
        s,
        inc,
        "PROPOSED",
        {
          type: "PROPOSED",
          actor: "system",
          outcome: prop.safe ? "ok" : "fail",
          summary: `${prop.rule.id}: drop ${prop.scope}. Pre-deployment test ${prop.safe ? "passed" : `FAILED (${prop.preCheck.blockedLegit} legitimate case(s) blocked)`}`,
        },
        { proposal: prop },
      );
      return;
    }

    case "REQUEST_REVIEW": {
      const inc = getIncident(s, a.incidentId);
      move(s, inc, "AWAITING_REVIEW", { type: "REVIEW_REQUESTED", actor: "system", outcome: inc.proposal?.safe ? "ok" : "warn", summary: inc.proposal?.safe ? "Awaiting human approval" : "Awaiting human review; proposal is marked UNSAFE and cannot be deployed" });
      return;
    }

    case "APPROVE": {
      const inc = getIncident(s, a.incidentId);
      if (inc.status !== "AWAITING_REVIEW") fail(`${inc.id} is ${inc.status}, not awaiting review`);
      const prop = inc.proposal ?? fail(`${inc.id} has no proposal`);
      if (!prop.safe) fail(`${prop.rule.id} failed its pre-deployment test and cannot be deployed`);
      s.firewall = applyVirtualRule(prop.rule, s.firewall);
      log(s, { incidentId: inc.id, type: "APPROVED", from: null, to: null, actor: a.actor, outcome: "ok", summary: `${a.actor} approved ${prop.rule.id}` });
      move(s, inc, "ENFORCED", { type: "DEPLOYED", actor: "system", outcome: "ok", summary: `${prop.rule.id} installed in the virtual firewall` }, { decidedBy: a.actor });
      return;
    }

    case "REJECT": {
      const inc = getIncident(s, a.incidentId);
      move(
        s,
        inc,
        "REJECTED",
        { type: "REJECTED", actor: a.actor, outcome: "ok", summary: `${a.actor} rejected ${inc.proposal?.rule.id ?? "the proposal"}; not installed. Containment unchanged (${inc.containment}).` },
        { decidedBy: a.actor },
      );
      return;
    }

    case "VERIFY": {
      const inc = getIncident(s, a.incidentId);
      const prop = inc.proposal ?? fail(`${inc.id} has no proposal`);
      if (!s.firewall.rules.some((r) => r.id === prop.rule.id)) fail(`${prop.rule.id} is not installed`);
      // Before: live policy without this rule. After: live policy as deployed. Neither includes quarantines.
      const after = isolatedPolicy(s.firewall);
      const before = { ...after, rules: after.rules.filter((r) => r.id !== prop.rule.id) };
      const v = compare(packetOf(s, inc), before, after, CONTROL_TRAFFIC, s.tick);
      if (v.passed) {
        move(s, inc, "VERIFIED", { type: "VERIFIED", actor: "system", outcome: "ok", summary: `Target blocked; ${CONTROL_TRAFFIC.length}/${CONTROL_TRAFFIC.length} legitimate cases still allowed` }, { verification: v });
        setContainment(s, getIncident(s, inc.id), "RELEASED", "system", `replaced by verified rule ${prop.rule.id}`);
      } else {
        const why = !v.targetBlocked ? "target not blocked" : `${v.blockedLegit} legitimate case(s) blocked`;
        move(s, inc, "VERIFY_FAILED", { type: "VERIFY_FAILED", actor: "system", outcome: "fail", summary: `Post-deployment verification failed: ${why}` }, { verification: v });
      }
      return;
    }

    case "ROLLBACK": {
      const inc = getIncident(s, a.incidentId);
      if (inc.status !== "VERIFY_FAILED") fail(`${inc.id} is ${inc.status}; rollback only follows a failed verification`);
      const ruleId = inc.proposal!.rule.id;
      const r = rollbackVirtualRule(ruleId, s.firewall);
      const policy = isolatedPolicy(r.fw);
      const controls = CONTROL_TRAFFIC.map((c, i) => {
        const p = controlPacket(c, i);
        const res = evaluatePacket(p, policy, s.tick);
        return { packetId: p.id, label: c.label, expect: "ALLOW" as const, before: res, after: res, pass: res.verdict === "ALLOW" };
      });
      const restored = r.restored && controls.every((c) => c.pass) && !r.fw.rules.some((x) => x.id === ruleId);
      if (restored) s.firewall = r.fw;
      move(
        s,
        inc,
        restored ? "ROLLED_BACK" : "ROLLBACK_FAILED",
        { type: restored ? "ROLLED_BACK" : "ROLLBACK_FAILED", actor: "system", outcome: restored ? "warn" : "fail", summary: restored ? `${ruleId} removed; previous policy restored and legitimate traffic re-verified` : `Could not restore the previous policy for ${ruleId}` },
        { rollback: { restored, controls } },
      );
      return;
    }

    case "RELEASE": {
      const inc = getIncident(s, a.incidentId);
      if (inc.containment !== "QUARANTINED") fail(`${inc.id} is not under containment`);
      setContainment(s, inc, "RELEASED", a.actor, "released by analyst");
      return;
    }

    case "ADVANCE": {
      const inc = getIncident(s, a.incidentId);
      if (inc.status === "AWAITING_REVIEW") fail(`${inc.id} is waiting for a human decision`);
      const next = nextAutoAction(inc) ?? fail(`${inc.id} is ${inc.status}; no further automatic steps`);
      apply(s, next);
      return;
    }
  }
}

/** Pure reducer: returns a new state; on an invalid action, the old state plus `lastError`. */
export function reduce(state: SimState, action: Action): SimState {
  const draft: Draft = { ...state, lastError: null };
  try {
    apply(draft, action);
    return draft;
  } catch (e) {
    if (e instanceof SimError || e instanceof Error) return { ...state, lastError: e.message };
    throw e;
  }
}

/** Runs automatic steps until the incident needs a human or reaches a final state. */
export function runToPause(state: SimState, incidentId: string): SimState {
  let s = state;
  for (let guard = 0; guard < 20; guard++) {
    const inc = s.incidents.find((i) => i.id === incidentId);
    if (!inc || !nextAutoAction(inc)) return s;
    s = reduce(s, { type: "ADVANCE", incidentId });
    if (s.lastError) return s;
  }
  return s;
}
