// In-memory store. Lives on globalThis so dev hot-reload keeps the data.
// Swap for Supabase later (see lib/supabase.ts).
import { inspect } from "./detector";
import type { DashboardState, LedgerEntry, RawPacket, SandboxItem, Stats, TrafficEvent } from "./types";

type Store = {
  items: SandboxItem[];
  ledger: LedgerEntry[];
  traffic: TrafficEvent[];
  stats: Stats;
  lastEventAt: number;
  seq: number;
};

const g = globalThis as unknown as { __vpsStore?: Store };
const store: Store = (g.__vpsStore ??= {
  items: [],
  ledger: [],
  traffic: [],
  stats: { seen: 0, legit: 0, sandboxed: 0, patched: 0, allowed: 0 },
  lastEventAt: 0,
  seq: 0,
});

export function ingest(p: RawPacket) {
  store.stats.seen++;
  store.lastEventAt = Date.now();
  const v = inspect(p);

  store.traffic.unshift({
    ts: p.ts,
    srcIp: p.src_ip,
    user: p.user,
    protocol: p.protocol,
    verdict: v ? "sandboxed" : "allowed",
    severity: v?.severity ?? 0,
  });
  store.traffic.length = Math.min(store.traffic.length, 50);

  if (!v) {
    store.stats.legit++;
    return null;
  }

  const n = ++store.seq;
  const item: SandboxItem = {
    id: `SBX-${String(n).padStart(4, "0")}`,
    ruleId: `VP-${String(n).padStart(4, "0")}`,
    ts: p.ts,
    srcIp: p.src_ip,
    user: p.user,
    packetType: `${p.protocol} handshake`,
    hex: p.payload_hex,
    status: "pending",
    ...v,
  };
  store.items.unshift(item);
  store.items.length = Math.min(store.items.length, 200);
  store.stats.sandboxed++;
  return item;
}

export function decide(id: string, action: "approve" | "override", analyst: string) {
  const item = store.items.find((i) => i.id === id);
  if (!item || item.status !== "pending") return false;
  item.status = action === "approve" ? "patched" : "allowed";
  store.stats[action === "approve" ? "patched" : "allowed"]++;
  store.ledger.unshift({
    id: `AUD-${String(store.ledger.length + 1).padStart(4, "0")}`,
    ts: new Date().toISOString(),
    analyst,
    action,
    itemId: item.id,
    ruleId: item.ruleId,
    severity: item.severity,
  });
  return true;
}

export function snapshot(): DashboardState {
  const now = Date.now();
  return {
    items: store.items,
    ledger: store.ledger,
    traffic: store.traffic,
    stats: store.stats,
    simOnline: now - store.lastEventAt < 5000,
    now,
  };
}
