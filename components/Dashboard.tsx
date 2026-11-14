"use client";
import { useState } from "react";
import { RotateCcw, Send } from "lucide-react";
import { reduce } from "@/lib/simulation/engine";
import { SCENARIOS } from "@/lib/simulation/scenarios";
import { counts } from "@/lib/simulation/selectors";
import AuditLedger from "./AuditLedger";
import FirewallView from "./FirewallView";
import IncidentPanel from "./IncidentPanel";
import SandboxQueue from "./SandboxQueue";
import Sidebar, { type View } from "./Sidebar";
import { SimulationProvider, useSimulation } from "./simulation/SimulationProvider";
import Topology from "./Topology";
import TrafficFeed from "./TrafficFeed";

function Console() {
  const { state, dispatch } = useSimulation();
  const [view, setView] = useState<View>("queue");
  const [openId, setOpenId] = useState<string | null>(null);
  const c = counts(state);

  const launch = (id: string) => {
    const sc = SCENARIOS.find((s) => s.id === id)!;
    const action = { type: "INGEST", packet: sc.packet, scenarioId: sc.id } as const;
    // The reducer is pure, so previewing it tells us whether this packet opens an incident.
    const preview = reduce(state, action);
    dispatch(action);
    if (preview.incidents.length > state.incidents.length) setOpenId(preview.incidents[0].id);
  };

  const kpis: [string, number, string?][] = [
    ["Packets analyzed", c.analyzed],
    ["Allowed", c.allowed, "text-emerald-400"],
    ["Blocked by policy", c.blocked, "text-neon-hi"],
    ["Incidents", c.detected, "text-red-400"],
    ["Active quarantines", c.quarantined, c.quarantined ? "text-orange-300" : undefined],
    ["Awaiting review", c.awaitingReview, c.awaitingReview ? "text-amber-300" : undefined],
    ["Verified patches", c.verified, "text-emerald-300"],
    ["Rolled back", c.rolledBack, c.rolledBack ? "text-amber-200" : undefined],
  ];

  return (
    <div className="h-full">
      <Sidebar view={view} onView={setView} pending={c.awaitingReview} />

      <main className="flex h-full flex-col gap-px overflow-auto bg-line pl-64">
        <div className="grid shrink-0 grid-cols-4 bg-panel lg:grid-cols-8">
          {kpis.map(([label, value, color]) => (
            <div key={label} className="border-r border-b px-4 py-2.5 last:border-r-0">
              <p className="text-xs tracking-wider text-dim uppercase">{label}</p>
              <p className={`mt-0.5 font-mono text-lg font-medium tabular-nums ${color ?? "text-ink"}`}>{value}</p>
            </div>
          ))}
        </div>

        {/* Phase 1 scenario launcher: every button sends a fixed synthetic packet through the engine. */}
        <div className="flex shrink-0 flex-wrap items-center gap-2 bg-panel px-4 py-3">
          <span className="mr-2 text-xs font-semibold tracking-wider text-dim uppercase">Launch scenario</span>
          {SCENARIOS.map((s) => (
            <button key={s.id} onClick={() => launch(s.id)} title={s.summary} className="flex items-center gap-1.5 border px-2.5 py-1.5 text-xs text-muted hover:border-neon hover:text-ink">
              <Send className="h-3 w-3" />
              {s.name}
            </button>
          ))}
          <button onClick={() => { setOpenId(null); dispatch({ type: "RESET" }); }} className="ml-auto flex items-center gap-1.5 px-2.5 py-1.5 text-xs text-dim hover:text-ink">
            <RotateCcw className="h-3 w-3" /> Reset simulation
          </button>
        </div>

        {state.lastError && !openId && <p className="shrink-0 bg-red-500/10 px-4 py-2 font-mono text-xs text-red-300">Engine refused: {state.lastError}</p>}

        {view === "queue" && (
          <>
            <Topology />
            <SandboxQueue onOpen={setOpenId} />
          </>
        )}
        {view === "firewall" && <FirewallView />}
        {view === "ledger" && <AuditLedger />}
        {view === "traffic" && <TrafficFeed />}
      </main>

      {openId && <IncidentPanel id={openId} onClose={() => setOpenId(null)} />}
    </div>
  );
}

export default function Dashboard() {
  return (
    <SimulationProvider>
      <Console />
    </SimulationProvider>
  );
}
