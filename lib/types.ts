// Raw event posted by traffic_simulator.py
export type RawPacket = {
  ts: string;
  src_ip: string;
  user: string;
  protocol: string; // "AnyConnect SSL" | "IKEv2"
  tls_version: number; // e.g. 0x0303
  declared_len: number;
  actual_len: number;
  cipher_suites: number[];
  payload_hex: string;
};

// One field the AI Shield checked. bytes = inclusive offsets into SandboxItem.bytes.
export type Check = {
  field: string;
  observed: string;
  expected: string;
  ok: boolean;
  points: number; // added to severity when failed
  bytes: [number, number] | null;
  kind: "parser" | "model" | "sandbox";
};

// One change the AI proposes; nothing is applied until an analyst approves.
export type PlanLine = { cmd: string; note: string };

export type Timings = { parseMs: number; modelMs: number; totalMs: number };

export type Status = "pending" | "patched" | "allowed";
export type Decision = "approve" | "deny";

export type SandboxItem = {
  id: string;
  ruleId: string;
  ts: string;
  srcIp: string;
  user: string;
  protocol: string;
  severity: number; // 1-10, sum of failed-check points capped at 10
  confidence: number; // %
  checks: Check[];
  bytes: number[]; // reconstructed handshake header
  timings: Timings;
  honeypot: string[];
  crashes: boolean;
  plan: PlanLine[];
  impact: { matched: number; window: number }; // legit sessions the new rules would have blocked
  status: Status;
};

export type LedgerEntry = {
  id: string;
  ts: string;
  analyst: string;
  action: Decision;
  itemId: string;
  ruleId: string;
  severity: number;
  confidence: number;
  srcIp: string;
  changes: number;
};

export type TrafficEvent = {
  seq: number;
  ts: string;
  srcIp: string;
  user: string;
  protocol: string;
  verdict: "allowed" | "sandboxed";
  severity: number;
  verdictMs: number;
};

export type Stats = {
  seen: number;
  legit: number;
  sandboxed: number;
  patched: number;
  allowed: number;
  crashesPrevented: number;
  avgVerdictMs: number;
};

export type DashboardState = {
  items: SandboxItem[];
  ledger: LedgerEntry[];
  ledgerSource: "supabase" | "mock";
  traffic: TrafficEvent[];
  stats: Stats;
  simOnline: boolean;
  now: number;
};
