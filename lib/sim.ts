// Built-in traffic generator (same shapes as traffic_simulator.py) so the dashboard can drive
// the demo by itself: background logins plus z / c / r hotkeys. Simulated; RFC 5737 IPs.
import { PARSER_BUFFER } from "./detector";
import type { RawPacket } from "./types";

const USERS = ["a.patel", "j.nguyen", "m.garcia", "s.kim", "r.oconnor", "l.mbeki", "t.schmidt", "e.rossi"];
const GOOD_CIPHERS = [0x1301, 0x1302, 0x1303, 0xc02b, 0xc02c, 0xc02f, 0xc030, 0xcca8, 0xcca9];
const PROTOCOLS = ["AnyConnect SSL", "AnyConnect SSL", "IKEv2"];
// z cycles through these, mildest to worst. Each has one main flaw, so they earn different grades
// and approving one patch doesn't block every other kind.
export const TIERS = ["version-probe", "cipher-fuzz", "length-desync", "desync-fuzz", "overflow"] as const;
export type Tier = (typeof TIERS)[number];

const int = (a: number, b: number) => a + Math.floor(Math.random() * (b - a + 1));
const pick = <T,>(xs: readonly T[]) => xs[Math.floor(Math.random() * xs.length)];
const ip = (prefix: string) => `${prefix}.${int(2, 254)}`;
const sample = <T,>(xs: T[], n: number) => [...xs].sort(() => Math.random() - 0.5).slice(0, n);

function hexdump(n: number) {
  const bytes = Array.from({ length: Math.min(n, 48) }, () => int(0, 255).toString(16).padStart(2, "0"));
  return ["16", "03", "03", ...bytes.slice(3)].join(" ");
}

export function stamp(p: Omit<RawPacket, "ts" | "payload_hex">): RawPacket {
  return { ...p, ts: new Date().toISOString(), payload_hex: hexdump(p.actual_len) };
}

export function legit(): RawPacket {
  const n = int(220, 900);
  return stamp({
    src_ip: ip(pick(["198.51.100", "203.0.113"])),
    user: pick(USERS),
    protocol: pick(PROTOCOLS),
    tls_version: pick([0x0303, 0x0304]),
    declared_len: n,
    actual_len: n,
    cipher_suites: sample(GOOD_CIPHERS, int(3, 6)),
  });
}

export function malformed(tier: Tier): RawPacket {
  const p = legit();
  p.src_ip = ip("192.0.2");
  p.user = pick(["admin", "vpnuser", "test", "cisco", p.user]);
  if (tier === "version-probe") p.tls_version = pick([0x0305, 0x0307, 0x7f1c, 0x0000]);
  else if (tier === "cipher-fuzz") p.cipher_suites = pick([[], [0x0000, 0x0000], [0xdead]]);
  else if (tier === "length-desync") p.declared_len = p.actual_len + int(40, 400);
  else if (tier === "desync-fuzz") {
    p.declared_len = p.actual_len + int(1500, 6000);
    p.cipher_suites = pick([[0xc02b, 0xc02b, 0x00ff], [0xdead]]);
  } else p.declared_len = pick([0x4400, 0x8000, 0xffff]); // overflow: crashes the parser
  return p;
}

// c key: always the parser-crashing overflow, with an otherwise clean-looking handshake.
export function demoCritical(): RawPacket {
  return { ...legit(), src_ip: ip("192.0.2"), user: "vpnuser", declared_len: 0x8000 };
}

// Legitimate handshakes that look unusual. Used by the benchmark to measure false positives on
// traffic real clients actually send, not only on the clean logins above.
export const UNUSUAL = ["legacy-tls10", "grease-cipher", "rsa-gcm-cipher", "large-pq-hello"] as const;
export type Unusual = (typeof UNUSUAL)[number];

export function unusualLegit(kind: Unusual): RawPacket {
  const p = legit();
  if (kind === "legacy-tls10") p.tls_version = 0x0301; // old client still on TLS 1.0 record version
  else if (kind === "grease-cipher") p.cipher_suites = [pick([0x0a0a, 0x1a1a, 0x2a2a, 0xdada]), ...p.cipher_suites]; // RFC 8701 GREASE, sent by Chrome
  else if (kind === "rsa-gcm-cipher") p.cipher_suites = [...p.cipher_suites, 0x009c]; // TLS_RSA_WITH_AES_128_GCM_SHA256, valid but uncommon
  else {
    const n = int(1400, 1900); // hybrid post-quantum key share makes the ClientHello much larger
    p.declared_len = n;
    p.actual_len = n;
  }
  return { ...p, payload_hex: stamp(p).payload_hex };
}

// Held-out attacks: types the detector's rules were NOT written for. The benchmark uses them to
// measure how the shield does on attacks it hasn't seen, instead of only on ones it was built around.
// Not used by the z / c hotkeys.
export const HELDOUT = ["sslv3-downgrade", "length-underflow", "zero-length-record", "ext-len-overflow", "buffer-boundary-probe"] as const;
export type Heldout = (typeof HELDOUT)[number];

export function heldout(kind: Heldout): RawPacket {
  const p = legit();
  p.src_ip = ip("192.0.2");
  if (kind === "sslv3-downgrade") p.tls_version = 0x0300; // forces the obsolete SSL 3.0 record format
  else if (kind === "length-underflow") p.declared_len = int(8, 40); // header claims far fewer bytes than were sent
  else if (kind === "zero-length-record") {
    p.declared_len = 0; // empty handshake record; some parsers mis-handle zero-length reads
    p.actual_len = 0;
  } else if (kind === "ext-len-overflow") p.extensions_len = pick([0x8000, 0xfff0, 0xffff]); // record is fine; the extensions block inside lies
  else {
    const n = PARSER_BUFFER - int(1, 8); // consistent length just under the parser buffer: mapping its size
    p.declared_len = n;
    p.actual_len = n;
  }
  return { ...p, payload_hex: stamp(p).payload_hex };
}
