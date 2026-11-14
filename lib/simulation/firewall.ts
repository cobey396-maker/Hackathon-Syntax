// Virtual firewall: a deterministic policy evaluator over synthetic packets.
// All functions are pure; they return a new FirewallState rather than mutating.
import { cipherListInvalid, hex } from "./detector.ts";
import type { EvalResult, FirewallState, Packet, Rule, RuleMatch } from "./types.ts";

export const BASELINE_RULES: Rule[] = [
  {
    id: "BASE-01",
    action: "deny",
    origin: "baseline",
    match: { service: "admin-portal:8443" },
    description: "Management portal is not reachable from the VPN edge",
  },
  {
    id: "BASE-02",
    action: "allow",
    origin: "baseline",
    match: { service: "vpn-gw-01:443" },
    description: "Allow VPN handshakes to the gateway",
  },
];

export const emptyFirewall = (): FirewallState => ({ rules: [...BASELINE_RULES], quarantined: [], snapshots: [] });

export function matches(m: RuleMatch, p: Packet): boolean {
  if (m.protocol !== undefined && m.protocol !== p.protocol) return false;
  if (m.srcIp !== undefined && m.srcIp !== p.srcIp) return false;
  if (m.service !== undefined && m.service !== p.service) return false;
  if (m.tlsVersionOutside !== undefined) {
    const [lo, hi] = m.tlsVersionOutside;
    if (p.tlsVersion >= lo && p.tlsVersion <= hi) return false;
  }
  if (m.declaredLenAbove !== undefined && !(p.declaredLen > m.declaredLenAbove)) return false;
  if (m.lengthMismatch !== undefined && (p.declaredLen !== p.actualLen) !== m.lengthMismatch) return false;
  if (m.invalidCipherList !== undefined && cipherListInvalid(p.cipherSuites) !== m.invalidCipherList) return false;
  return true;
}

/** Human-readable condition text, e.g. "protocol=IKEv2 AND record.length > 0x4000". */
export function describeMatch(m: RuleMatch): string {
  const parts: string[] = [];
  if (m.protocol) parts.push(`protocol = ${m.protocol}`);
  if (m.srcIp) parts.push(`src = ${m.srcIp}`);
  if (m.service) parts.push(`dst = ${m.service}`);
  if (m.tlsVersionOutside) parts.push(`record.version ∉ ${hex(m.tlsVersionOutside[0])}..${hex(m.tlsVersionOutside[1])}`);
  if (m.declaredLenAbove !== undefined) parts.push(`record.length > ${hex(m.declaredLenAbove)}`);
  if (m.lengthMismatch !== undefined) parts.push(m.lengthMismatch ? "record.length ≠ payload" : "record.length = payload");
  if (m.invalidCipherList !== undefined) parts.push(m.invalidCipherList ? "cipher_suites invalid" : "cipher_suites valid");
  return parts.length ? parts.join(" AND ") : "any";
}

const active = (r: Rule, tick: number) => r.expiresAtTick === undefined || tick < r.expiresAtTick;

/** Quarantine first, then rules top to bottom (first match wins), then default allow. */
export function evaluatePacket(p: Packet, fw: FirewallState, tick = 0): EvalResult {
  if (fw.quarantined.includes(p.srcIp)) {
    return { verdict: "BLOCK", matchedRule: "QUARANTINE", reason: `${p.srcIp} is under temporary containment` };
  }
  for (const r of fw.rules) {
    if (!active(r, tick) || !matches(r.match, p)) continue;
    return { verdict: r.action === "deny" ? "BLOCK" : "ALLOW", matchedRule: r.id, reason: r.description };
  }
  return { verdict: "ALLOW", matchedRule: null, reason: "no rule matched (default allow)" };
}

/** Patch rules are inserted above the baseline allow rules so they take effect. */
export function applyVirtualRule(rule: Rule, fw: FirewallState): FirewallState {
  if (fw.rules.some((r) => r.id === rule.id)) throw new Error(`rule ${rule.id} is already installed`);
  return {
    ...fw,
    rules: [rule, ...fw.rules],
    snapshots: [...fw.snapshots, { ruleId: rule.id, rulesBefore: fw.rules }],
  };
}

/** Restores the rule set captured just before `ruleId` was applied. */
export function rollbackVirtualRule(ruleId: string, fw: FirewallState): { fw: FirewallState; restored: boolean } {
  const i = fw.snapshots.findIndex((s) => s.ruleId === ruleId);
  if (i < 0) return { fw, restored: false };
  // Rules applied after this one stay in place; only this rule is removed.
  const later = new Set(fw.snapshots.slice(i + 1).map((s) => s.ruleId));
  const keepLater = fw.rules.filter((r) => later.has(r.id));
  return {
    fw: { ...fw, rules: [...keepLater, ...fw.snapshots[i].rulesBefore], snapshots: fw.snapshots.filter((_, k) => k !== i) },
    restored: true,
  };
}

export function quarantineSession(srcIp: string, fw: FirewallState): FirewallState {
  return fw.quarantined.includes(srcIp) ? fw : { ...fw, quarantined: [...fw.quarantined, srcIp] };
}

export function releaseQuarantine(srcIp: string, fw: FirewallState): FirewallState {
  return { ...fw, quarantined: fw.quarantined.filter((ip) => ip !== srcIp) };
}

/** Policy-only copy with no temporary quarantines, so patch tests measure the rule itself. */
export const isolatedPolicy = (fw: FirewallState): FirewallState => ({ rules: fw.rules, quarantined: [], snapshots: [] });

