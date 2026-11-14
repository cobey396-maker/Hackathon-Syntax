// Audit ledger: every analyst decision, attributed. Writes to Supabase table `audit_ledger`
// when keys are configured (see supabase/audit_ledger.sql), otherwise to memory.
import { supabase } from "./supabase";
import type { LedgerEntry } from "./types";

export type LedgerSource = "supabase" | "mock";

const g = globalThis as unknown as { __vpsLedger?: LedgerEntry[] };
const mem: LedgerEntry[] = (g.__vpsLedger ??= []);

const fmtId = (n: number) => `AUD-${String(n).padStart(4, "0")}`;

export async function recordDecision(e: Omit<LedgerEntry, "id">): Promise<LedgerEntry> {
  if (supabase) {
    const { data, error } = await supabase
      .from("audit_ledger")
      .insert({
        ts: e.ts,
        analyst: e.analyst,
        action: e.action,
        packet_id: e.itemId,
        rule_id: e.ruleId,
        severity: e.severity,
        confidence: e.confidence,
        src_ip: e.srcIp,
        changes: e.changes,
      })
      .select("id")
      .single();
    if (!error && data) return { ...e, id: fmtId(data.id) };
    console.error("audit_ledger insert failed, falling back to memory:", error?.message);
  }
  const entry = { ...e, id: fmtId(mem.length + 1) };
  mem.unshift(entry);
  return entry;
}

export async function listLedger(): Promise<{ ledger: LedgerEntry[]; source: LedgerSource }> {
  if (supabase) {
    const { data, error } = await supabase.from("audit_ledger").select("*").order("ts", { ascending: false }).limit(200);
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
