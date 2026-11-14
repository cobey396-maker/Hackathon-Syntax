import type { LedgerEntry } from "@/lib/types";
import { Panel, SeverityBadge, td, th } from "./ui";

export default function AuditLedger({ ledger }: { ledger: LedgerEntry[] }) {
  return (
    <Panel title="Audit Ledger" right={<span className="text-xs text-muted">append-only · every decision is attributed</span>}>
      {ledger.length === 0 ? (
        <p className="p-8 text-center text-sm text-muted">No analyst decisions yet.</p>
      ) : (
        <table className="w-full">
          <thead>
            <tr>
              <th className={th}>Time (UTC)</th>
              <th className={th}>Entry</th>
              <th className={th}>Analyst</th>
              <th className={th}>Decision</th>
              <th className={th}>Packet</th>
              <th className={th}>Rule</th>
              <th className={th}>Severity</th>
            </tr>
          </thead>
          <tbody>
            {ledger.map((e) => (
              <tr key={e.id} className="border-t border-line">
                <td className={`${td} font-mono text-muted`}>{e.ts.replace("T", " ").slice(0, 19)}</td>
                <td className={`${td} font-mono`}>{e.id}</td>
                <td className={td}>{e.analyst}</td>
                <td className={td}>
                  {e.action === "approve" ? (
                    <span className="font-medium text-cisco">Approved virtual patch</span>
                  ) : (
                    <span className="font-medium text-amber-300">Overrode, allowed traffic</span>
                  )}
                </td>
                <td className={`${td} font-mono`}>{e.itemId}</td>
                <td className={`${td} font-mono`}>{e.action === "approve" ? e.ruleId : "—"}</td>
                <td className={td}>
                  <SeverityBadge value={e.severity} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </Panel>
  );
}
