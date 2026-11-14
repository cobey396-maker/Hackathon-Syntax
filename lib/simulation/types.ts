// Shared data model for the frontend-only simulation. Everything here lives in browser memory;
// nothing touches a real network, firewall or database.

// ── Synthetic traffic ────────────────────────────────────────────────────────────────────
export type Protocol = "AnyConnect SSL" | "IKEv2";

/** One synthetic VPN handshake. IPs use RFC 5737 documentation ranges. */
export type Packet = {
  id: string; // PKT-0001
  tick: number; // simulation clock when it arrived
  srcIp: string;
  user: string;
  protocol: Protocol;
  service: string; // destination, e.g. "vpn-gw-01:443"
  tlsVersion: number; // record version, e.g. 0x0303
  declaredLen: number; // record length the header claims
  actualLen: number; // bytes actually present
  cipherSuites: number[];
};

// ── Detection ────────────────────────────────────────────────────────────────────────────
export type RiskLevel = "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";

/** One deterministic check the detector ran on a packet field. */
export type Finding = {
  check: string; // "record.length"
  field: keyof Packet | "baseline";
  observed: string;
  expected: string;
  triggered: boolean;
  points: number; // added to the risk score when triggered
  explanation: string;
};

export type Detection = {
  packetId: string;
  findings: Finding[];
  score: number; // 0-10, sum of triggered points, capped
  risk: RiskLevel;
  suspicious: boolean;
  summary: string;
};

// ── Honeypot / mock parser ───────────────────────────────────────────────────────────────
export type ParserOutcome = "CLEAN_PARSE" | "VERSION_REJECTED" | "HANDSHAKE_ABORT" | "STATE_DESYNC" | "BUFFER_OVERRUN";

export type Evidence = {
  outcome: ParserOutcome;
  crashed: boolean;
  log: string[]; // terminal lines, derived from the parse steps
  observed: string[]; // what the mock parser actually did
  inferred: string[]; // what the rules conclude from that
  unknown: string[]; // what this simulation cannot tell us
};

export type Conclusion = "malicious" | "inconclusive" | "benign";

export type Analysis = {
  conclusion: Conclusion;
  rationale: string;
};

// ── Virtual firewall ─────────────────────────────────────────────────────────────────────
/** Every condition present must match (AND). Absent conditions are wildcards. */
export type RuleMatch = {
  protocol?: Protocol;
  srcIp?: string;
  service?: string;
  tlsVersionOutside?: [number, number]; // match if version is NOT within [min, max]
  declaredLenAbove?: number;
  lengthMismatch?: boolean; // declaredLen !== actualLen
  invalidCipherList?: boolean; // empty, duplicate or unknown suites
};

export type Rule = {
  id: string; // VP-0001 (patch) or BASE-01 (baseline)
  action: "allow" | "deny";
  match: RuleMatch;
  description: string;
  origin: "baseline" | "patch";
  expiresAtTick?: number; // undefined = no expiry
};

export type FirewallState = {
  rules: Rule[]; // evaluated top to bottom, first match wins, default allow
  quarantined: string[]; // source IPs under temporary containment
  snapshots: { ruleId: string; rulesBefore: Rule[] }[]; // for rollback of applied patches
};

export type EvalResult = {
  verdict: "ALLOW" | "BLOCK";
  matchedRule: string | null; // rule id, "QUARANTINE" or null (default allow)
  reason: string;
};

// ── Proposals & verification ─────────────────────────────────────────────────────────────
export type CaseResult = {
  packetId: string;
  label: string;
  expect: "ALLOW" | "BLOCK";
  before: EvalResult;
  after: EvalResult;
  pass: boolean;
};

export type PolicyTest = {
  cases: CaseResult[];
  passed: boolean;
  blockedLegit: number;
  targetBlocked: boolean;
};

export type Proposal = {
  rule: Rule;
  rationale: string;
  scope: string;
  preCheck: PolicyTest; // narrow pre-deployment sample, isolated baseline copy
  safe: boolean;
};

// ── Incidents ────────────────────────────────────────────────────────────────────────────
export type IncidentStatus =
  | "DETECTED"
  | "CONTAINED"
  | "SIMULATED"
  | "ANALYZED"
  | "PROPOSED"
  | "AWAITING_REVIEW"
  | "ENFORCED"
  | "VERIFIED"
  | "BENIGN"
  | "INCONCLUSIVE"
  | "REJECTED"
  | "VERIFY_FAILED"
  | "ROLLED_BACK"
  | "ROLLBACK_FAILED";

/** Kept separate from status: an incident can await review while still contained. */
export type Containment = "NONE" | "QUARANTINED" | "RELEASED";

export type Incident = {
  id: string; // INC-0001
  packetId: string;
  scenarioId: string | null;
  status: IncidentStatus;
  containment: Containment;
  detection: Detection;
  evidence?: Evidence;
  analysis?: Analysis;
  proposal?: Proposal;
  verification?: PolicyTest;
  rollback?: { restored: boolean; controls: CaseResult[] };
  decidedBy?: string;
  createdTick: number;
  updatedTick: number;
};

// ── Audit ────────────────────────────────────────────────────────────────────────────────
export type AuditType =
  | "TRAFFIC_ALLOWED"
  | "TRAFFIC_BLOCKED"
  | "DETECTED"
  | "CONTAINED"
  | "QUARANTINE_RELEASED"
  | "SIMULATED"
  | "ANALYZED"
  | "CLASSIFIED"
  | "PROPOSED"
  | "REVIEW_REQUESTED"
  | "APPROVED"
  | "REJECTED"
  | "DEPLOYED"
  | "VERIFIED"
  | "VERIFY_FAILED"
  | "ROLLED_BACK"
  | "ROLLBACK_FAILED"
  | "RULE_EXPIRED"
  | "RESET";

export type AuditEvent = {
  id: string; // EVT-0001
  tick: number;
  incidentId: string | null;
  type: AuditType;
  from: IncidentStatus | null;
  to: IncidentStatus | null;
  actor: string; // "system" or a demo persona name
  outcome: "ok" | "warn" | "fail";
  summary: string;
};

// ── Engine state & actions ───────────────────────────────────────────────────────────────
export type TrafficRecord = {
  packetId: string;
  tick: number;
  verdict: "ALLOWED" | "BLOCKED" | "FLAGGED";
  detail: string;
  incidentId: string | null;
};

export type SimState = {
  tick: number;
  packets: Record<string, Packet>;
  traffic: TrafficRecord[]; // newest first
  incidents: Incident[]; // newest first
  firewall: FirewallState;
  events: AuditEvent[]; // newest first
  seq: { packet: number; incident: number; rule: number; event: number };
  lastError: string | null;
};

/** Packet fields a caller supplies; the engine assigns id and tick. */
export type PacketInput = Omit<Packet, "id" | "tick">;

export type Action =
  | { type: "INGEST"; packet: PacketInput; scenarioId?: string }
  | { type: "CONTAIN"; incidentId: string }
  | { type: "SIMULATE"; incidentId: string }
  | { type: "ANALYZE"; incidentId: string }
  | { type: "CLASSIFY"; incidentId: string } // ANALYZED → PROPOSED | INCONCLUSIVE | BENIGN
  | { type: "REQUEST_REVIEW"; incidentId: string }
  | { type: "APPROVE"; incidentId: string; actor: string }
  | { type: "REJECT"; incidentId: string; actor: string }
  | { type: "VERIFY"; incidentId: string }
  | { type: "ROLLBACK"; incidentId: string }
  | { type: "RELEASE"; incidentId: string; actor: string }
  | { type: "ADVANCE"; incidentId: string } // next automatic step; pauses for humans
  | { type: "TICK"; by?: number }
  | { type: "RESET" };
