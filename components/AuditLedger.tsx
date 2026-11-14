import type { LedgerSource } from "@/lib/audit";
import type { LedgerEntry } from "@/lib/types";
import { Badge, Card, CardTitle, Empty, Sev } from "./soc";

// Audit trail as a readable timeline. Every entry is a human decision, written when it was signed.
export default function AuditLedger({ ledger, source }: { ledger: LedgerEntry[]; source: LedgerSource }) {
  return (
    <Card>
      <CardTitle
        title="Audit ledger"
        sub="Every approval and override, with the analysts who signed. Append-only."
        right={
          <>
            <Badge>{ledger.length} entries</Badge>
            <Badge tone={source === "supabase" ? "ok" : "warn"}>{source === "supabase" ? "Stored in Supabase" : "In memory only"}</Badge>
          </>
        }
      />
      {ledger.length === 0 ? (
        <Empty>No decisions yet. Every AI-drafted fix must be approved or overridden by a named analyst.</Empty>
      ) : (
        <ol className="ml-1.5 space-y-5 border-l pl-6">
          {ledger.map((e) => {
            const approved = e.action === "approve";
            return (
              <li key={e.id} className="relative">
                <span className={`absolute top-2 -left-7.5 h-2.5 w-2.5 rounded-full ${approved ? "bg-cisco" : "bg-dim"}`} />
                <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                  <p className={`font-semibold ${approved ? "text-sky" : ""}`}>{approved ? `Approved virtual patch ${e.ruleId}` : "Overrode the AI: packet released"}</p>
                  <span className="rounded-full bg-cisco/15 px-2.5 py-0.5 text-xs text-sky">{e.analyst}</span>
                  <span className="font-mono text-sm text-dim">{e.ts.replace("T", " ").slice(0, 19)} UTC</span>
                </div>
                <div className="mt-1 flex flex-wrap items-end gap-x-3 gap-y-1 text-sm text-muted">
                  <span>
                    {e.itemId} from <span className="font-mono">{e.srcIp}</span>
                  </span>
                  <Sev value={e.severity} />
                  <span>{approved ? `${e.changes} config changes applied` : "no changes applied"}</span>
                  <span className="font-mono text-xs text-dim">{e.id}</span>
                </div>
              </li>
            );
          })}
        </ol>
      )}
    </Card>
  );
}
