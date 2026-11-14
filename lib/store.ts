// In-memory store. Lives on globalThis so dev hot-reload keeps the data.
// Swap for Supabase later (see lib/supabase.ts).
import { listLedger, recordDecision, resetLedgerView } from "./audit";
import { inspect, timings, type Baseline, type Rule } from "./detector";
import type { DashboardState, Decision, DeployedPatch, RawPacket, SandboxItem, Stats, TrafficEvent } from "./types";

type Store = {
  items: SandboxItem[];
  traffic: TrafficEvent[];
  recentLegit: RawPacket[]; // baseline + false-positive check window
  pendingRules: Record<string, Rule[]>; // itemId -> drafted rules (predicates stay server-side)
  deployed: (DeployedPatch & { rules: Rule[] })[]; // live at the edge
  stats: Stats;
  totalMs: number;
  lastEventAt: number;
  seq: number;
};

const fresh = (): Store => ({
  items: [],
  traffic: [],
  recentLegit: [],
  pendingRules: {},
  deployed: [],
  stats: { seen: 0, legit: 0, sandboxed: 0, patched: 0, allowed: 0, crashesPrevented: 0, blockedAtEdge: 0, avgVerdictMs: 0 },
  totalMs: 0,
  lastEventAt: 0,
  seq: 0,
});

const g = globalThis as unknown as { __vpsStore5?: Store };
const store: Store = (g.__vpsStore5 ??= fresh());

// Demo reset: empty queue, patches, traffic and counters. Keeps the simulator "online" state.
export function reset() {
  const lastEventAt = store.lastEventAt;
  Object.assign(store, fresh(), { lastEventAt });
  resetLedgerView();
}

function baseline(): Baseline {
  const xs = store.recentLegit.map((p) => p.declared_len);
  const n = xs.length;
  if (n < 5) return { mean: 0, std: 0, n };
  const mean = xs.reduce((a, b) => a + b, 0) / n;
  const std = Math.sqrt(xs.reduce((a, b) => a + (b - mean) ** 2, 0) / n);
  return { mean, std, n };
}

function pushTraffic(e: TrafficEvent) {
  store.traffic.unshift(e);
  store.traffic.length = Math.min(store.traffic.length, 50);
}

// Approved virtual patches run first: a match is refused at the edge without reaching the AI or the firewall.
function enforce(p: RawPacket) {
  const patch = store.deployed.find((d) => (d.srcBlocked && d.srcIp === p.src_ip) || d.rules.some((r) => r.test(p)));
  if (!patch) return null;
  patch.hits++;
  patch.lastHit = p.ts;
  store.stats.blockedAtEdge++;
  pushTraffic({ seq: store.stats.seen, ts: p.ts, srcIp: p.src_ip, user: p.user, protocol: p.protocol, verdict: "blocked", severity: 0, verdictMs: 0.04, ruleId: patch.ruleId });
  return patch;
}

export type IngestResult = { blocked: DeployedPatch } | { item: SandboxItem } | null;

export function ingest(p: RawPacket): IngestResult {
  store.stats.seen++;
  store.lastEventAt = Date.now();
  const patch = enforce(p);
  if (patch) return { blocked: patch };

  const t = timings(p);
  store.totalMs += t.totalMs;
  store.stats.avgVerdictMs = +(store.totalMs / (store.stats.seen - store.stats.blockedAtEdge)).toFixed(2);
  const v = inspect(p, baseline());

  pushTraffic({
    seq: store.stats.seen,
    ts: p.ts,
    srcIp: p.src_ip,
    user: p.user,
    protocol: p.protocol,
    verdict: v ? "sandboxed" : "allowed",
    severity: v?.severity ?? 0,
    verdictMs: t.totalMs,
  });

  if (!v) {
    store.stats.legit++;
    store.recentLegit.unshift(p);
    store.recentLegit.length = Math.min(store.recentLegit.length, 300);
    return null;
  }

  const n = ++store.seq;
  const ruleId = `VP-${String(n).padStart(4, "0")}`;
  const item: SandboxItem = {
    id: `SBX-${String(n).padStart(4, "0")}`,
    ruleId,
    ts: p.ts,
    srcIp: p.src_ip,
    user: p.user,
    protocol: p.protocol,
    severity: v.severity,
    confidence: v.confidence,
    checks: v.checks,
    bytes: v.bytes,
    timings: t,
    honeypot: v.honeypot,
    crashes: v.crashes,
    plan: v.plan(ruleId),
    // Would the new shield rules have blocked any recent legitimate session?
    impact: {
      matched: store.recentLegit.filter((q) => v.rules.some((r) => r.test(q))).length,
      window: store.recentLegit.length,
    },
    status: "pending",
  };
  store.items.unshift(item);
  store.items.length = Math.min(store.items.length, 200);
  store.pendingRules[item.id] = v.rules;
  store.stats.sandboxed++;
  if (v.crashes) store.stats.crashesPrevented++;
  return { item };
}

export async function decide(id: string, action: Decision, analyst: string) {
  const item = store.items.find((i) => i.id === id);
  if (!item || item.status !== "pending") return false;
  item.status = action === "approve" ? "patched" : "allowed";
  store.stats[action === "approve" ? "patched" : "allowed"]++;
  const rules = store.pendingRules[id] ?? [];
  delete store.pendingRules[id];
  if (action === "approve") {
    // Dynamic edge deployment: the drafted rules go live now.
    store.deployed.unshift({
      ruleId: item.ruleId,
      itemId: item.id,
      conds: rules.map((r) => r.cond),
      rules,
      srcIp: item.srcIp,
      srcBlocked: item.severity >= 7,
      analyst,
      deployedAt: new Date().toISOString(),
      hits: 0,
      lastHit: null,
    });
  }
  await recordDecision({
    ts: new Date().toISOString(),
    analyst,
    action,
    itemId: item.id,
    ruleId: item.ruleId,
    severity: item.severity,
    confidence: item.confidence,
    srcIp: item.srcIp,
    changes: item.plan.length,
  });
  return true;
}

export async function snapshot(): Promise<DashboardState> {
  const now = Date.now();
  const { ledger, source } = await listLedger();
  return {
    items: store.items,
    ledger,
    ledgerSource: source,
    traffic: store.traffic,
    deployed: store.deployed.map((d) => ({ ...d, rules: undefined })),
    stats: store.stats,
    simOnline: now - store.lastEventAt < 5000,
    now,
  };
}
