// Mock honeypot: replays a synthetic packet through a toy model of the VPN record parser.
// Every log line is produced by a parse step below, so the evidence always matches the packet.
// No real code, malware or network traffic is executed.
import { cipherListInvalid, hex, PARSER_BUFFER, versionOk } from "./detector.ts";
import type { Analysis, Detection, Evidence, Packet, ParserOutcome } from "./types.ts";

export function replay(p: Packet): Evidence {
  const log: string[] = [
    `$ hp-replay --target mock-vpn-parser --packet ${p.id}`,
    `[hp] isolated parser instance up (no egress, synthetic input)`,
    `[parser] read record header: version=${hex(p.tlsVersion)} length=${hex(p.declaredLen)}`,
  ];
  const observed: string[] = [];
  let outcome: ParserOutcome = "CLEAN_PARSE";

  // Steps run in the same order the mock parser would read the bytes; the first failure stops it.
  if (p.declaredLen > PARSER_BUFFER) {
    outcome = "BUFFER_OVERRUN";
    log.push(
      `[parser] alloc record buffer ${hex(PARSER_BUFFER)}`,
      `[parser] copy ${hex(p.declaredLen)} bytes into ${hex(PARSER_BUFFER)} buffer (trusts header)`,
      `[parser] *** mock fault: write past buffer end in record_read() ***`,
      `[hp] mock parser process terminated`,
    );
    observed.push(`Mock parser copied ${p.declaredLen} B into a ${PARSER_BUFFER} B buffer and faulted.`);
  } else if (!versionOk(p.tlsVersion)) {
    outcome = "VERSION_REJECTED";
    log.push(`[parser] version ${hex(p.tlsVersion)} unsupported → alert protocol_version`, `[parser] connection closed cleanly`);
    observed.push(`Mock parser rejected record version ${hex(p.tlsVersion)} and closed the session cleanly.`);
  } else if (p.declaredLen !== p.actualLen) {
    outcome = "STATE_DESYNC";
    log.push(
      `[parser] expected ${p.declaredLen} B, buffer holds ${p.actualLen} B`,
      `[parser] WARN read past record boundary; session state desynchronised`,
      `[parser] session entry left half-open`,
    );
    observed.push(`Mock parser waited for ${p.declaredLen - p.actualLen} missing bytes and left a half-open session.`);
  } else if (cipherListInvalid(p.cipherSuites)) {
    outcome = "HANDSHAKE_ABORT";
    log.push(`[parser] cipher list invalid → alert handshake_failure`, `[parser] connection closed cleanly`);
    observed.push("Mock parser aborted the handshake on an invalid cipher list.");
  } else {
    log.push(`[parser] ClientHello parsed: ${p.cipherSuites.length} cipher suites`, `[parser] handshake completed normally`);
    observed.push("Mock parser processed the handshake normally.");
  }
  log.push(`[hp] replay finished: outcome=${outcome}; 0 bytes left the sandbox`);

  const crashed = outcome === "BUFFER_OVERRUN";
  const inferred =
    outcome === "BUFFER_OVERRUN"
      ? ["A parser with this flaw could be crashed by this input (denial of service)."]
      : outcome === "STATE_DESYNC"
        ? ["Repeated sends could exhaust the session table."]
        : outcome === "CLEAN_PARSE"
          ? ["No harmful parser behaviour was reproduced."]
          : ["The parser refused the input safely; the packet is malformed but did not cause harm here."];

  return {
    outcome,
    crashed,
    log,
    observed,
    inferred,
    unknown: [
      "Whether a real production parser has the same flaw (this is a mock).",
      "The sender's intent; malformed input can also come from buggy clients.",
      "Whether this is part of a wider campaign.",
    ],
  };
}

/** Combines detector score and replay outcome into a conclusion. */
export function analyze(d: Detection, e: Evidence): Analysis {
  if (e.outcome === "BUFFER_OVERRUN" || e.outcome === "STATE_DESYNC") {
    return { conclusion: "malicious", rationale: `Detector score ${d.score}/10 and the replay reproduced harmful behaviour (${e.outcome}).` };
  }
  if (e.outcome === "CLEAN_PARSE" && d.score === 0) {
    return { conclusion: "benign", rationale: "Only context signals fired and the replay parsed cleanly; no evidence of harm." };
  }
  return {
    conclusion: "inconclusive",
    rationale: `Detector score ${d.score}/10 but the replay showed no harmful behaviour (${e.outcome}). Not enough evidence for a persistent rule.`,
  };
}
