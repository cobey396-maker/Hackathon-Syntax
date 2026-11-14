// Drafts a virtual firewall rule from the detector findings and tests it on an isolated copy of
// the policy before any human sees it.
import { PARSER_BUFFER, VALID_VERSIONS } from "./detector.ts";
import { describeMatch } from "./firewall.ts";
import { PRE_DEPLOY_SAMPLE } from "./scenarios.ts";
import type { Detection, FirewallState, Packet, Proposal, Rule, RuleMatch } from "./types.ts";
import { testPolicy } from "./verification.ts";

export const PATCH_TTL_TICKS = 24 * 60 * 60; // 24h of simulation seconds

/** Narrowest conditions that capture what actually fired. */
export function draftMatch(p: Packet, d: Detection): RuleMatch {
  const fired = new Set(d.findings.filter((f) => f.triggered).map((f) => f.check));
  const m: RuleMatch = { protocol: p.protocol };
  if (fired.has("record.length vs parser buffer")) m.declaredLenAbove = PARSER_BUFFER;
  else if (fired.has("record.length vs payload")) m.lengthMismatch = true;
  else if (fired.has("record.version")) m.tlsVersionOutside = VALID_VERSIONS;
  else if (fired.has("cipher_suites")) m.invalidCipherList = true;
  return m;
}

export function propose(p: Packet, d: Detection, ruleId: string, fw: FirewallState, tick: number, override?: RuleMatch): Proposal {
  const match = override ?? draftMatch(p, d);
  const rule: Rule = {
    id: ruleId,
    action: "deny",
    origin: "patch",
    match,
    description: `Virtual patch for ${p.id}: drop ${describeMatch(match)}`,
    expiresAtTick: tick + PATCH_TTL_TICKS,
  };
  const preCheck = testPolicy(p, rule, fw, PRE_DEPLOY_SAMPLE);
  return {
    rule,
    rationale: d.summary,
    scope: describeMatch(match),
    preCheck,
    safe: preCheck.passed,
  };
}
