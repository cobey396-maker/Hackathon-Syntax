// Claude as the AI Shield's "brain": grades a held handshake's severity 1-10 from the parser
// evidence and honeypot result. Server-only. Without ANTHROPIC_API_KEY (or if the call fails or
// is declined) the deterministic rules score stands and the UI says so.
import Anthropic from "@anthropic-ai/sdk";
import type { Check, RawPacket } from "./types";

export const GRADER_MODEL = "claude-opus-5-5";

export const graderEnabled = () => Boolean(process.env.ANTHROPIC_API_KEY);

let client: Anthropic | null = null;
const anthropic = () => (client ??= new Anthropic({ timeout: 20_000, maxRetries: 1 }));

export type ClaudeGrade = {
  severity: number;
  confidence: number;
  attack_class: string;
  rationale: string;
  risk_factors: string[];
};

const SCHEMA = {
  type: "object",
  properties: {
    severity: { type: "integer", description: "1-10 severity" },
    confidence: { type: "integer", description: "0-100, confidence this is malicious" },
    attack_class: { type: "string", description: "Short name, e.g. 'TLS record length overflow'" },
    rationale: { type: "string", description: "Two sentences max, for a SOC analyst" },
    risk_factors: { type: "array", items: { type: "string" }, description: "2-4 short phrases" },
  },
  required: ["severity", "confidence", "attack_class", "rationale", "risk_factors"],
  additionalProperties: false,
};

const SYSTEM = `You are the triage model inside a VPN edge "AI Shield" for a security operations center.
A handshake was held before the firewall because its structure is malformed. You receive the parser's
field checks, a statistical baseline comparison, and the result of replaying the packet against an
isolated copy of the firewall's parser (a honeypot). All traffic is simulated for a training dashboard.

Grade severity on this scale, judging real-world impact, not the number of failed checks:
1-3  Low: protocol oddities with no observed effect (unknown version, odd cipher list). Likely scanner or buggy client.
4-6  Medium: parser state problems without a crash (length mismatch, session desync, resource exhaustion if repeated).
7-8  High: memory-safety signals (length beyond the parser buffer) or behaviour that could take the firewall down.
9-10 Critical: the honeypot crashed the parser, especially when combined with other evasion signals.
Use the whole range. Two packets with different evidence should usually get different grades.
Return only the JSON object.`;

export async function gradeWithClaude(p: RawPacket, checks: Check[], crashes: boolean): Promise<ClaudeGrade> {
  const evidence = {
    protocol: p.protocol,
    source_ip: p.src_ip,
    user: p.user,
    record_version: "0x" + p.tls_version.toString(16).padStart(4, "0"),
    declared_length: p.declared_len,
    actual_payload_length: p.actual_len,
    cipher_suites: p.cipher_suites.map((c) => "0x" + c.toString(16).padStart(4, "0")),
    checks: checks.map((c) => ({ check: c.field, observed: c.observed, expected: c.expected, result: c.ok ? "pass" : "fail" })),
    honeypot_parser_crashed: crashes,
    honeypot_replay: checks.find((c) => c.kind === "sandbox")?.observed ?? "unknown",
  };

  const res = await anthropic().beta.messages.create({
    model: GRADER_MODEL,
    max_tokens: 2048,
    betas: ["server-side-fallback-2026-07-01"],
    fallbacks: "default", // if the safety classifier declines security content, retry on the routed fallback model
    output_config: { effort: "low", format: { type: "json_schema", schema: SCHEMA } },
    system: SYSTEM,
    messages: [{ role: "user", content: JSON.stringify(evidence) }],
  });

  if (res.stop_reason === "refusal") throw new Error(`declined (${res.stop_details?.category ?? "no category"})`);
  const text = res.content.find((b) => b.type === "text");
  if (!text || text.type !== "text") throw new Error(`no text block (stop_reason ${res.stop_reason})`);
  const g = JSON.parse(text.text) as ClaudeGrade;
  return {
    severity: Math.max(1, Math.min(10, Math.round(g.severity))),
    confidence: Math.max(0, Math.min(99, Math.round(g.confidence))),
    attack_class: String(g.attack_class).slice(0, 80),
    rationale: String(g.rationale).slice(0, 400),
    risk_factors: (g.risk_factors ?? []).slice(0, 4).map((r) => String(r).slice(0, 60)),
  };
}

export function errorNote(e: unknown) {
  if (e instanceof Anthropic.AuthenticationError) return "Claude API key rejected";
  if (e instanceof Anthropic.RateLimitError) return "Claude rate-limited";
  if (e instanceof Anthropic.APIConnectionError) return "Claude unreachable";
  if (e instanceof Anthropic.APIError) return `Claude API error ${e.status ?? ""}`.trim();
  return e instanceof Error ? e.message.slice(0, 80) : "Claude grading failed";
}
