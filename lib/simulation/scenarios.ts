// Synthetic, deterministic fixtures. IPs are RFC 5737 documentation ranges.
import type { PacketInput, RuleMatch } from "./types.ts";

const GW = "vpn-gw-01:443";

export type LabeledPacket = { label: string; packet: PacketInput; malicious: boolean };

/** Legitimate control traffic used to check that a patch does not block real users. */
export const CONTROL_TRAFFIC: LabeledPacket[] = [
  { label: "TLS 1.2 AnyConnect login", malicious: false, packet: { srcIp: "192.0.2.21", user: "a.patel", protocol: "AnyConnect SSL", service: GW, tlsVersion: 0x0303, declaredLen: 512, actualLen: 512, cipherSuites: [0xc02b, 0xc02f, 0x1301] } },
  { label: "TLS 1.3 AnyConnect login", malicious: false, packet: { srcIp: "192.0.2.34", user: "j.nguyen", protocol: "AnyConnect SSL", service: GW, tlsVersion: 0x0304, declaredLen: 498, actualLen: 498, cipherSuites: [0x1301, 0x1302, 0x1303] } },
  { label: "IKEv2 site-to-site", malicious: false, packet: { srcIp: "198.51.100.40", user: "branch-07", protocol: "IKEv2", service: GW, tlsVersion: 0x0303, declaredLen: 604, actualLen: 604, cipherSuites: [0xc030, 0xcca8] } },
  // Regression cases: only checked after deployment, so a rule that is too broad can slip past the
  // narrow pre-deployment sample and be caught (and rolled back) by verification.
  { label: "IKEv2 mobile client (regression)", malicious: false, packet: { srcIp: "198.51.100.77", user: "m.garcia", protocol: "IKEv2", service: GW, tlsVersion: 0x0304, declaredLen: 455, actualLen: 455, cipherSuites: [0x1301, 0xcca9] } },
  { label: "Large-certificate login (regression)", malicious: false, packet: { srcIp: "192.0.2.88", user: "s.kim", protocol: "AnyConnect SSL", service: GW, tlsVersion: 0x0303, declaredLen: 3900, actualLen: 3900, cipherSuites: [0xc02c, 0xc030] } },
];

export const PRE_DEPLOY_SAMPLE = CONTROL_TRAFFIC.slice(0, 3);

export type Scenario = {
  id: string;
  name: string;
  summary: string;
  packet: PacketInput;
  /** Simulates the drafting step producing a different rule (used for broad-patch demos). */
  ruleOverride?: RuleMatch;
};

export const SCENARIOS: Scenario[] = [
  {
    id: "legit",
    name: "Legitimate VPN connection",
    summary: "Normal remote-worker login. Should pass without quarantine or patch.",
    packet: CONTROL_TRAFFIC[0].packet,
  },
  {
    id: "malformed-tls",
    name: "Malformed TLS handshake",
    summary: "Record length 0xFFFF exceeds the 0x4000 parser buffer. Primary demo.",
    packet: { srcIp: "203.0.113.66", user: "unknown", protocol: "AnyConnect SSL", service: GW, tlsVersion: 0x0303, declaredLen: 0xffff, actualLen: 1460, cipherSuites: [0xc02b, 0xc02b, 0x00ff] },
  },
  {
    id: "false-positive",
    name: "Unusual but legitimate",
    summary: "Very large but well-formed handshake. Flagged as unusual; replay shows no harm.",
    packet: { srcIp: "192.0.2.140", user: "r.oconnor", protocol: "AnyConnect SSL", service: GW, tlsVersion: 0x0304, declaredLen: 12800, actualLen: 12800, cipherSuites: [0x1301, 0x1302] },
  },
  {
    id: "broad-patch",
    name: "Overly broad patch",
    summary: "Drafted rule blocks all IKEv2; pre-deployment test catches it.",
    packet: { srcIp: "198.51.100.13", user: "unknown", protocol: "IKEv2", service: GW, tlsVersion: 0x0303, declaredLen: 2400, actualLen: 900, cipherSuites: [0xc030] },
    ruleOverride: { protocol: "IKEv2" },
  },
  {
    id: "rollback",
    name: "Verification failure → rollback",
    summary: "Rule passes the narrow pre-check but blocks a regression case after deployment.",
    packet: { srcIp: "203.0.113.90", user: "unknown", protocol: "AnyConnect SSL", service: GW, tlsVersion: 0x0303, declaredLen: 3000, actualLen: 1400, cipherSuites: [0xc02f] },
    ruleOverride: { protocol: "AnyConnect SSL", declaredLenAbove: 0x0800 },
  },
  {
    id: "inconclusive",
    name: "Inconclusive threat",
    summary: "Odd record version, but the parser rejects it safely. Not enough for a patch.",
    packet: { srcIp: "203.0.113.17", user: "unknown", protocol: "AnyConnect SSL", service: GW, tlsVersion: 0x0307, declaredLen: 520, actualLen: 520, cipherSuites: [0xc02b, 0x1301] },
  },
];

export const scenario = (id: string) => SCENARIOS.find((s) => s.id === id);

/** Labeled set for detector metrics: controls plus every scenario with a known ground truth. */
export const LABELED_SET: LabeledPacket[] = [
  ...CONTROL_TRAFFIC,
  { label: "malformed-tls", malicious: true, packet: SCENARIOS[1].packet },
  { label: "false-positive", malicious: false, packet: SCENARIOS[2].packet },
  { label: "broad-patch target", malicious: true, packet: SCENARIOS[3].packet },
  { label: "rollback target", malicious: true, packet: SCENARIOS[4].packet },
  { label: "inconclusive (odd version)", malicious: true, packet: SCENARIOS[5].packet },
];
