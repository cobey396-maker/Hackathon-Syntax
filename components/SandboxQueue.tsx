import type { SandboxItem } from "@/lib/types";
import { hhmmss, Panel, SeverityBadge, StatusPill, td, th } from "./ui";

export default function SandboxQueue({
  items,
  now,
  onOpen,
}: {
  items: SandboxItem[];
  now: number;
  onOpen: (id: string) => void;
}) {
  // Pending first, then by severity (highest first), then newest
  const rows = [...items].sort(
    (a, b) =>
      Number(b.status === "pending") - Number(a.status === "pending") ||
      b.severity - a.severity ||
      b.ts.localeCompare(a.ts),
  );

  return (
    <Panel title="Active Sandbox Queue" right={<span className="text-xs text-muted">click a row to inspect · times UTC</span>}>
      {rows.length === 0 ? (
        <p className="p-8 text-center text-sm text-muted">No intercepted packets yet. Start the traffic simulator.</p>
      ) : (
        <table className="w-full">
          <thead>
            <tr>
              <th className={th}>Timestamp</th>
              <th className={th}>ID</th>
              <th className={th}>Source IP</th>
              <th className={th}>Packet Type</th>
              <th className={th}>Severity</th>
              <th className={th}>Threat Confidence</th>
              <th className={th}>Status</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((i) => {
              const fresh = now - Date.parse(i.ts) < 6000;
              return (
                <tr
                  key={i.id}
                  onClick={() => onOpen(i.id)}
                  className={`cursor-pointer border-t border-line hover:bg-cisco-deep/30 ${fresh ? "bg-red-500/10" : ""}`}
                >
                  <td className={`${td} font-mono text-muted`}>
                    {hhmmss(i.ts)}
                    {fresh && <span className="ml-2 animate-pulse rounded bg-red-500 px-1 text-xs font-bold text-white">NEW</span>}
                  </td>
                  <td className={`${td} font-mono`}>{i.id}</td>
                  <td className={`${td} font-mono`}>{i.srcIp}</td>
                  <td className={td}>{i.packetType}</td>
                  <td className={td}>
                    <SeverityBadge value={i.severity} />
                  </td>
                  <td className={td}>
                    <div className="flex items-center gap-2">
                      <div className="h-1.5 w-20 rounded bg-line">
                        <div className="h-1.5 rounded bg-cisco" style={{ width: `${i.confidence}%` }} />
                      </div>
                      <span className="font-mono">{i.confidence}%</span>
                    </div>
                  </td>
                  <td className={td}>
                    <StatusPill status={i.status} />
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      )}
    </Panel>
  );
}
