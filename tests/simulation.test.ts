// Core simulation tests. Run with: npm test  (Node's built-in runner, no extra dependencies)
import assert from "node:assert/strict";
import { test } from "node:test";
import { detect } from "../lib/simulation/detector.ts";
import { canTransition, initialState, reduce, runToPause } from "../lib/simulation/engine.ts";
import { applyVirtualRule, emptyFirewall, evaluatePacket, quarantineSession, releaseQuarantine, rollbackVirtualRule } from "../lib/simulation/firewall.ts";
import { fixtureMetrics } from "../lib/simulation/metrics.ts";
import { CONTROL_TRAFFIC, scenario } from "../lib/simulation/scenarios.ts";
import { counts } from "../lib/simulation/selectors.ts";
import type { Packet, Rule, SimState } from "../lib/simulation/types.ts";

const pkt = (id: string): Packet => ({ ...scenario(id)!.packet, id: "T", tick: 0 });
const ingest = (s: SimState, id: string) => reduce(s, { type: "INGEST", packet: scenario(id)!.packet, scenarioId: id });
const statuses = (s: SimState, incId: string) =>
  s.events
    .filter((e) => e.incidentId === incId && e.to)
    .map((e) => e.to)
    .reverse();

test("detector: legitimate packet passes every check", () => {
  const d = detect(pkt("legit"));
  assert.equal(d.suspicious, false);
  assert.equal(d.score, 0);
});

test("detector: oversized record is flagged with the field that caused it", () => {
  const d = detect(pkt("malformed-tls"));
  assert.equal(d.suspicious, true);
  const f = d.findings.find((x) => x.check === "record.length vs parser buffer")!;
  assert.equal(f.triggered, true);
  assert.equal(f.points, 5);
  assert.equal(d.score, 7); // +5 buffer, +2 cipher list
  assert.equal(d.risk, "HIGH");
});

test("firewall: same packet, different policy, different verdict", () => {
  const p = pkt("malformed-tls");
  const fw = emptyFirewall();
  assert.equal(evaluatePacket(p, fw).verdict, "ALLOW");
  const rule: Rule = { id: "VP-T", action: "deny", origin: "patch", match: { declaredLenAbove: 0x4000 }, description: "t" };
  const patched = applyVirtualRule(rule, fw);
  assert.deepEqual(evaluatePacket(p, patched), { verdict: "BLOCK", matchedRule: "VP-T", reason: "t" });
  const { fw: back, restored } = rollbackVirtualRule("VP-T", patched);
  assert.equal(restored, true);
  assert.equal(evaluatePacket(p, back).verdict, "ALLOW");
  assert.deepEqual(back.rules, fw.rules);
});

test("firewall: rule expiry and quarantine", () => {
  const p = pkt("malformed-tls");
  const rule: Rule = { id: "VP-E", action: "deny", origin: "patch", match: {}, description: "e", expiresAtTick: 10 };
  const fw = applyVirtualRule(rule, emptyFirewall());
  assert.equal(evaluatePacket(p, fw, 9).verdict, "BLOCK");
  assert.equal(evaluatePacket(p, fw, 10).verdict, "ALLOW");
  const q = quarantineSession(p.srcIp, emptyFirewall());
  assert.equal(evaluatePacket(p, q).matchedRule, "QUARANTINE");
  assert.equal(evaluatePacket(p, releaseQuarantine(p.srcIp, q)).verdict, "ALLOW");
});

test("firewall: duplicate rule install is refused", () => {
  const rule: Rule = { id: "VP-D", action: "deny", origin: "patch", match: {}, description: "d" };
  assert.throws(() => applyVirtualRule(rule, applyVirtualRule(rule, emptyFirewall())));
});

test("state machine: transition table", () => {
  assert.equal(canTransition("DETECTED", "CONTAINED"), true);
  assert.equal(canTransition("DETECTED", "ENFORCED"), false);
  assert.equal(canTransition("REJECTED", "ENFORCED"), false);
  assert.equal(canTransition("AWAITING_REVIEW", "VERIFIED"), false);
});

test("scenario 1: legitimate traffic is allowed, no incident", () => {
  const s = ingest(initialState(), "legit");
  assert.equal(s.incidents.length, 0);
  assert.equal(s.traffic[0].verdict, "ALLOWED");
  assert.equal(s.events[0].type, "TRAFFIC_ALLOWED");
});

test("scenario 2: full lifecycle, pauses for human, then verifies", () => {
  let s = ingest(initialState(), "malformed-tls");
  const id = s.incidents[0].id;
  s = runToPause(s, id);
  assert.equal(s.incidents[0].status, "AWAITING_REVIEW");
  assert.equal(s.incidents[0].containment, "QUARANTINED");
  assert.equal(s.incidents[0].evidence!.outcome, "BUFFER_OVERRUN");
  assert.equal(s.incidents[0].proposal!.safe, true);

  // Cannot verify before deployment; cannot advance past the human.
  assert.match(reduce(s, { type: "VERIFY", incidentId: id }).lastError!, /not installed/);
  assert.match(reduce(s, { type: "ADVANCE", incidentId: id }).lastError!, /human decision/);

  s = reduce(s, { type: "APPROVE", incidentId: id, actor: "Demo Analyst" });
  assert.equal(s.incidents[0].status, "ENFORCED");
  assert.equal(counts(s).patchRules, 1);

  // Duplicate approval rejected, state unchanged.
  const dup = reduce(s, { type: "APPROVE", incidentId: id, actor: "Demo Analyst" });
  assert.ok(dup.lastError);
  assert.equal(dup.firewall.rules.length, s.firewall.rules.length);

  s = reduce(s, { type: "VERIFY", incidentId: id });
  assert.equal(s.incidents[0].status, "VERIFIED");
  assert.equal(s.incidents[0].containment, "RELEASED");
  const v = s.incidents[0].verification!;
  assert.equal(v.cases[0].before.verdict, "ALLOW"); // computed, not hardcoded
  assert.equal(v.cases[0].after.verdict, "BLOCK");
  assert.equal(v.blockedLegit, 0);

  assert.deepEqual(statuses(s, id), ["DETECTED", "CONTAINED", "SIMULATED", "ANALYZED", "PROPOSED", "AWAITING_REVIEW", "ENFORCED", "VERIFIED"]);

  // The patched firewall now blocks a repeat of the same packet before it reaches the detector.
  s = ingest(s, "malformed-tls");
  assert.equal(s.traffic[0].verdict, "BLOCKED");
  assert.equal(s.incidents.length, 1);
});

test("rejection: proposal not installed, containment kept, cannot deploy afterwards", () => {
  let s = runToPause(ingest(initialState(), "malformed-tls"), "INC-0001");
  s = reduce(s, { type: "REJECT", incidentId: "INC-0001", actor: "Demo Analyst" });
  assert.equal(s.incidents[0].status, "REJECTED");
  assert.equal(s.incidents[0].containment, "QUARANTINED");
  assert.equal(counts(s).patchRules, 0);
  assert.ok(reduce(s, { type: "APPROVE", incidentId: "INC-0001", actor: "x" }).lastError);
  s = reduce(s, { type: "RELEASE", incidentId: "INC-0001", actor: "Demo Analyst" });
  assert.equal(s.incidents[0].containment, "RELEASED");
  assert.equal(s.firewall.quarantined.length, 0);
});

test("scenario 3: unusual but legitimate ends BENIGN and is released", () => {
  const s = runToPause(ingest(initialState(), "false-positive"), "INC-0001");
  assert.equal(s.incidents[0].status, "BENIGN");
  assert.equal(s.incidents[0].containment, "RELEASED");
  assert.equal(s.incidents[0].proposal, undefined);
});

test("scenario 4: overly broad patch fails pre-deployment test and cannot be approved", () => {
  let s = runToPause(ingest(initialState(), "broad-patch"), "INC-0001");
  const inc = s.incidents[0];
  assert.equal(inc.status, "AWAITING_REVIEW");
  assert.equal(inc.proposal!.safe, false);
  assert.ok(inc.proposal!.preCheck.blockedLegit >= 1);
  s = reduce(s, { type: "APPROVE", incidentId: inc.id, actor: "Demo Analyst" });
  assert.match(s.lastError!, /pre-deployment/);
  assert.equal(counts(s).patchRules, 0);
});

test("scenario 5: verification failure triggers rollback that restores policy", () => {
  let s = runToPause(ingest(initialState(), "rollback"), "INC-0001");
  assert.equal(s.incidents[0].proposal!.safe, true); // narrow pre-check passes
  const rulesBefore = s.firewall.rules;
  s = reduce(s, { type: "APPROVE", incidentId: "INC-0001", actor: "Demo Analyst" });
  s = runToPause(s, "INC-0001");
  assert.equal(s.incidents[0].status, "ROLLED_BACK");
  assert.ok(s.incidents[0].verification!.blockedLegit >= 1);
  assert.deepEqual(s.firewall.rules, rulesBefore);
  assert.ok(s.incidents[0].rollback!.controls.every((c) => c.pass));
  assert.equal(s.incidents[0].containment, "QUARANTINED"); // still unpatched, so stays contained
});

test("scenario 6: inconclusive threat gets no patch", () => {
  const s = runToPause(ingest(initialState(), "inconclusive"), "INC-0001");
  assert.equal(s.incidents[0].status, "INCONCLUSIVE");
  assert.equal(s.incidents[0].proposal, undefined);
});

test("invalid action leaves state unchanged and reports error", () => {
  const s = ingest(initialState(), "malformed-tls");
  const bad = reduce(s, { type: "APPROVE", incidentId: "INC-0001", actor: "x" });
  assert.ok(bad.lastError);
  assert.equal(bad.incidents, s.incidents);
  assert.equal(bad.events, s.events);
  assert.ok(reduce(s, { type: "CONTAIN", incidentId: "INC-9999" }).lastError);
});

test("determinism and reset", () => {
  const run = () => runToPause(ingest(initialState(), "malformed-tls"), "INC-0001");
  assert.deepEqual(run(), run());
  const r = reduce(run(), { type: "RESET" });
  assert.deepEqual(r, initialState());
});

test("audit: every event id is unique and every status change is logged", () => {
  let s = runToPause(ingest(initialState(), "rollback"), "INC-0001");
  s = runToPause(reduce(s, { type: "APPROVE", incidentId: "INC-0001", actor: "A" }), "INC-0001");
  const ids = s.events.map((e) => e.id);
  assert.equal(new Set(ids).size, ids.length);
  assert.equal(statuses(s, "INC-0001").at(-1), s.incidents[0].status);
});

test("metrics come from fixture runs", () => {
  const m = fixtureMetrics();
  assert.equal(m.cases, CONTROL_TRAFFIC.length + 5);
  assert.equal(m.detector.tp + m.detector.fp + m.detector.tn + m.detector.fn, m.cases);
  // Investigation should never add false positives on top of the detector.
  assert.ok(m.pipeline.fp <= m.detector.fp);
});
