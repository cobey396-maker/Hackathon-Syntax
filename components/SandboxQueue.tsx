"use client";
import { useSimulation } from "./simulation/SimulationProvider";
import { ContainmentPill, Pane, Risk, simTime, StatusPill, td, th } from "./soc";

export default function SandboxQueue({ onOpen }: { onOpen: (id: string) => void }) {
  const { state } = useSimulation();
  const rows = state.incidents;

  return (
    <Pane title="Threat Queue" meta={<span>{rows.length} incidents · click a row to investigate</span>} className="flex-1">
      {rows.length === 0 ? (
        <p className="p-8 text-center text-sm text-muted">No incidents yet. Launch a scenario above to send synthetic traffic through the detector.</p>
      ) : (
        <table className="w-full">
          <thead>
            <tr>
              {["Sim time", "Incident", "Packet", "Source", "Protocol", "Risk", "Status", "Containment"].map((h) => (
                <th key={h} className={th}>
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((i) => {
              const p = state.packets[i.packetId];
              return (
                <tr
                  key={i.id}
                  tabIndex={0}
                  onClick={() => onOpen(i.id)}
                  onKeyDown={(e) => e.key === "Enter" && onOpen(i.id)}
                  className="cursor-pointer border-b border-line/60 transition-colors hover:bg-neon/5 focus:bg-neon/10 focus:outline-none"
                >
                  <td className={`${td} font-mono text-muted`}>{simTime(i.createdTick)}</td>
                  <td className={`${td} font-mono`}>{i.id}</td>
                  <td className={`${td} font-mono text-muted`}>{p.id}</td>
                  <td className={`${td} font-mono`}>{p.srcIp}</td>
                  <td className={td}>{p.protocol}</td>
                  <td className={td}>
                    <Risk level={i.detection.risk} score={i.detection.score} />
                  </td>
                  <td className={td}>
                    <StatusPill status={i.status} />
                  </td>
                  <td className={td}>
                    <ContainmentPill c={i.containment} />
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
