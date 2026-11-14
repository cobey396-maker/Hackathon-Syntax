// Mock AI Shield inspection engine. Deterministic checks stand in for a model so every
// verdict is explainable: each failed check names the bytes it found and the points it adds.
import type { Check, PlanLine, RawPacket, Timings } from "./types";

export const PARSER_BUFFER = 0x4000; // record buffer in the simulated VPN parser
const VALID_VERSIONS = [0x0301, 0x0302, 0x0303, 0x0304];
// Registered suites a real client may offer: TLS 1.3, ECDHE, and the RSA-key-exchange GCM/CBC suites
// older clients still send. (Benchmark v1 flagged 0x009C, a valid suite, as unknown.)
const KNOWN_CIPHERS = new Set([
  0x1301, 0x1302, 0x1303, 0xc02b, 0xc02c, 0xc02f, 0xc030, 0xcca8, 0xcca9,
  0xc009, 0xc00a, 0xc013, 0xc014, 0xc023, 0xc024, 0xc027, 0xc028, 0x009c, 0x009d, 0x009e, 0x009f, 0x002f, 0x0035,
]);
// RFC 8701 GREASE values (0x0A0A, 0x1A1A … 0xFAFA). Browsers add them on purpose; ignore them.
// (Benchmark v1 held every Chrome-style handshake because of these.)
const isGrease = (c: number) => (c & 0x0f0f) === 0x0a0a && c >> 12 === ((c >> 4) & 0x0f);
const realCiphers = (cs: number[]) => cs.filter((c) => !isGrease(c));

export const hex = (n: number, w = 4) => "0x" + n.toString(16).toUpperCase().padStart(w, "0");

// Rebuild the TLS record + ClientHello header bytes the shield actually parses.
// Layout: [0] type | [1-2] version | [3-4] length | [5] hs type | [6-8] hs len | [9-10] client ver
//         [11-42] random | [43] session id len | [44-45] cipher list len | [46..] ciphers | compression
export const OFF = { type: 0, version: 1, length: 3, hsType: 5, cipherLen: 44, ciphers: 46 };

function buildBytes(p: RawPacket): number[] {
  const rnd = (p.payload_hex.match(/[0-9a-f]{2}/gi) ?? []).map((h) => parseInt(h, 16));
  const hsLen = Math.max(0, p.actual_len - 4);
  const b = [
    0x16, p.tls_version >> 8, p.tls_version & 0xff, (p.declared_len >> 8) & 0xff, p.declared_len & 0xff,
    0x01, (hsLen >> 16) & 0xff, (hsLen >> 8) & 0xff, hsLen & 0xff, 0x03, 0x03,
    ...Array.from({ length: 32 }, (_, i) => rnd[i % Math.max(1, rnd.length)] ?? i),
    0x00, ((p.cipher_suites.length * 2) >> 8) & 0xff, (p.cipher_suites.length * 2) & 0xff,
  ];
  for (const c of p.cipher_suites) b.push(c >> 8, c & 0xff);
  b.push(0x01, 0x00);
  return b;
}

// Deterministic pseudo-latency so the same packet always reports the same timing.
export function timings(p: RawPacket): Timings {
  let h = p.declared_len * 31 + p.tls_version;
  for (const ch of p.src_ip) h = (h * 33 + ch.charCodeAt(0)) >>> 0;
  const parseMs = 0.18 + (h % 37) / 100;
  const modelMs = 1.4 + ((h >> 5) % 160) / 100;
  return { parseMs: +parseMs.toFixed(2), modelMs: +modelMs.toFixed(2), totalMs: +(parseMs + modelMs + 0.06).toFixed(2) };
}

// A shield rule: human-readable condition + the predicate it enforces.
export type Rule = { cond: string; test: (p: RawPacket) => boolean };

export type Baseline = { mean: number; std: number; n: number };

export type Verdict = {
  severity: number;
  confidence: number;
  checks: Check[];
  bytes: number[];
  honeypot: string[];
  crashes: boolean;
  rules: Rule[];
  attackClass: string; // rules-engine label; Claude may refine it
  plan: (ruleId: string, severity: number) => PlanLine[]; // rebuilt when Claude regrades
};

export function inspect(p: RawPacket, base: Baseline): Verdict | null {
  const bytes = buildBytes(p);
  const cs = realCiphers(p.cipher_suites);
  const n = cs.length;
  const rules: Rule[] = [];

  const vOk = VALID_VERSIONS.includes(p.tls_version);
  const vNear = p.tls_version > 0x0304 && p.tls_version <= 0x0310;
  if (!vOk) rules.push({ cond: "tls.record.version !in 0x0301..0x0304", test: (q) => !VALID_VERSIONS.includes(q.tls_version) });

  const overflow = p.declared_len > PARSER_BUFFER;
  const mismatch = p.declared_len !== p.actual_len;
  if (overflow) rules.push({ cond: `tls.record.length > ${hex(PARSER_BUFFER)}`, test: (q) => q.declared_len > PARSER_BUFFER });
  else if (mismatch) rules.push({ cond: "tls.record.length != payload.length", test: (q) => q.declared_len !== q.actual_len });

  const dup = new Set(cs).size !== n;
  const unknown = cs.filter((c) => !KNOWN_CIPHERS.has(c));
  const cOk = n > 0 && !dup && unknown.length === 0;
  if (!cOk)
    rules.push({
      cond: "handshake.cipher_suites invalid",
      test: (q) => {
        const qc = realCiphers(q.cipher_suites);
        return qc.length === 0 || new Set(qc).size !== qc.length || qc.some((c) => !KNOWN_CIPHERS.has(c));
      },
    });

  if (rules.length === 0) return null;

  const sigma = base.std > 0 ? Math.abs(p.declared_len - base.mean) / base.std : 0;
  const crashes = overflow;
  // Honeypot outcome follows what the packet actually does to the parser:
  //   overflow -> crash; big length gap -> half-open session leak; small gap -> read timeout; else clean reject
  const gap = p.declared_len - p.actual_len;
  const outcome: "crash" | "leak" | "timeout" | "reject" = crashes ? "crash" : mismatch && gap > 1000 ? "leak" : mismatch ? "timeout" : "reject";

  const checks: Check[] = [
    { kind: "parser", field: "record.content_type", observed: "0x16 handshake", expected: "0x16", ok: true, points: 0, bytes: [0, 0] },
    {
      kind: "parser",
      field: "record.version",
      observed: hex(p.tls_version),
      expected: "0x0301 – 0x0304",
      ok: vOk,
      points: vOk ? 0 : vNear ? 1 : 2,
      bytes: [OFF.version, OFF.version + 1],
    },
    {
      kind: "parser",
      field: "record.length",
      observed: `${hex(p.declared_len)} (${p.declared_len} B)`,
      expected: overflow ? `≤ ${hex(PARSER_BUFFER)} buffer` : `= payload ${p.actual_len} B`,
      ok: !overflow && !mismatch,
      points: overflow ? 5 : mismatch ? 3 : 0,
      bytes: [OFF.length, OFF.length + 1],
    },
    { kind: "parser", field: "handshake.type", observed: "0x01 ClientHello", expected: "0x01", ok: true, points: 0, bytes: [OFF.hsType, OFF.hsType] },
    {
      kind: "parser",
      field: "cipher_suites",
      observed: n === 0 ? "empty list" : dup ? `${n} suites, duplicates` : unknown.length ? `unknown ${unknown.map((c) => hex(c)).join(" ")}` : `${n} suites`,
      expected: "≥1 known, unique",
      ok: cOk,
      points: cOk ? 0 : 2,
      bytes: [OFF.cipherLen, OFF.ciphers + Math.max(0, n * 2 - 1)],
    },
    {
      kind: "model",
      field: "length vs baseline",
      observed: `${sigma.toFixed(1)}σ (n=${base.n})`,
      expected: "< 4.0σ",
      ok: sigma < 4,
      points: 0, // signal only; rules above carry the score
      bytes: null,
    },
    {
      kind: "sandbox",
      field: "honeypot replay",
      observed: { crash: "SIGSEGV ssl_record_read()", leak: "session table leak", timeout: "read timeout, dropped", reject: "rejected cleanly" }[outcome],
      expected: "clean parse",
      ok: outcome === "reject" || outcome === "timeout",
      points: crashes ? 3 : 0,
      bytes: null,
    },
  ];

  const raw = checks.reduce((s, c) => s + c.points, 0);
  const severity = Math.max(1, Math.min(10, raw));
  const failed = checks.filter((c) => !c.ok).length;
  const confidence = Math.min(99, 55 + severity * 4 + failed);

  const honeypot = [
    `$ hp-replay --target asa-parser-sim --pcap ${p.src_ip.replaceAll(".", "_")}.pcap`,
    `[hp] isolated parser instance up (no egress)`,
    `[hp] replaying ${p.protocol} handshake, ${p.actual_len} bytes`,
    `[parser] record header: version=${hex(p.tls_version)} length=${hex(p.declared_len)}`,
    ...(crashes
      ? [
          `[parser] memcpy(buf[${hex(PARSER_BUFFER)}], payload, ${hex(p.declared_len)})`,
          `[parser] *** SIGSEGV at 0x7f3a1c00 in ssl_record_read() ***`,
          `[hp] parser terminated: production firewall would have crashed`,
          `[hp] contained: 0 bytes left the Holding Center`,
        ]
      : outcome === "leak"
        ? [
            `[parser] WARN state desync after header`,
            `[parser] session entry left half-open`,
            `[hp] no crash; repeated sends would exhaust session table`,
            `[hp] contained: 0 bytes left the Holding Center`,
          ]
        : outcome === "timeout"
          ? [
              `[parser] waiting for ${gap} missing bytes`,
              `[parser] read timeout after 5000 ms; connection closed, session freed`,
              `[hp] no crash, no leaked state; firewall unaffected`,
              `[hp] contained: 0 bytes left the Holding Center`,
            ]
          : [
              `[parser] handshake rejected: ${vOk ? "invalid cipher list" : "unsupported version"} (alert 70/40)`,
              `[parser] no session state allocated`,
              `[hp] no crash, no leaked state; firewall unaffected`,
              `[hp] contained: 0 bytes left the Holding Center`,
            ]),
  ];

  const fp = bytes.slice(0, 6).concat(bytes.slice(OFF.cipherLen, OFF.cipherLen + 4)).map((x) => x.toString(16).padStart(2, "0")).join("").slice(0, 12);

  const plan = (ruleId: string, sev: number): PlanLine[] => [
    ...rules.map((r) => ({ cmd: `shield-rule ${ruleId} drop if ${r.cond}`, note: "drop matching handshakes before the firewall parser" })),
    sev >= 7
      ? { cmd: `acl edge-in deny host ${p.src_ip} expire 24h`, note: "critical protocol: source already quarantined; make it permanent for 24h" }
      : sev >= 4
        ? { cmd: `rate-limit host ${p.src_ip} 5/min expire 24h`, note: "throttle while source is watched" }
        : { cmd: `watch host ${p.src_ip}`, note: "flag further handshakes for review" },
    { cmd: `ips watchlist add fp:${fp}`, note: "fingerprint of the malformed header" },
    sev >= 7
      ? { cmd: `incident open P1 "VPN parser ${crashes ? "overflow" : "fault"}" notify psirt`, note: "critical protocol: two-analyst sign-off, 5 min SLA" }
      : { cmd: `incident log weekly-review`, note: "below critical; track for variants" },
  ];

  const attackClass = overflow
    ? "TLS record length overflow"
    : mismatch
      ? "Record length desync"
      : !cOk && !vOk
        ? "Handshake fuzzing"
        : !vOk
          ? "Protocol version probe"
          : "Cipher-suite manipulation";

  return { severity, confidence, checks, bytes, honeypot, crashes, rules, attackClass, plan };
}
