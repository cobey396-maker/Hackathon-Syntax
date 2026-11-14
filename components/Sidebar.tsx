"use client";
import { Activity, Flame, ScrollText, Shield, ShieldAlert } from "lucide-react";
import { tickToIso } from "@/lib/simulation/engine";
import { PERSONAS, useSimulation } from "./simulation/SimulationProvider";

export type View = "queue" | "firewall" | "ledger" | "traffic";

const NAV = [
  { key: "queue", label: "Threat Queue", icon: ShieldAlert },
  { key: "firewall", label: "Virtual Firewall", icon: Flame },
  { key: "ledger", label: "Audit Log", icon: ScrollText },
  { key: "traffic", label: "Synthetic Traffic", icon: Activity },
] as const;

export default function Sidebar({ view, onView, pending }: { view: View; onView: (v: View) => void; pending: number }) {
  const { state, persona, setPersona } = useSimulation();

  return (
    <aside className="fixed inset-y-0 left-0 flex w-64 flex-col border-r bg-panel">
      <div className="flex items-center gap-3 border-b px-5 py-4">
        <div className="flex h-8 w-8 items-center justify-center border border-neon/60 bg-neon/10">
          <Shield className="h-4 w-4 text-neon-hi" />
        </div>
        <div>
          <p className="text-sm font-semibold tracking-tight">Virtual Patch Sandbox</p>
          <p className="font-mono text-xs text-dim">DIGITAL SHIELD · SIMULATION</p>
        </div>
      </div>

      <nav className="flex flex-col py-3" aria-label="Sections">
        <p className="px-5 pb-2 text-xs font-semibold tracking-wider text-dim uppercase">Operations</p>
        {NAV.map((n) => {
          const active = view === n.key;
          return (
            <button
              key={n.key}
              onClick={() => onView(n.key)}
              aria-current={active ? "page" : undefined}
              className={`flex items-center gap-3 border-l-2 px-5 py-2.5 text-left text-sm transition-colors ${
                active ? "border-neon bg-neon/10 text-ink" : "border-transparent text-muted hover:bg-panel-2 hover:text-ink"
              }`}
            >
              <n.icon className={`h-4 w-4 ${active ? "text-neon-hi" : ""}`} />
              {n.label}
              {n.key === "queue" && pending > 0 && <span className="ml-auto bg-neon px-1.5 font-mono text-xs font-semibold text-white">{pending}</span>}
            </button>
          );
        })}
      </nav>

      <div className="mt-auto space-y-4 border-t p-5">
        <label className="block">
          <span className="text-xs font-semibold tracking-wider text-dim uppercase">Demo persona</span>
          <select value={persona} onChange={(e) => setPersona(e.target.value)} className="mt-1.5 h-8 w-full border bg-bg px-2 text-sm text-ink focus:border-neon focus:outline-none">
            {PERSONAS.map((a) => (
              <option key={a}>{a}</option>
            ))}
          </select>
          <span className="mt-1 block text-xs text-dim">Not authenticated. Frontend-only demo.</span>
        </label>
        <div className="font-mono text-xs text-muted">
          <div className="flex items-center gap-2">
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
            IN-BROWSER SIM
            <span className="ml-auto tabular-nums text-dim">{tickToIso(state.tick).slice(11, 19)}</span>
          </div>
          <p className="mt-1 text-dim">synthetic data · no real network</p>
        </div>
      </div>
    </aside>
  );
}
