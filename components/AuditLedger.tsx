"use client";
import type { AuditEvent } from "@/lib/simulation/types";
import { useSimulation } from "./simulation/SimulationProvider";
import { Pane, simTime, td, th } from "./soc";

const OUTCOME: Record<AuditEvent["outcome"], string> = { ok: "text-emerald-400", warn: "text-amber-300", fail: "text-red-400" };

export function EventRows({ events }: { events: AuditEvent[] }) {
  return (
    <table className="w-full">
      <thead>
        <tr>
          {["Sim time", "Event", "Incident", "Type", "State change", "Actor", "Summary"].map((h) => (
            <th key={h} className={th}>
              {h}
            </th>
          ))}
        </tr>
      </thead>
      <tbody>
        {events.map((e) => (
          <tr key={e.id} className="border-b border-line/60 align-top">
            <td className={`${td} font-mono text-muted`}>{simTime(e.tick)}</td>
            <td className={`${td} font-mono text-dim`}>{e.id}</td>
            <td className={`${td} font-mono`}>{e.incidentId ?? "—"}</td>
            <td className={`${td} font-mono text-xs font-semibold ${OUTCOME[e.outcome]}`}>{e.type}</td>
            <td className={`${td} font-mono text-xs text-muted whitespace-nowrap`}>{e.to ? `${e.from ?? "∅"} → ${e.to}` : "—"}</td>
            <td className={`${td} ${e.actor === "system" ? "text-dim" : "text-neon-hi"}`}>{e.actor}</td>
            <td className={`${td} text-muted`}>{e.summary}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

export default function AuditLedger() {
  const { state } = useSimulation();
  return (
    <Pane title="Simulated Audit Log" className="flex-1" meta={<span>{state.events.length} events · in-browser demo data, not a tamper-proof ledger</span>}>
      {state.events.length === 0 ? (
        <p className="p-8 text-center text-sm text-muted">No events yet. Every simulation action writes an entry here.</p>
      ) : (
        <EventRows events={state.events} />
      )}
    </Pane>
  );
}
