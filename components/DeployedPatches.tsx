import type { DeployedPatch } from "@/lib/types";
import { hhmmss, Pane, td, th } from "./soc";

// Virtual patches an analyst approved. They run at the edge before the AI: a match is refused outright.
export default function DeployedPatches({ deployed, now }: { deployed: DeployedPatch[]; now: number }) {
  const hits = deployed.reduce((s, d) => s + d.hits, 0);
  return (
    <Pane
      title="Deployed Virtual Patches"
      meta={
        <span>
          {deployed.length} live at edge · {hits} refused
        </span>
      }
      className="max-h-72 shrink-0"
    >
      {deployed.length === 0 ? (
        <p className="p-5 text-center text-sm text-muted">No patches live. Approve a held packet to deploy its rules to the edge.</p>
      ) : (
        <table className="w-full">
          <thead>
            <tr>
              {["Rule", "Drop conditions", "Source", "Approved by", "Deployed", "Hits", "Last hit"].map((h) => (
                <th key={h} className={`${th} ${h === "Hits" ? "text-right" : ""}`}>
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {deployed.map((d) => {
              const hot = d.lastHit !== null && now - Date.parse(d.lastHit) < 4000;
              return (
                <tr key={d.ruleId} className={`border-b border-line/60 align-top transition-colors ${hot ? "bg-neon/10" : ""}`}>
                  <td className={`${td} font-mono whitespace-nowrap`}>
                    <span className="mr-2 inline-block h-1.5 w-1.5 rounded-full bg-neon align-middle" />
                    {d.ruleId}
                  </td>
                  <td className={`${td} font-mono text-xs text-cisco`}>
                    {d.conds.map((c) => (
                      <div key={c}>drop if {c}</div>
                    ))}
                  </td>
                  <td className={`${td} font-mono whitespace-nowrap`}>
                    {d.srcIp}
                    <span className={`ml-2 text-xs ${d.srcBlocked ? "text-red-400" : "text-dim"}`}>{d.srcBlocked ? "ACL DENY" : "rules only"}</span>
                  </td>
                  <td className={`${td} whitespace-nowrap text-muted`}>{d.analyst}</td>
                  <td className={`${td} font-mono text-muted`}>{hhmmss(d.deployedAt)}</td>
                  <td className={`${td} text-right font-mono font-semibold tabular-nums ${d.hits ? "text-neon-hi" : "text-dim"}`}>{d.hits}</td>
                  <td className={`${td} font-mono text-xs whitespace-nowrap ${hot ? "text-neon-hi" : "text-muted"}`}>
                    {d.lastHit ? `${hhmmss(d.lastHit)} REFUSED` : "—"}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      )}
    </Pane>
  );
}
