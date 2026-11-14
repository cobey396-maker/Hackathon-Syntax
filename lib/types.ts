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

// Who graded the packet. "claude" = Claude API verdict; "rules" = deterministic checks only
// (no ANTHROPIC_API_KEY, or the call failed / was declined).
export type AiGrade = {
  engine: "claude" | "rules";
  status: "grading" | "done";
  model: string | null;
  ms: number | null;
  ruleSeverity: number; // deterministic baseline before Claude
  attackClass: string;
  rationale: string;
  riskFactors: string[];
  note: string | null; // why we fell back to rules, if we did
};

// Critical Response Protocol, armed when severity >= 7.
export type CriticalProtocol = {
  quarantinedAt: string | null; // source auto-quarantined at the edge
  quarantineLifted: string | null;
  liftReason: "expired" | "decided" | null; // expired = no analyst confirmed it within 15 min
  quarantineExpires: string | null; // auto-expiry; null once an analyst confirms the hold
  confirmedBy: string | null; // first analyst to sign "approve" confirms the quarantine
  slaDeadline: string; // respond within 5 minutes
  signoffs: { analyst: string; action: Decision; ts: string }[]; // two-person rule
};

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
  ai: AiGrade;
  crp: CriticalProtocol | null; // Critical Response Protocol, set when severity >= 7
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
  verdict: "allowed" | "sandboxed" | "blocked";
  severity: number;
  verdictMs: number;
  ruleId?: string; // deployed patch that refused it (verdict "blocked")
};

// A virtual patch an analyst approved; enforced at the edge before the AI runs.
export type DeployedPatch = {
  kind: "patch" | "quarantine"; // quarantine = automatic critical-protocol hold, pending review
  ruleId: string;
  itemId: string;
  conds: string[]; // shield-rule conditions
  srcIp: string;
  srcBlocked: boolean; // acl deny on the source (severity >= 7)
  analyst: string;
  deployedAt: string;
  expiresAt: string | null; // quarantines lapse after 15 min unless confirmed; patches never do
  hits: number;
  lastHit: string | null;
};

export type Stats = {
  seen: number;
  legit: number;
  sandboxed: number;
  patched: number;
  allowed: number;
  crashesPrevented: number;
  blockedAtEdge: number;
  avgVerdictMs: number;
};

export type DashboardState = {
  items: SandboxItem[];
  ledger: LedgerEntry[];
  ledgerSource: "supabase" | "mock";
  traffic: TrafficEvent[];
  deployed: DeployedPatch[];
  stats: Stats;
  simOnline: boolean;
  now: number;
};
