"use client";
// App shell: header with three tabs. Opening a threat shows its story in place of the tab.
import { useState } from "react";
import { RotateCcw, Shield } from "lucide-react";
import { reduce } from "@/lib/simulation/engine";
import { SCENARIOS } from "@/lib/simulation/scenarios";
import { counts } from "@/lib/simulation/selectors";
import ActivityLog from "./ActivityLog";
import FirewallView from "./FirewallView";
import IncidentStory from "./IncidentStory";
import Overview from "./Overview";
import { PERSONAS, SimulationProvider, useSimulation } from "./simulation/SimulationProvider";

type Tab = "overview" | "firewall" | "activity";
const TABS: [Tab, string][] = [
  ["overview", "Overview"],
  ["firewall", "Firewall"],
  ["activity", "Activity log"],
];

function App() {
  const { state, dispatch, persona, setPersona } = useSimulation();
  const [tab, setTab] = useState<Tab>("overview");
  const [openId, setOpenId] = useState<string | null>(null);
  const waiting = counts(state).awaitingReview;
  const [notice, setNotice] = useState<string | null>(null);

  const launch = (id: string) => {
    const sc = SCENARIOS.find((s) => s.id === id)!;
    const action = { type: "INGEST", packet: sc.packet, scenarioId: sc.id } as const;
    // The reducer is pure, so previewing it tells us what this connection will do.
    const preview = reduce(state, action);
    dispatch(action);
    if (preview.incidents.length > state.incidents.length) {
      setNotice(null);
      setOpenId(preview.incidents[0].id);
    } else {
      setNotice(preview.traffic[0].verdict === "BLOCKED" ? `“${sc.name}” was blocked by an approved fix before it reached the network.` : `“${sc.name}” passed every check and was allowed. No threat, no action needed.`);
    }
  };

  return (
    <div className="min-h-full">
      <header className="sticky top-0 z-20 border-b border-line bg-bg/90 backdrop-blur">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center gap-x-6 gap-y-3 px-6 py-3">
          <div className="flex items-center gap-3">
            <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-neon/20">
              <Shield className="h-5 w-5 text-neon-hi" />
            </span>
            <div>
              <p className="text-xl font-bold leading-tight tracking-tight">Shield<span className="text-neon-hi">Ops</span></p>
              <p className="text-xs text-muted">Cisco Digital Shield · HackNCAT 10.0</p>
            </div>
          </div>

          <nav className="flex gap-1" aria-label="Sections">
            {TABS.map(([key, label]) => {
              const active = tab === key && !openId;
              return (
                <button
                  key={key}
                  onClick={() => {
                    setTab(key);
                    setOpenId(null);
                  }}
                  aria-current={active ? "page" : undefined}
                  className={`relative rounded-lg px-4 py-2 text-sm font-medium ${active ? "bg-panel-2 text-ink" : "text-muted hover:text-ink"}`}
                >
                  {label}
                  {key === "overview" && waiting > 0 && <span className="ml-2 rounded-full bg-neon px-1.5 text-xs text-white">{waiting}</span>}
                </button>
              );
            })}
          </nav>

          <div className="ml-auto flex items-center gap-3">
            <span className="hidden rounded-full border border-line px-3 py-1 text-xs text-muted xl:inline">Simulation · synthetic data</span>
            <select value={persona} onChange={(e) => setPersona(e.target.value)} aria-label="Demo persona" className="h-9 rounded-lg border border-line bg-panel px-2 text-sm">
              {PERSONAS.map((p) => (
                <option key={p}>{p}</option>
              ))}
            </select>
            <button
              onClick={() => {
                setOpenId(null);
                setNotice(null);
                dispatch({ type: "RESET" });
              }}
              className="flex items-center gap-1.5 rounded-lg px-3 py-2 text-sm text-muted hover:bg-panel-2 hover:text-ink"
            >
              <RotateCcw className="h-4 w-4" /> Reset
            </button>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-6 py-8">
        {state.lastError && <p className="mb-6 rounded-xl bg-red-500/10 px-4 py-3 text-red-200">Not allowed: {state.lastError}</p>}
        {notice && !openId && (
          <p className="mb-6 flex items-center justify-between gap-4 rounded-xl bg-emerald-500/10 px-4 py-3 text-emerald-200">
            {notice}
            <button onClick={() => setNotice(null)} className="text-sm text-emerald-300/70 hover:text-emerald-200">
              Dismiss
            </button>
          </p>
        )}
        {openId ? (
          <IncidentStory id={openId} onBack={() => setOpenId(null)} />
        ) : tab === "overview" ? (
          <Overview onLaunch={launch} onOpen={setOpenId} />
        ) : tab === "firewall" ? (
          <FirewallView />
        ) : (
          <ActivityLog />
        )}
      </main>
    </div>
  );
}

export default function Dashboard() {
  return (
    <SimulationProvider>
      <App />
    </SimulationProvider>
  );
}
