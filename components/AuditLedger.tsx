import type { LedgerSource } from "@/lib/audit";
import type { LedgerEntry } from "@/lib/types";
import { Pane, Sev, td, th } from "./soc";

export default function AuditLedger({ ledger, source }: { ledger: LedgerEntry[]; source: LedgerSource }) {
  return (
    <Pane
      title="Audit Ledger"
      className="flex-1"
      meta={
        <>
          <span>append-only · {ledger.length} entries</span>
          <span className={source === "supabase" ? "text-emerald-400" : "text-amber-300"}>source: {source}</span>
        </>
      }
    >
      {ledger.length === 0 ? (
        <p className="p-8 text-center text-sm text-muted">No decisions yet. Every AI-drafted patch must be approved or overridden by a named analyst.</p>
      ) : (
        <table className="w-full">
          <thead>
            <tr>
              {["Time (UTC)", "Entry", "Analyst", "Decision", "Packet", "Source IP", "Rule", "Changes", "Sev"].map((h) => (
                <th key={h} className={th}>
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {ledger.map((e) => (
              <tr key={e.id} className="border-b border-line/60">
                <td className={`${td} font-mono text-muted`}>{e.ts.replace("T", " ").slice(0, 19)}</td>
                <td className={`${td} font-mono`}>{e.id}</td>
                <td className={td}>{e.analyst}</td>
                <td className={`${td} font-mono text-xs font-semibold`}>
                  {e.action === "approve" ? <span className="text-neon-hi">APPROVED PATCH</span> : <span className="text-muted">OVERRIDE</span>}
                </td>
                <td className={`${td} font-mono`}>{e.itemId}</td>
                <td className={`${td} font-mono`}>{e.srcIp}</td>
                <td className={`${td} font-mono`}>{e.action === "approve" ? e.ruleId : "—"}</td>
                <td className={`${td} font-mono`}>{e.action === "approve" ? e.changes : 0}</td>
                <td className={td}>
                  <Sev value={e.severity} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </Pane>
  );
}
