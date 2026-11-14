import type { SandboxItem } from "@/lib/types";
import { Confidence, hhmmss, Pane, Sev, StatusPill, td, th } from "./soc";

export default function SandboxQueue({ items, now, onOpen }: { items: SandboxItem[]; now: number; onOpen: (id: string) => void }) {
  // Pending first, newest first
  const rows = [...items].sort((a, b) => Number(b.status === "pending") - Number(a.status === "pending") || b.ts.localeCompare(a.ts));

  return (
    <Pane title="Active Sandbox Queue" meta={<span>{rows.length} intercepted · click a row to inspect</span>} className="flex-1">
      {rows.length === 0 ? (
        <p className="p-8 text-center text-sm text-muted">
          No packets held. In the simulator terminal, press <kbd className="border bg-bg px-1.5 font-mono text-ink">z</kbd> to inject a zero-day handshake.
        </p>
      ) : (
        <table className="w-full">
          <thead>
            <tr>
              {["Timestamp", "ID", "Source IP", "Packet Type", "Threat Confidence", "Severity", "Status"].map((h) => (
                <th key={h} className={th}>
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((i) => {
              const fresh = i.status === "pending" && now - Date.parse(i.ts) < 6000;
              return (
                <tr
                  key={i.id}
                  onClick={() => onOpen(i.id)}
                  className={`cursor-pointer border-b border-line/60 transition-colors hover:bg-neon/5 ${fresh ? "animate-pulse bg-red-500/10" : ""}`}
                >
                  <td className={`${td} font-mono text-muted`}>
                    {hhmmss(i.ts)}
                    {fresh && <span className="ml-2 bg-red-500 px-1 font-mono text-xs font-bold text-white">NEW</span>}
                  </td>
                  <td className={`${td} font-mono`}>{i.id}</td>
                  <td className={`${td} font-mono`}>{i.srcIp}</td>
                  <td className={td}>{i.protocol} handshake</td>
                  <td className={td}>
                    <Confidence value={i.confidence} />
                  </td>
                  <td className={td}>
                    <Sev value={i.severity} bar />
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
    </Pane>
  );
}
