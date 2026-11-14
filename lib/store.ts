// In-memory store. Lives on globalThis so dev hot-reload keeps the data.
// Swap for Supabase later (see lib/supabase.ts).
import { listLedger, recordDecision, resetLedgerView } from "./audit";
import { inspect, timings, type Baseline, type Rule } from "./detector";
import { errorNote, GRADER_MODEL, graderEnabled, gradeWithClaude } from "./grader";
import type { DashboardState, Decision, DeployedPatch, PlanLine, RawPacket, SandboxItem, Stats, TrafficEvent } from "./types";

export const CRITICAL = 7; // severity at or above this arms the Critical Response Protocol
const SLA_MS = 5 * 60_000;
// Auto-quarantine is proportionate: it lapses after 15 minutes unless an analyst confirms it,
// so an AI false positive can't block a source indefinitely with no human involved.
export const QUARANTINE_MS = 15 * 60_000;

type Store = {
  items: SandboxItem[];
  traffic: TrafficEvent[];
  recentLegit: RawPacket[]; // baseline + false-positive check window
  drafts: Record<string, { rules: Rule[]; plan: (ruleId: string, severity: number) => PlanLine[] }>; // itemId -> server-side draft
  deployed: (DeployedPatch & { rules: Rule[] })[]; // live at the edge
  stats: Stats;
  totalMs: number;
  lastEventAt: number;
  seq: number;
  lastAttack: RawPacket | null; // last packet the AI held, for the r replay
  tierIdx: number; // z hotkey rotates mild -> moderate -> critical
};

const fresh = (): Store => ({
  items: [],
  traffic: [],
  recentLegit: [],
  drafts: {},
  deployed: [],
  stats: { seen: 0, legit: 0, sandboxed: 0, patched: 0, allowed: 0, crashesPrevented: 0, blockedAtEdge: 0, avgVerdictMs: 0 },
  totalMs: 0,
  lastEventAt: 0,
  seq: 0,
  lastAttack: null,
  tierIdx: 0,
});

const g = globalThis as unknown as { __vpsStore8?: Store };
const store: Store = (g.__vpsStore8 ??= fresh());

// Demo reset: empty queue, patches, traffic and counters. Keeps the simulator "online" state.
export async function reset() {
  const lastEventAt = store.lastEventAt;
  Object.assign(store, fresh(), { lastEventAt });
  await resetLedgerView();
}

function baseline(): Baseline {
  const xs = store.recentLegit.map((p) => p.declared_len);
  const n = xs.length;
  if (n < 5) return { mean: 0, std: 0, n };
  const mean = xs.reduce((a, b) => a + b, 0) / n;
  const std = Math.sqrt(xs.reduce((a, b) => a + (b - mean) ** 2, 0) / n);
  return { mean, std, n };
}

function pushTraffic(e: TrafficEvent) {
  store.traffic.unshift(e);
  store.traffic.length = Math.min(store.traffic.length, 50);
}

// Approved virtual patches run first: a match is refused at the edge without reaching the AI or the firewall.
function enforce(p: RawPacket) {
  const patch = store.deployed.find((d) => (d.srcBlocked && d.srcIp === p.src_ip) || d.rules.some((r) => r.test(p)));
  if (!patch) return null;
  patch.hits++;
  patch.lastHit = p.ts;
  store.stats.blockedAtEdge++;
  pushTraffic({ seq: store.stats.seen, ts: p.ts, srcIp: p.src_ip, user: p.user, protocol: p.protocol, verdict: "blocked", severity: 0, verdictMs: 0.04, ruleId: patch.ruleId });
  return patch;
}

export type IngestResult = { blocked: DeployedPatch } | { item: SandboxItem; packet: RawPacket } | null;

// Lift any auto-quarantine whose 15 minutes ran out without an analyst confirming it.
function expireQuarantines(now = Date.now()) {
  store.deployed = store.deployed.filter((d) => {
    if (d.kind !== "quarantine" || !d.expiresAt || Date.parse(d.expiresAt) > now) return true;
    const item = store.items.find((i) => i.id === d.itemId);
    if (item?.crp && !item.crp.quarantineLifted) {
      item.crp.quarantineLifted = d.expiresAt;
      item.crp.liftReason = "expired";
      item.crp.quarantineExpires = null;
    }
    return false;
  });
}

export function ingest(p: RawPacket): IngestResult {
  expireQuarantines();
  store.stats.seen++;
  store.lastEventAt = Date.now();
  const patch = enforce(p);
  if (patch) return { blocked: patch };

  const t = timings(p);
  store.totalMs += t.totalMs;
  store.stats.avgVerdictMs = +(store.totalMs / (store.stats.seen - store.stats.blockedAtEdge)).toFixed(2);
  const v = inspect(p, baseline());

  pushTraffic({
    seq: store.stats.seen,
    ts: p.ts,
    srcIp: p.src_ip,
    user: p.user,
    protocol: p.protocol,
    verdict: v ? "sandboxed" : "allowed",
    severity: v?.severity ?? 0,
    verdictMs: t.totalMs,
  });

  if (!v) {
    store.stats.legit++;
    store.recentLegit.unshift(p);
    store.recentLegit.length = Math.min(store.recentLegit.length, 300);
    return null;
  }

  const n = ++store.seq;
  const ruleId = `VP-${String(n).padStart(4, "0")}`;
  const item: SandboxItem = {
    id: `SBX-${String(n).padStart(4, "0")}`,
    ruleId,
    ts: p.ts,
    srcIp: p.src_ip,
    user: p.user,
    protocol: p.protocol,
    severity: v.severity,
    confidence: v.confidence,
    checks: v.checks,
    bytes: v.bytes,
    timings: t,
    honeypot: v.honeypot,
    crashes: v.crashes,
    plan: v.plan(ruleId, v.severity),
    // Would the new shield rules have blocked any recent legitimate session?
    impact: {
      matched: store.recentLegit.filter((q) => v.rules.some((r) => r.test(q))).length,
      window: store.recentLegit.length,
    },
    status: "pending",
    ai: {
      engine: graderEnabled() ? "claude" : "rules",
      status: graderEnabled() ? "grading" : "done",
      model: graderEnabled() ? GRADER_MODEL : null,
      ms: null,
      ruleSeverity: v.severity,
      attackClass: v.attackClass,
      rationale: `${v.checks.filter((c) => !c.ok && c.kind === "parser").map((c) => c.field).join(", ") || "handshake"} malformed; honeypot ${v.crashes ? "crashed the parser" : "showed a fault without a crash"}.`,
      riskFactors: v.checks.filter((c) => !c.ok).map((c) => c.field),
      note: graderEnabled() ? null : "rules engine only (no ANTHROPIC_API_KEY)",
    },
    crp: null,
  };
  store.items.unshift(item);
  store.items.length = Math.min(store.items.length, 200);
  store.drafts[item.id] = { rules: v.rules, plan: v.plan };
  store.lastAttack = p;
  store.stats.sandboxed++;
  if (v.crashes) store.stats.crashesPrevented++;
  if (!graderEnabled()) armProtocol(item);
  return { item, packet: p };
}

// Claude grades the held packet after the response is sent (route handlers call this via after()).
export async function gradeItem(id: string, p: RawPacket) {
  const item = store.items.find((i) => i.id === id);
  if (!item || item.ai.status !== "grading") return;
  const t0 = Date.now();
  try {
    const g = await gradeWithClaude(p, item.checks, item.crashes);
    item.severity = g.severity;
    item.confidence = g.confidence;
    item.ai = { ...item.ai, status: "done", ms: Date.now() - t0, attackClass: g.attack_class, rationale: g.rationale, riskFactors: g.risk_factors };
    const d = store.drafts[id];
    if (d) item.plan = d.plan(item.ruleId, item.severity);
  } catch (e) {
    console.error(`[grader] ${id}:`, e);
    item.ai = { ...item.ai, engine: "rules", status: "done", ms: Date.now() - t0, note: `${errorNote(e)}; rules score kept` };
  }
  armProtocol(item);
}

// Critical Response Protocol: quarantine the source at the edge right away, start the 5-minute
// SLA, and require two analysts to sign any decision.
function armProtocol(item: SandboxItem) {
  if (item.severity < CRITICAL || item.crp || item.status !== "pending") return;
  const now = new Date();
  const expires = new Date(now.getTime() + QUARANTINE_MS).toISOString();
  item.crp = {
    quarantinedAt: now.toISOString(),
    quarantineLifted: null,
    liftReason: null,
    quarantineExpires: expires,
    confirmedBy: null,
    slaDeadline: new Date(now.getTime() + SLA_MS).toISOString(),
    signoffs: [],
  };
  store.deployed.unshift({
    kind: "quarantine",
    ruleId: item.ruleId.replace("VP-", "QRN-"),
    itemId: item.id,
    conds: [],
    rules: [],
    srcIp: item.srcIp,
    srcBlocked: true,
    analyst: "AI Shield (auto)",
    deployedAt: now.toISOString(),
    expiresAt: expires,
    hits: 0,
    lastHit: null,
  });
}

export type DecideResult = { ok: true; final: boolean } | { ok: false; status: number; error: string };

export async function decide(id: string, action: Decision, analyst: string): Promise<DecideResult> {
  const item = store.items.find((i) => i.id === id);
  if (!item || item.status !== "pending") return { ok: false, status: 409, error: "not found or already decided" };
  if (item.ai.status === "grading") return { ok: false, status: 409, error: "Claude is still grading this packet" };

  let signedBy = analyst;
  if (item.crp) {
    // Two-person rule: the first signature waits for a different analyst to sign the same action.
    const first = item.crp.signoffs[0];
    if (!first || first.action !== action) {
      item.crp.signoffs = [{ analyst, action, ts: new Date().toISOString() }];
      // A human signing "approve" confirms the auto-quarantine: it stops expiring and holds until co-sign.
      const q = store.deployed.find((d) => d.kind === "quarantine" && d.itemId === item.id);
      if (action === "approve" && q) {
        q.expiresAt = null;
        q.analyst = `AI Shield · confirmed by ${analyst}`;
        item.crp.quarantineExpires = null;
        item.crp.confirmedBy = analyst;
      }
      return { ok: true, final: false };
    }
    if (first.analyst === analyst) return { ok: false, status: 409, error: "two-person rule: a different analyst must co-sign" };
    item.crp.signoffs.push({ analyst, action, ts: new Date().toISOString() });
    signedBy = `${first.analyst} + ${analyst}`;
    if (!item.crp.quarantineLifted) {
      item.crp.quarantineLifted = new Date().toISOString();
      item.crp.liftReason = "decided";
    }
    item.crp.quarantineExpires = null;
    store.deployed = store.deployed.filter((d) => !(d.kind === "quarantine" && d.itemId === item.id));
  }

  item.status = action === "approve" ? "patched" : "allowed";
  store.stats[action === "approve" ? "patched" : "allowed"]++;
  const rules = store.drafts[id]?.rules ?? [];
  delete store.drafts[id];
  if (action === "approve") {
    // Dynamic edge deployment: the drafted rules go live now.
    store.deployed.unshift({
      kind: "patch",
      ruleId: item.ruleId,
      itemId: item.id,
      conds: rules.map((r) => r.cond),
      rules,
      srcIp: item.srcIp,
      srcBlocked: item.severity >= CRITICAL,
      analyst: signedBy,
      deployedAt: new Date().toISOString(),
      expiresAt: null,
      hits: 0,
      lastHit: null,
    });
  }
  await recordDecision({
    ts: new Date().toISOString(),
    analyst: signedBy,
    action,
    itemId: item.id,
    ruleId: item.ruleId,
    severity: item.severity,
    confidence: item.confidence,
    srcIp: item.srcIp,
    changes: item.plan.length,
  });
  return { ok: true, final: true };
}

export async function snapshot(): Promise<DashboardState> {
  const now = Date.now();
  expireQuarantines(now);
  const { ledger, source } = await listLedger();
  return {
    items: store.items,
    ledger,
    ledgerSource: source,
    traffic: store.traffic,
    deployed: store.deployed.map((d) => ({ ...d, rules: undefined })),
    stats: store.stats,
    simOnline: now - store.lastEventAt < 5000,
    now,
  };
}

export const lastAttack = () => store.lastAttack;
export function nextTier(n: number) {
  return store.tierIdx++ % n;
}
