"use client";
import { useEffect, useState } from "react";
import { Activity, RotateCcw, ScrollText, Shield, ShieldAlert } from "lucide-react";

export type View = "queue" | "ledger" | "traffic";

const NAV = [
  { key: "queue", label: "Sandbox Queue", icon: ShieldAlert },
  { key: "ledger", label: "Audit Ledger", icon: ScrollText },
  { key: "traffic", label: "Live Traffic", icon: Activity },
] as const;

export default function Sidebar({
  view,
  onView,
  pending,
  simOnline,
  analyst,
  analysts,
  onAnalyst,
  onReset,
  autoTraffic,
  onAutoTraffic,
  onKey,
}: {
  view: View;
  onView: (v: View) => void;
  pending: number;
  simOnline: boolean;
  analyst: string;
  analysts: string[];
  onAnalyst: (a: string) => void;
  onReset: () => void;
  autoTraffic: boolean;
  onAutoTraffic: (on: boolean) => void;
  onKey: (k: "z" | "c" | "r") => void;
}) {
  // Two-step reset so a stray click mid-demo doesn't wipe the run
  const [arm, setArm] = useState(false);
  useEffect(() => {
    if (!arm) return;
    const t = setTimeout(() => setArm(false), 3000);
    return () => clearTimeout(t);
  }, [arm]);

  // UTC clock, started after mount so server and client markup match
  const [clock, setClock] = useState("--:--:--");
  useEffect(() => {
    const t = setInterval(() => setClock(new Date().toISOString().slice(11, 19)), 1000);
    return () => clearInterval(t);
  }, []);

  return (
    <aside className="fixed inset-y-0 left-0 flex w-64 flex-col border-r bg-panel">
      <div className="flex items-center gap-3 border-b px-5 py-4">
        <div className="flex h-8 w-8 items-center justify-center border border-neon/60 bg-neon/10">
          <Shield className="h-4 w-4 text-neon-hi" />
        </div>
        <div>
          <p className="text-sm font-semibold tracking-tight">Virtual Patch Sandbox</p>
          <p className="font-mono text-xs text-dim">DIGITAL SHIELD · SOC</p>
        </div>
      </div>

      <nav className="flex flex-col py-3">
        <p className="px-5 pb-2 text-xs font-semibold tracking-wider text-dim uppercase">Operations</p>
        {NAV.map((n) => {
          const active = view === n.key;
          return (
            <button
              key={n.key}
              onClick={() => onView(n.key)}
              className={`flex items-center gap-3 border-l-2 px-5 py-2.5 text-left text-sm transition-colors ${
                active ? "border-neon bg-neon/10 text-ink" : "border-transparent text-muted hover:bg-panel-2 hover:text-ink"
              }`}
            >
              <n.icon className={`h-4 w-4 ${active ? "text-neon-hi" : ""}`} />
              {n.label}
              {n.key === "queue" && pending > 0 && (
                <span className="ml-auto bg-neon px-1.5 font-mono text-xs font-semibold text-white">{pending}</span>
              )}
            </button>
          );
        })}
      </nav>

      <div className="mt-auto space-y-3 border-t p-5">
        <p className="text-xs font-semibold tracking-wider text-dim uppercase">Attack simulator</p>
        <div className="grid grid-cols-3 gap-1.5">
          {(
            [
              ["z", "Zero-day"],
              ["c", "Critical"],
              ["r", "Replay"],
            ] as const
          ).map(([k, label]) => (
            <button
              key={k}
              onClick={() => onKey(k)}
              title={`Press ${k.toUpperCase()}`}
              className="flex flex-col items-center border bg-bg py-1.5 hover:border-cisco hover:text-cisco"
            >
              <kbd className="font-mono text-sm font-semibold uppercase">{k}</kbd>
              <span className="text-xs text-dim">{label}</span>
            </button>
          ))}
        </div>
        <label className="flex cursor-pointer items-center justify-between font-mono text-xs text-muted">
          <span>Background logins</span>
          <input type="checkbox" checked={autoTraffic} onChange={(e) => onAutoTraffic(e.target.checked)} className="accent-cisco" />
        </label>
      </div>

      <div className="space-y-4 border-t p-5">
        <label className="block">
          <span className="text-xs font-semibold tracking-wider text-dim uppercase">Analyst on duty</span>
          <select
            value={analyst}
            onChange={(e) => onAnalyst(e.target.value)}
            className="mt-1.5 h-8 w-full border bg-bg px-2 text-sm text-ink focus:border-neon focus:outline-none"
          >
            {analysts.map((a) => (
              <option key={a}>{a}</option>
            ))}
          </select>
        </label>
        <div className="font-mono text-xs text-muted">
          <div className="flex items-center gap-2">
            <span className={`h-1.5 w-1.5 rounded-full ${simOnline ? "bg-emerald-400" : "bg-red-500"}`} />
            {simOnline ? "SENSOR LIVE" : "SENSOR OFFLINE"}
            <span className="ml-auto tabular-nums text-dim">{clock} UTC</span>
          </div>
        </div>
        <button
          onClick={() => {
            if (arm) {
              setArm(false);
              onReset();
            } else setArm(true);
          }}
          className={`flex w-full items-center justify-center gap-2 border px-3 py-1.5 font-mono text-xs transition-colors ${
            arm ? "border-red-500/70 bg-red-500/10 text-red-300" : "text-dim hover:text-ink"
          }`}
        >
          <RotateCcw className="h-3 w-3" />
          {arm ? "Click again to reset" : "Reset demo"}
        </button>
      </div>
    </aside>
  );
}
