"use client";
// Scrolling feed of the most recent connections, newest sliding in from the left.
// Usernames on normal traffic are masked: ShieldOps only shows identity when there is a reason to.
import { Pause, Play } from "lucide-react";
import { useSimulation } from "./simulation/SimulationProvider";

const STYLE = {
  ALLOWED: { dot: "bg-emerald-400", label: "let in", text: "text-emerald-300" },
  BLOCKED: { dot: "bg-red-400", label: "blocked", text: "text-red-300" },
  FLAGGED: { dot: "bg-amber-400", label: "to sandbox", text: "text-amber-200" },
};

export default function LiveTicker() {
  const { state, live, setLive } = useSimulation();
  const rows = state.traffic.slice(0, 6);
  return (
    <div className="flex items-center gap-4 overflow-hidden rounded-2xl border border-line bg-panel/80 px-4 py-3 backdrop-blur">
      <button onClick={() => setLive(!live)} className="flex shrink-0 items-center gap-2 rounded-full border border-line px-3 py-1 text-sm hover:border-neon" aria-pressed={live}>
        {live ? <span className="live-dot h-2 w-2 rounded-full bg-emerald-400" /> : <span className="h-2 w-2 rounded-full bg-dim" />}
        <span className="font-semibold">{live ? "Live traffic" : "Paused"}</span>
        {live ? <Pause className="h-3.5 w-3.5 text-muted" /> : <Play className="h-3.5 w-3.5 text-muted" />}
      </button>
      <ol className="flex min-w-0 gap-3 [mask-image:linear-gradient(to_right,black_80%,transparent)]">
        {rows.length === 0 && <li className="text-sm text-muted">Waiting for connections…</li>}
        {rows.map((t) => {
          const p = state.packets[t.packetId];
          const s = STYLE[t.verdict];
          return (
            <li key={t.packetId} className="flex shrink-0 items-center gap-2 rounded-full bg-bg/70 px-3 py-1 text-sm animate-in fade-in-0 slide-in-from-left-4 duration-500">
              <span className={`h-2 w-2 rounded-full ${s.dot}`} />
              <span className="font-mono text-xs text-muted">{p.srcIp}</span>
              <span className="text-dim">{t.verdict === "ALLOWED" ? "user •••" : p.user}</span>
              <span className={s.text}>{s.label}</span>
            </li>
          );
        })}
      </ol>
    </div>
  );
}
