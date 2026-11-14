// Plain-English wording for the presentation UI. The engine stays technical; this file
// translates its results into sentences an audience can follow.
import type { Finding, IncidentStatus, ParserOutcome, Proposal, RuleMatch } from "@/lib/simulation/types";

const n = (x: number) => x.toLocaleString("en-US");

export function findingText(f: Finding, p: { declaredLen: number; actualLen: number }): string {
  switch (f.check) {
    case "record.version":
      return `Uses an unsupported protocol version (${f.observed})`;
    case "record.length vs parser buffer":
      return `Claims to be ${n(p.declaredLen)} bytes, bigger than the firewall can hold (16,384)`;
    case "record.length vs payload":
      return `Says it is ${n(p.declaredLen)} bytes but only sent ${n(p.actualLen)}`;
    case "cipher_suites":
      return "Offers a broken list of encryption options";
    case "length vs baseline":
      return "Much larger than normal traffic (context only, not proof of harm)";
    default:
      return f.explanation;
  }
}

export const OUTCOME: Record<ParserOutcome, { title: string; detail: string; tone: "bad" | "warn" | "ok" }> = {
  BUFFER_OVERRUN: { title: "It crashed the test firewall", detail: "On a real network, this could knock the VPN offline for everyone.", tone: "bad" },
  STATE_DESYNC: { title: "It confused the test firewall", detail: "Sent repeatedly, it could fill up the firewall's connection table.", tone: "bad" },
  VERSION_REJECTED: { title: "The firewall rejected it safely", detail: "Odd, but no harm was reproduced.", tone: "warn" },
  HANDSHAKE_ABORT: { title: "The firewall rejected it safely", detail: "Odd, but no harm was reproduced.", tone: "warn" },
  CLEAN_PARSE: { title: "Nothing harmful happened", detail: "The connection behaved like a normal user.", tone: "ok" },
};

export function ruleText(m: RuleMatch): string {
  const what = m.protocol ? `${m.protocol} connections` : "connections";
  const parts: string[] = [];
  if (m.srcIp) parts.push(`from ${m.srcIp}`);
  if (m.declaredLenAbove !== undefined) parts.push(`that claim more than ${n(m.declaredLenAbove)} bytes`);
  if (m.lengthMismatch) parts.push("whose size does not match what they send");
  if (m.tlsVersionOutside) parts.push("using an unsupported version");
  if (m.invalidCipherList) parts.push("with a broken encryption list");
  return `Block ${what}${parts.length ? " " + parts.join(" and ") : ""}`;
}

export function impactText(prop: Proposal): string {
  const tested = prop.preCheck.cases.length - 1;
  const ok = tested - prop.preCheck.blockedLegit;
  return `${ok} of ${tested} normal users still connect`;
}

export type Tone = "bad" | "warn" | "ok" | "info" | "neutral" | "action";

export const STATUS: Record<IncidentStatus, { label: string; tone: Tone }> = {
  DETECTED: { label: "New threat", tone: "bad" },
  CONTAINED: { label: "Isolated", tone: "warn" },
  SIMULATED: { label: "Testing", tone: "info" },
  ANALYZED: { label: "Analyzed", tone: "info" },
  PROPOSED: { label: "Fix drafted", tone: "info" },
  AWAITING_REVIEW: { label: "Needs your decision", tone: "action" },
  ENFORCED: { label: "Fix applied", tone: "info" },
  VERIFIED: { label: "Protected", tone: "ok" },
  BENIGN: { label: "False alarm", tone: "ok" },
  INCONCLUSIVE: { label: "Needs more investigation", tone: "neutral" },
  REJECTED: { label: "Fix rejected", tone: "neutral" },
  VERIFY_FAILED: { label: "Fix failed its test", tone: "bad" },
  ROLLED_BACK: { label: "Fix undone safely", tone: "warn" },
  ROLLBACK_FAILED: { label: "Undo failed", tone: "bad" },
};

export const TONE: Record<Tone, string> = {
  bad: "bg-red-500/15 text-red-300 ring-red-500/30",
  warn: "bg-amber-500/15 text-amber-200 ring-amber-500/30",
  ok: "bg-emerald-500/15 text-emerald-300 ring-emerald-500/30",
  info: "bg-sky-500/15 text-sky-300 ring-sky-500/30",
  neutral: "bg-slate-500/15 text-slate-300 ring-slate-500/30",
  action: "bg-neon/20 text-neon-hi ring-neon/40",
};

/** Which of the four story steps an incident has reached (0-3). */
export function storyStep(s: IncidentStatus): number {
  if (s === "DETECTED") return 0;
  if (s === "CONTAINED" || s === "SIMULATED" || s === "ANALYZED" || s === "BENIGN" || s === "INCONCLUSIVE") return 1;
  if (s === "PROPOSED" || s === "AWAITING_REVIEW" || s === "REJECTED") return 2;
  return 3;
}
