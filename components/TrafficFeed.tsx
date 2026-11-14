import type { TrafficEvent } from "@/lib/types";
import { hhmmss, Pane, Sev, td, th } from "./soc";

export default function TrafficFeed({ traffic }: { traffic: TrafficEvent[] }) {
  return (
    <Pane title="Live Traffic" meta={<span>last {traffic.length} handshakes seen by the AI</span>} className="flex-1">
      <table className="w-full">
        <thead>
          <tr>
            {["#", "Time (UTC)", "Source", "User", "Protocol", "AI verdict", "Latency", "Sev"].map((h) => (
              <th key={h} className={th}>
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {traffic.map((t) => (
            <tr key={t.seq} className={`border-b border-line/60 ${t.verdict === "sandboxed" ? "bg-red-500/5" : ""}`}>
              <td className={`${td} font-mono text-dim`}>{t.seq}</td>
              <td className={`${td} font-mono text-muted`}>{hhmmss(t.ts)}</td>
              <td className={`${td} font-mono`}>{t.srcIp}</td>
              <td className={`${td} font-mono`}>{t.user}</td>
              <td className={td}>{t.protocol}</td>
              <td className={`${td} font-mono text-xs font-semibold`}>
                {t.verdict === "allowed" ? <span className="text-emerald-400">PASS → FIREWALL</span> : <span className="text-red-400">HOLD → SANDBOX</span>}
              </td>
              <td className={`${td} font-mono text-muted`}>{t.verdictMs.toFixed(2)} ms</td>
              <td className={td}>{t.verdict === "sandboxed" ? <Sev value={t.severity} /> : <span className="text-dim">—</span>}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </Pane>
  );
}
