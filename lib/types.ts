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

export type Finding = { label: string; points: number };

export type Status = "pending" | "patched" | "allowed";

export type SandboxItem = {
  id: string;
  ts: string;
  srcIp: string;
  user: string;
  packetType: string;
  severity: number; // 1-10, sum of finding points capped at 10
  confidence: number; // %
  findings: Finding[];
  trace: string[];
  hex: string;
  ruleId: string;
  rule: string;
  honeypot: string[];
  crashes: boolean;
  status: Status;
};

export type LedgerEntry = {
  id: string;
  ts: string;
  analyst: string;
  action: "approve" | "override";
  itemId: string;
  ruleId: string;
  severity: number;
};

export type TrafficEvent = {
  ts: string;
  srcIp: string;
  user: string;
  protocol: string;
  verdict: "allowed" | "sandboxed";
  severity: number;
};

export type Stats = {
  seen: number;
  legit: number;
  sandboxed: number;
  patched: number;
  allowed: number;
};

export type DashboardState = {
  items: SandboxItem[];
  ledger: LedgerEntry[];
  traffic: TrafficEvent[];
  stats: Stats;
  simOnline: boolean;
  now: number;
};
