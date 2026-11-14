"use client";
// Mock terminal. Idle until "Simulate Blast Radius" is clicked, then types the replay and
// shows the simulated firewall crashing (red flash + shake) while the sandbox contains it.
import { useEffect, useState } from "react";
import { Crosshair, RotateCcw } from "lucide-react";

type FwState = "running" | "crashed" | "degraded" | "contained";

export default function HoneypotTerminal({ lines, crashes }: { lines: string[]; crashes: boolean }) {
  const [shown, setShown] = useState(0); // 0 = idle

  useEffect(() => {
    if (shown === 0 || shown >= lines.length) return;
    // linger on the crash/fault line so the firewall status change is visible
    const last = lines[shown - 1];
    const hold = last.includes("SIGSEGV") || last.includes("WARN") ? 1600 : 380;
    const t = setTimeout(() => setShown((n) => n + 1), hold);
    return () => clearTimeout(t);
  }, [shown, lines]);

  const visible = lines.slice(0, shown);
  const hitLine = visible.findIndex((l) => l.includes("SIGSEGV") || l.includes("WARN"));
  const done = shown >= lines.length;
  const fw: FwState = hitLine < 0 ? "running" : done ? "contained" : crashes ? "crashed" : "degraded";

  const FW: Record<FwState, [string, string]> = {
    running: ["asa-parser-sim · RUNNING", "border-line text-muted"],
    crashed: ["asa-parser-sim · PROCESS TERMINATED (SIGSEGV)", "animate-shake animate-flash border-red-500 text-red-300"],
    degraded: ["asa-parser-sim · DEGRADED (session table leak)", "animate-flash border-amber-500 text-amber-200"],
    contained: [crashes ? "crash reproduced · CONTAINED in sandbox" : "fault reproduced · CONTAINED in sandbox", "border-emerald-500/60 text-emerald-300"],
  };

  const color = (l: string) =>
    l.includes("SIGSEGV") || l.includes("would have crashed")
      ? "text-red-400"
      : l.includes("WARN") || l.includes("exhaust")
        ? "text-amber-300"
        : l.includes("contained")
          ? "text-emerald-400"
          : l.startsWith("$")
            ? "text-cisco"
            : "text-muted";

  return (
    <div className="border bg-black">
      <div className="flex items-center gap-1.5 border-b bg-panel-2 px-3 py-1.5">
        <span className="h-2.5 w-2.5 rounded-full bg-red-500/70" />
        <span className="h-2.5 w-2.5 rounded-full bg-amber-500/70" />
        <span className="h-2.5 w-2.5 rounded-full bg-emerald-500/70" />
        <span className="ml-2 font-mono text-xs text-dim">honeypot://isolated-parser-01</span>
        <div className="ml-auto">
          {shown === 0 ? (
            <button
              onClick={() => setShown(1)}
              className="flex items-center gap-1.5 border border-cisco px-2.5 py-1 font-mono text-xs font-semibold text-cisco hover:bg-cisco/10"
            >
              <Crosshair className="h-3.5 w-3.5" />
              Simulate Blast Radius
            </button>
          ) : (
            <button
              onClick={() => setShown(0)}
              disabled={!done}
              className="flex items-center gap-1.5 px-2 py-1 font-mono text-xs text-dim hover:text-ink disabled:opacity-40"
            >
              <RotateCcw className="h-3 w-3" />
              reset
            </button>
          )}
        </div>
      </div>

      <div className={`mx-3 mt-3 border px-3 py-1.5 font-mono text-xs transition-colors ${FW[fw][1]}`}>
        <span className="text-dim">FIREWALL </span>
        {FW[fw][0]}
      </div>

      <pre className="h-44 overflow-auto p-3 font-mono text-xs leading-relaxed whitespace-pre-wrap">
        {shown === 0 && <span className="text-dim">Detonate the held packet against an isolated copy of the firewall parser. Nothing leaves the sandbox.</span>}
        {visible.map((l, i) => (
          <div key={i} className={`${color(l)} animate-in fade-in-0 duration-200`}>
            {l}
          </div>
        ))}
        {shown > 0 && !done && <span className="animate-pulse text-cisco">▌</span>}
      </pre>
    </div>
  );
}
