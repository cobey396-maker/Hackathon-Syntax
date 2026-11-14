import type { TrafficEvent } from "@/lib/types";
import { Badge, Card, CardTitle, Empty, hhmmss, Sev, td, th, tr } from "./soc";

export default function TrafficFeed({ traffic }: { traffic: TrafficEvent[] }) {
  return (
    <Card>
      <CardTitle title="Live traffic" sub={`The last ${traffic.length} VPN handshakes the AI Shield inspected, newest first.`} />
      {traffic.length === 0 ? (
        <Empty>No traffic yet. Switch the header pill to LIVE, or start the Python simulator.</Empty>
      ) : (
        <div className="overflow-x-auto rounded-xl border bg-bg/40">
          <table className="w-full min-w-3xl border-collapse">
            <thead>
              <tr>
                {["#", "Time (UTC)", "Source", "User", "Protocol", "AI verdict", "Latency", "Severity"].map((h) => (
                  <th key={h} className={th}>
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {traffic.map((t) => (
                <tr key={t.seq} className={`${tr} ${t.verdict === "sandboxed" ? "bg-crit/10" : t.verdict === "blocked" ? "bg-warn/10" : ""}`}>
                  <td className={`${td} font-mono text-dim`}>{t.seq}</td>
                  <td className={`${td} font-mono text-muted`}>{hhmmss(t.ts)}</td>
                  <td className={`${td} font-mono`}>{t.srcIp}</td>
                  <td className={`${td} font-mono`}>{t.user}</td>
                  <td className={`${td} whitespace-nowrap`}>{t.protocol}</td>
                  <td className={td}>
                    {t.verdict === "allowed" ? <Badge tone="ok">Let in</Badge> : t.verdict === "blocked" ? <Badge tone="warn">Refused · {t.ruleId}</Badge> : <Badge tone="crit">Held in Holding Center</Badge>}
                  </td>
                  <td className={`${td} font-mono whitespace-nowrap text-muted`}>{t.verdictMs.toFixed(2)} ms</td>
                  <td className={td}>{t.verdict === "sandboxed" ? <Sev value={t.severity} /> : <span className="text-dim">—</span>}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </Card>
  );
}
