// Deterministic detector. Each check reads one synthetic packet field and says what it saw,
// what it expected, and how many risk points it adds. These are hand-written rules standing in
// for an AI model; they are explainable but will not catch every real attack.
import type { Detection, Finding, Packet, RiskLevel } from "./types.ts";

export const PARSER_BUFFER = 0x4000; // record buffer size in the mock VPN parser
export const VALID_VERSIONS: [number, number] = [0x0301, 0x0304];
export const KNOWN_CIPHERS = new Set([0x1301, 0x1302, 0x1303, 0xc02b, 0xc02c, 0xc02f, 0xc030, 0xcca8, 0xcca9]);

/** Fixed baseline of legitimate record lengths (from the control fixtures). */
export const BASELINE_LEN = { mean: 517, std: 120 };

export const hex = (n: number, w = 4) => "0x" + n.toString(16).toUpperCase().padStart(w, "0");

export const versionOk = (v: number) => v >= VALID_VERSIONS[0] && v <= VALID_VERSIONS[1];

export function cipherListInvalid(c: number[]) {
  return c.length === 0 || new Set(c).size !== c.length || c.some((x) => !KNOWN_CIPHERS.has(x));
}

export function riskLevel(score: number): RiskLevel {
  if (score >= 8) return "CRITICAL";
  if (score >= 5) return "HIGH";
  if (score >= 3) return "MEDIUM";
  return "LOW";
}

export function detect(p: Packet): Detection {
  const vOk = versionOk(p.tlsVersion);
  const vNear = p.tlsVersion > VALID_VERSIONS[1] && p.tlsVersion <= 0x0310;
  const overflow = p.declaredLen > PARSER_BUFFER;
  const mismatch = p.declaredLen !== p.actualLen;
  const dup = new Set(p.cipherSuites).size !== p.cipherSuites.length;
  const unknown = p.cipherSuites.filter((c) => !KNOWN_CIPHERS.has(c));
  const cBad = cipherListInvalid(p.cipherSuites);
  const sigma = Math.abs(p.declaredLen - BASELINE_LEN.mean) / BASELINE_LEN.std;

  const findings: Finding[] = [
    {
      check: "record.version",
      field: "tlsVersion",
      observed: hex(p.tlsVersion),
      expected: `${hex(VALID_VERSIONS[0])} – ${hex(VALID_VERSIONS[1])}`,
      triggered: !vOk,
      points: vOk ? 0 : vNear ? 1 : 2,
      explanation: vOk ? "Version is a standard TLS record version." : "Record version is outside the TLS 1.0–1.3 range the gateway accepts.",
    },
    {
      check: "record.length vs parser buffer",
      field: "declaredLen",
      observed: `${hex(p.declaredLen)} (${p.declaredLen} B)`,
      expected: `≤ ${hex(PARSER_BUFFER)} (${PARSER_BUFFER} B)`,
      triggered: overflow,
      points: overflow ? 5 : 0,
      explanation: overflow
        ? "Declared length is larger than the mock parser's record buffer; a parser that trusts it would copy past the buffer."
        : "Declared length fits the parser buffer.",
    },
    {
      check: "record.length vs payload",
      field: "actualLen",
      observed: `declared ${p.declaredLen} B, received ${p.actualLen} B`,
      expected: "declared = received",
      triggered: mismatch && !overflow,
      points: mismatch && !overflow ? 3 : 0,
      explanation: mismatch ? "Header length does not match the bytes actually present." : "Header length matches the payload.",
    },
    {
      check: "cipher_suites",
      field: "cipherSuites",
      observed:
        p.cipherSuites.length === 0
          ? "empty list"
          : dup
            ? `${p.cipherSuites.length} suites, duplicates`
            : unknown.length
              ? `unknown ${unknown.map((c) => hex(c)).join(" ")}`
              : `${p.cipherSuites.length} known suites`,
      expected: "≥1 known, unique",
      triggered: cBad,
      points: cBad ? 2 : 0,
      explanation: cBad ? "Cipher list is empty, repeats entries, or offers suites the gateway does not know." : "Cipher list is well formed.",
    },
    {
      check: "length vs baseline",
      field: "baseline",
      observed: `${sigma.toFixed(1)}σ from mean ${BASELINE_LEN.mean} B`,
      expected: "< 4.0σ",
      triggered: sigma >= 4,
      points: 0, // signal only: unusual is not the same as malicious
      explanation: sigma >= 4 ? "Unusually large compared with recent legitimate handshakes (context only, adds no points)." : "Within the normal size range.",
    },
  ];

  const raw = findings.reduce((s, f) => s + (f.triggered ? f.points : 0), 0);
  const score = Math.min(10, raw);
  const suspicious = findings.some((f) => f.triggered);
  const hits = findings.filter((f) => f.triggered).map((f) => f.check);
  return {
    packetId: p.id,
    findings,
    score,
    risk: riskLevel(score),
    suspicious,
    summary: suspicious ? `Flagged: ${hits.join(", ")}. Risk score ${score}/10.` : "All checks passed.",
  };
}
