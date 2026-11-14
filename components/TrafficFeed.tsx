import type { TrafficEvent } from "@/lib/types";
import { hhmmss, Panel, SeverityBadge, td, th } from "./ui";

export default function TrafficFeed({ traffic }: { traffic: TrafficEvent[] }) {
  return (
    <Panel title="Live Traffic" right={<span className="text-xs text-muted">last 50 VPN handshakes</span>}>
      <table className="w-full">
        <thead>
          <tr>
            <th className={th}>Time (UTC)</th>
            <th className={th}>Source IP</th>
            <th className={th}>User</th>
            <th className={th}>Protocol</th>
            <th className={th}>Verdict</th>
          </tr>
        </thead>
        <tbody>
          {traffic.map((t, i) => (
            <tr key={t.ts + i} className="border-t border-line">
              <td className={`${td} font-mono text-muted`}>{hhmmss(t.ts)}</td>
              <td className={`${td} font-mono`}>{t.srcIp}</td>
              <td className={`${td} font-mono`}>{t.user}</td>
              <td className={td}>{t.protocol}</td>
              <td className={td}>
                {t.verdict === "allowed" ? (
                  <span className="text-emerald-400">Allowed</span>
                ) : (
                  <span className="flex items-center gap-2 text-red-400">
                    Sandboxed <SeverityBadge value={t.severity} />
                  </span>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </Panel>
  );
}
