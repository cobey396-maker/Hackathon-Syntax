// Mock "AI" inspection engine. Deterministic rules stand in for a model so the
// severity grade is explainable: every finding carries the points it adds.
import type { Finding, RawPacket } from "./types";

const PARSER_BUFFER = 0x4000; // 16 KiB record buffer in the simulated VPN parser
const VALID_VERSIONS = [0x0301, 0x0302, 0x0303, 0x0304];
const KNOWN_CIPHERS = new Set([0x1301, 0x1302, 0x1303, 0xc02b, 0xc02c, 0xc02f, 0xc030, 0xcca8, 0xcca9]);

const hex = (n: number, w = 4) => "0x" + n.toString(16).toUpperCase().padStart(w, "0");

export type Verdict = {
  severity: number;
  confidence: number;
  findings: Finding[];
  trace: string[];
  rule: string;
  honeypot: string[];
  crashes: boolean;
};

export function inspect(p: RawPacket): Verdict | null {
  const findings: Finding[] = [];
  const conditions: string[] = [];

  if (!VALID_VERSIONS.includes(p.tls_version)) {
    const near = p.tls_version > 0x0304 && p.tls_version <= 0x0310;
    findings.push({
      label: `record version ${hex(p.tls_version)} outside TLS 1.0–1.3 (${near ? "near-miss, likely fuzzed" : "nonsense value"})`,
      points: near ? 1 : 2,
    });
    conditions.push("tls.record.version not in {0x0301..0x0304}");
  }

  const overflow = p.declared_len > PARSER_BUFFER;
  if (overflow) {
    findings.push({
      label: `length field ${hex(p.declared_len)} exceeds parser buffer ${hex(PARSER_BUFFER)}`,
      points: 5,
    });
    conditions.push(`tls.record.length > ${hex(PARSER_BUFFER)}`);
  } else if (p.declared_len !== p.actual_len) {
    findings.push({
      label: `declared length ${p.declared_len} B ≠ actual payload ${p.actual_len} B`,
      points: 3,
    });
    conditions.push("tls.record.length != payload.length");
  }

  const ciphers = p.cipher_suites;
  const badCipher =
    ciphers.length === 0 ||
    new Set(ciphers).size !== ciphers.length ||
    ciphers.some((c) => !KNOWN_CIPHERS.has(c));
  if (badCipher) {
    findings.push({
      label:
        ciphers.length === 0
          ? "empty cipher-suite list"
          : `cipher list malformed: [${ciphers.map((c) => hex(c)).join(", ")}]`,
      points: 2,
    });
    conditions.push("handshake.cipher_suites invalid");
  }

  if (findings.length === 0) return null;

  const crashes = overflow;
  if (crashes) {
    findings.push({ label: "payload overflows parser in honeypot replay (SIGSEGV)", points: 3 });
  }

  const raw = findings.reduce((s, f) => s + f.points, 0);
  const severity = Math.min(10, raw);
  const confidence = Math.min(99, 55 + severity * 4 + findings.length);

  const trace = [
    `ingest  ${p.protocol} handshake from ${p.src_ip} (user="${p.user}")`,
    `parse   record v${hex(p.tls_version)} len=${p.declared_len} actual=${p.actual_len} ciphers=${ciphers.length}`,
    ...findings.map((f) => `flag    +${f.points}  ${f.label}`),
    `score   raw=${raw} → severity ${severity}/10${raw > 10 ? " (capped)" : ""}`,
    `match   no signature in IPS ruleset — treating as zero-day variant`,
    `action  quarantined to sandbox, virtual patch drafted, awaiting analyst`,
  ];

  const rule = [
    `virtual-patch {`,
    `  match  protocol "${p.protocol}"`,
    ...conditions.map((c, i) => `  ${i === 0 ? "when " : "or   "} ${c}`),
    `  action drop + log`,
    `  scope  outside-interface vpn-terminators`,
    `}`,
  ].join("\n");

  const honeypot = [
    `$ hp-replay --target asa-parser-sim --pcap ${p.src_ip.replaceAll(".", "_")}.pcap`,
    `[hp] spinning up isolated parser instance (no egress) ... ok`,
    `[hp] replaying ${p.protocol} handshake (${p.actual_len} bytes)`,
    `[parser] read record header: version=${hex(p.tls_version)} length=${hex(p.declared_len)}`,
    ...(crashes
      ? [
          `[parser] memcpy(buf[${hex(PARSER_BUFFER)}], payload, ${hex(p.declared_len)})`,
          `[parser] *** SIGSEGV at 0x7f3a1c00 in ssl_record_read() ***`,
          `[hp] parser process terminated — production firewall would have crashed`,
          `[hp] contained: 0 bytes left sandbox, instance destroyed`,
        ]
      : [
          `[parser] WARN state machine desync: unexpected field after header`,
          `[parser] session table entry left half-open (resource leak)`,
          `[hp] no crash — repeated sends would exhaust VPN session table`,
          `[hp] contained: 0 bytes left sandbox, instance destroyed`,
        ]),
  ];

  return { severity, confidence, findings, trace, rule, honeypot, crashes };
}
