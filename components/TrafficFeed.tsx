"use client";
import { useSimulation } from "./simulation/SimulationProvider";
import { Pane, simTime, td, th } from "./soc";

const VERDICT = {
  ALLOWED: <span className="text-emerald-400">ALLOWED</span>,
  BLOCKED: <span className="text-neon-hi">BLOCKED BY POLICY</span>,
  FLAGGED: <span className="text-red-400">FLAGGED → INCIDENT</span>,
};

export default function TrafficFeed() {
  const { state } = useSimulation();
  return (
    <Pane title="Synthetic Traffic" meta={<span>{state.traffic.length} packets evaluated in-browser</span>} className="flex-1">
      <table className="w-full">
        <thead>
          <tr>
            {["Packet", "Sim time", "Source", "User", "Protocol", "Verdict", "Detail"].map((h) => (
              <th key={h} className={th}>
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {state.traffic.map((t) => {
            const p = state.packets[t.packetId];
            return (
              <tr key={t.packetId} className="border-b border-line/60">
                <td className={`${td} font-mono text-dim`}>{p.id}</td>
                <td className={`${td} font-mono text-muted`}>{simTime(t.tick)}</td>
                <td className={`${td} font-mono`}>{p.srcIp}</td>
                {/* Minimise surveillance: usernames on benign traffic are masked. */}
                <td className={`${td} font-mono`}>{t.verdict === "ALLOWED" ? p.user.slice(0, 1) + "•••" : p.user}</td>
                <td className={td}>{p.protocol}</td>
                <td className={`${td} font-mono text-xs font-semibold`}>{VERDICT[t.verdict]}</td>
                <td className={`${td} text-xs text-muted`}>{t.detail}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </Pane>
  );
}
