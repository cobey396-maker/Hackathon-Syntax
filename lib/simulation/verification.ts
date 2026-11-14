// Before/after policy tests. Both sides use the same evaluator on an isolated copy of the
// policy (no temporary quarantines), so containment cannot make a patch look effective.
import { applyVirtualRule, evaluatePacket, isolatedPolicy } from "./firewall.ts";
import type { LabeledPacket } from "./scenarios.ts";
import type { CaseResult, FirewallState, Packet, PolicyTest, Rule } from "./types.ts";

export const controlPacket = (c: LabeledPacket, i: number): Packet => ({ ...c.packet, id: `CTL-${String(i + 1).padStart(2, "0")}`, tick: 0 });

/** Runs `target` (expect BLOCK) and `controls` (expect ALLOW) against policy before and after `rule`. */
export function testPolicy(target: Packet, rule: Rule, fw: FirewallState, controls: LabeledPacket[]): PolicyTest {
  const before = isolatedPolicy(fw.rules.some((r) => r.id === rule.id) ? { ...fw, rules: fw.rules.filter((r) => r.id !== rule.id) } : fw);
  const after = applyVirtualRule(rule, before);
  return compare(target, before, after, controls);
}

export function compare(target: Packet, before: FirewallState, after: FirewallState, controls: LabeledPacket[], tick = 0): PolicyTest {
  const run = (p: Packet, label: string, expect: "ALLOW" | "BLOCK"): CaseResult => {
    const b = evaluatePacket(p, before, tick);
    const a = evaluatePacket(p, after, tick);
    return { packetId: p.id, label, expect, before: b, after: a, pass: a.verdict === expect };
  };
  const cases = [run(target, "suspicious target", "BLOCK"), ...controls.map((c, i) => run(controlPacket(c, i), c.label, "ALLOW"))];
  const blockedLegit = cases.slice(1).filter((c) => !c.pass).length;
  return { cases, passed: cases.every((c) => c.pass), blockedLegit, targetBlocked: cases[0].pass };
}
