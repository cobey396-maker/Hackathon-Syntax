// In-memory store. Lives on globalThis so dev hot-reload keeps the data.
// Swap for Supabase later (see lib/supabase.ts).
import { listLedger, recordDecision } from "./audit";
import { inspect, timings, type Baseline } from "./detector";
import type { DashboardState, Decision, RawPacket, SandboxItem, Stats, TrafficEvent } from "./types";

type Store = {
  items: SandboxItem[];
  traffic: TrafficEvent[];
  recentLegit: RawPacket[]; // baseline + false-positive check window
  stats: Stats;
  totalMs: number;
  lastEventAt: number;
  seq: number;
};

const g = globalThis as unknown as { __vpsStore4?: Store };
const store: Store = (g.__vpsStore4 ??= {
  items: [],
  traffic: [],
  recentLegit: [],
  stats: { seen: 0, legit: 0, sandboxed: 0, patched: 0, allowed: 0, crashesPrevented: 0, avgVerdictMs: 0 },
  totalMs: 0,
  lastEventAt: 0,
  seq: 0,
});

function baseline(): Baseline {
  const xs = store.recentLegit.map((p) => p.declared_len);
  const n = xs.length;
  if (n < 5) return { mean: 0, std: 0, n };
  const mean = xs.reduce((a, b) => a + b, 0) / n;
  const std = Math.sqrt(xs.reduce((a, b) => a + (b - mean) ** 2, 0) / n);
  return { mean, std, n };
}

export function ingest(p: RawPacket) {
  const t = timings(p);
  store.stats.seen++;
  store.totalMs += t.totalMs;
  store.stats.avgVerdictMs = +(store.totalMs / store.stats.seen).toFixed(2);
  store.lastEventAt = Date.now();
  const v = inspect(p, baseline());

  store.traffic.unshift({
    seq: store.stats.seen,
    ts: p.ts,
    srcIp: p.src_ip,
    user: p.user,
    protocol: p.protocol,
    verdict: v ? "sandboxed" : "allowed",
    severity: v?.severity ?? 0,
    verdictMs: t.totalMs,
  });
  store.traffic.length = Math.min(store.traffic.length, 50);

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
  store.stats.sandboxed++;
  if (v.crashes) store.stats.crashesPrevented++;
  return item;
}

export async function decide(id: string, action: Decision, analyst: string) {
  const item = store.items.find((i) => i.id === id);
  if (!item || item.status !== "pending") return false;
  item.status = action === "approve" ? "patched" : "allowed";
  store.stats[action === "approve" ? "patched" : "allowed"]++;
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
    stats: store.stats,
    simOnline: now - store.lastEventAt < 5000,
    now,
  };
}
