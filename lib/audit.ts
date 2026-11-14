// Audit ledger: every analyst decision, attributed. Writes to Supabase table `audit_ledger`
// when keys are configured (see supabase/audit_ledger.sql), otherwise to memory.
import { supabase } from "./supabase";
import type { LedgerEntry } from "./types";

export type LedgerSource = "supabase" | "mock";

const g = globalThis as unknown as { __vpsLedger?: LedgerEntry[]; __vpsLedgerAfterId?: number };
const mem: LedgerEntry[] = (g.__vpsLedger ??= []);

// Demo reset: clear the in-memory ledger and hide older Supabase rows from the dashboard.
// Supabase rows are never deleted (the table is append-only).
// Uses the newest row id as the cutoff, not a timestamp: this machine's clock can drift from the database's.
export async function resetLedgerView() {
  mem.length = 0;
  if (!supabase) return;
  const { data } = await supabase.from("audit_ledger").select("id").order("id", { ascending: false }).limit(1);
  g.__vpsLedgerAfterId = data?.[0]?.id ?? 0;
}

const fmtId = (n: number) => `AUD-${String(n).padStart(4, "0")}`;

export async function recordDecision(e: Omit<LedgerEntry, "id">): Promise<LedgerEntry> {
  if (supabase) {
    // Append-only RPC: the table itself accepts no direct writes from client keys
    const { data, error } = await supabase.rpc("record_audit_decision", {
      p_analyst: e.analyst,
      p_action: e.action,
      p_packet_id: e.itemId,
      p_rule_id: e.ruleId,
      p_severity: e.severity,
      p_confidence: e.confidence,
      p_src_ip: e.srcIp,
      p_changes: e.changes,
    });
    if (!error && typeof data === "number") return { ...e, id: fmtId(data) };
    console.error("audit_ledger insert failed, falling back to memory:", error?.message);
  }
  const entry = { ...e, id: fmtId(mem.length + 1) };
  mem.unshift(entry);
  return entry;
}

export async function listLedger(): Promise<{ ledger: LedgerEntry[]; source: LedgerSource }> {
  if (supabase) {
    let q = supabase.from("audit_ledger").select("*");
    if (g.__vpsLedgerAfterId) q = q.gt("id", g.__vpsLedgerAfterId);
    const { data, error } = await q.order("ts", { ascending: false }).limit(200);
    if (!error && data) {
      return {
        source: "supabase",
        ledger: data.map((r) => ({
          id: fmtId(r.id),
          ts: r.ts,
          analyst: r.analyst,
          action: r.action,
          itemId: r.packet_id,
          ruleId: r.rule_id,
          severity: r.severity,
          confidence: r.confidence,
          srcIp: r.src_ip,
          changes: r.changes,
        })),
      };
    }
    console.error("audit_ledger read failed, serving memory:", error?.message);
  }
  return { ledger: mem, source: "mock" };
}
