import type { SandboxItem } from "@/lib/types";
import { Badge, Confidence, CritBadge, Empty, hhmmss, Kbd, mmss, Sev, StatusPill } from "./soc";

// Held handshakes as a list of rows: pending first, newest first. Click a row to open its story.
export default function SandboxQueue({ items, now, onOpen }: { items: SandboxItem[]; now: number; onOpen: (id: string) => void }) {
  const rows = [...items].sort((a, b) => Number(b.status === "pending") - Number(a.status === "pending") || b.ts.localeCompare(a.ts));

  if (rows.length === 0)
    return (
      <Empty>
        No threats yet. Press <Kbd>C</Kbd> to run the attack demo, or <Kbd>Z</Kbd> to send a zero-day handshake.
      </Empty>
    );

  return (
    <ul className="grid max-h-96 gap-2 overflow-y-auto pr-1">
      {rows.map((i) => {
        const fresh = i.status === "pending" && now - Date.parse(i.ts) < 6000;
        const grading = i.ai.status === "grading";
        const breached = i.crp ? Date.parse(i.crp.slaDeadline) < now : false;
        return (
          <li key={i.id}>
            <button
              onClick={() => onOpen(i.id)}
              className={`flex w-full flex-wrap items-center gap-x-6 gap-y-2 rounded-xl border px-4 py-3 text-left transition-colors hover:border-cisco ${fresh ? "border-crit/60 bg-crit/10" : "bg-bg/40"}`}
            >
              <div className="min-w-0 flex-1 basis-64">
                <p className="flex items-center gap-2 font-medium">
                  <span className="truncate">{grading ? <span className="animate-pulse text-sky">Claude is grading…</span> : i.ai.attackClass}</span>
                  {fresh && <span className="shrink-0 animate-pulse rounded-full bg-crit px-2 text-xs font-bold text-white">NEW</span>}
                </p>
                <p className="truncate text-sm text-muted">
                  {i.id} · {i.srcIp} · {hhmmss(i.ts)} UTC · {i.protocol}
                </p>
              </div>
              <div className="hidden w-28 shrink-0 md:block">{grading ? <span className="text-dim">—</span> : <Confidence value={i.confidence} />}</div>
              <div className="w-32 shrink-0">{grading ? <span className="text-dim">—</span> : <Sev value={i.severity} bar />}</div>
              <div className="flex w-52 shrink-0 flex-col items-end gap-1">
                {i.crp && i.status === "pending" ? (
                  <>
                    <CritBadge />
                    <span className={`text-xs whitespace-nowrap ${breached ? "text-crit-hi" : "text-warn-hi"}`}>
                      {breached ? "SLA breached" : `SLA ${mmss(Date.parse(i.crp.slaDeadline) - now)}`}
                      <span className="text-muted"> · {i.crp.signoffs.length}/2 signed</span>
                    </span>
                  </>
                ) : i.status === "pending" && grading ? (
                  <Badge tone="info">Grading</Badge>
                ) : (
                  <StatusPill status={i.status} />
                )}
              </div>
            </button>
          </li>
        );
      })}
    </ul>
  );
}
