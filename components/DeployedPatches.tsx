import { ShieldOff, ShieldPlus } from "lucide-react";
import type { DeployedPatch } from "@/lib/types";
import { Badge, Empty, hhmmss, mmss } from "./soc";

// What is live at the edge: virtual patches an analyst approved, and automatic critical quarantines.
// They run before the AI: a match is refused outright.
export default function DeployedPatches({ deployed, now }: { deployed: DeployedPatch[]; now: number }) {
  if (deployed.length === 0) return <Empty>No fixes live yet. Approve a held threat to deploy its rules to the edge.</Empty>;

  return (
    <ul className="grid max-h-96 gap-3 overflow-y-auto pr-1">
      {deployed.map((d) => {
        const q = d.kind === "quarantine";
        const hot = d.lastHit !== null && now - Date.parse(d.lastHit) < 4000;
        const Icon = q ? ShieldOff : ShieldPlus;
        return (
          <li key={d.ruleId} className={`flex flex-wrap items-start gap-x-5 gap-y-3 rounded-xl p-4 transition-colors ${hot ? "bg-warn/20" : q ? "bg-warn/10" : "bg-cisco/10"}`}>
            <span className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${q ? "bg-warn/20 text-warn-hi" : "bg-cisco/20 text-sky"}`}>
              <Icon className="h-5 w-5" />
            </span>
            <div className="min-w-0 flex-1 basis-72">
              {q ? (
                <p className="text-lg font-medium break-words">All traffic from {d.srcIp} is quarantined while two analysts review {d.itemId}</p>
              ) : (
                d.conds.map((c) => (
                  <p key={c} className="font-mono text-sm break-words text-ink">
                    drop if {c}
                  </p>
                ))
              )}
              <p className="mt-1 text-sm break-words text-muted">
                {d.ruleId} · {q ? "placed by" : "approved by"} {d.analyst} · {hhmmss(d.deployedAt)} UTC
                {!q && ` · source ${d.srcIp}`}
              </p>
              {q && <p className="text-sm text-warn-hi">{d.expiresAt ? `Lifts automatically in ${mmss(Math.max(0, Date.parse(d.expiresAt) - now))} unless an analyst confirms it` : "Confirmed by an analyst · holds until the second signature"}</p>}
            </div>
            <div className="flex shrink-0 flex-col items-end gap-1.5">
              {d.srcBlocked ? <Badge tone="crit">Source blocked</Badge> : <Badge>Rules only</Badge>}
              <p className={`text-sm whitespace-nowrap ${d.hits ? "font-semibold text-warn-hi" : "text-dim"}`}>
                {d.hits} repeat{d.hits === 1 ? "" : "s"} refused
                {d.lastHit && <span className="font-normal text-muted"> · last {hhmmss(d.lastHit)}</span>}
              </p>
            </div>
          </li>
        );
      })}
    </ul>
  );
}
