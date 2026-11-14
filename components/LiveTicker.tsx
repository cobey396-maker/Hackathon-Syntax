// Scrolling feed of the most recent handshakes, newest sliding in from the left.
// Usernames on normal traffic are masked: identity only shows when there is a reason to.
import { Pause, Play } from "lucide-react";
import type { TrafficEvent } from "@/lib/types";

const STYLE = {
  allowed: { dot: "bg-ok", label: "let in", text: "text-ok-hi" },
  blocked: { dot: "bg-warn", label: "refused at edge", text: "text-warn-hi" },
  sandboxed: { dot: "bg-crit", label: "to Holding Center", text: "text-crit-hi" },
};

export default function LiveTicker({ traffic, live, onLive }: { traffic: TrafficEvent[]; live: boolean; onLive: (on: boolean) => void }) {
  const rows = traffic.slice(0, 6);
  return (
    <div className="flex items-center gap-4 overflow-hidden rounded-2xl border bg-panel/80 px-4 py-3 backdrop-blur">
      <button onClick={() => onLive(!live)} className="flex shrink-0 items-center gap-2 rounded-full border px-3 py-1 text-sm hover:border-cisco" aria-pressed={live}>
        <span className={`h-2 w-2 rounded-full ${live ? "live-dot bg-ok" : "bg-dim"}`} />
        <span className="font-semibold">{live ? "Live traffic" : "Paused"}</span>
        {live ? <Pause className="h-3.5 w-3.5 text-muted" /> : <Play className="h-3.5 w-3.5 text-muted" />}
      </button>
      <ol className="fade-right flex min-w-0 gap-3">
        {rows.length === 0 && <li className="text-sm text-muted">Waiting for connections…</li>}
        {rows.map((t) => {
          const s = STYLE[t.verdict];
          return (
            <li key={t.seq} className="flex shrink-0 items-center gap-2 rounded-full bg-bg/70 px-3 py-1 text-sm animate-in fade-in-0 slide-in-from-left-4 duration-500">
              <span className={`h-2 w-2 rounded-full ${s.dot}`} />
              <span className="font-mono text-xs text-muted">{t.srcIp}</span>
              <span className="text-dim">{t.verdict === "allowed" ? "user •••" : t.user}</span>
              <span className={s.text}>{s.label}</span>
            </li>
          );
        })}
      </ol>
    </div>
  );
}
