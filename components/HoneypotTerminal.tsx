"use client";
// Mock terminal. Idle until "Simulate blast radius" is clicked, then types the replay and
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
    running: ["asa-parser-sim · running", "border-line text-muted"],
    crashed: ["asa-parser-sim · PROCESS TERMINATED (SIGSEGV)", "animate-shake animate-flash border-crit text-crit-hi"],
    degraded: ["asa-parser-sim · degraded (session table leak)", "animate-flash border-warn text-warn"],
    contained: [crashes ? "Crash reproduced · contained in sandbox" : "Fault reproduced · contained in sandbox", "border-ok/60 text-ok"],
  };

  const color = (l: string) =>
    l.includes("SIGSEGV") || l.includes("would have crashed")
      ? "text-crit-hi"
      : l.includes("WARN") || l.includes("exhaust")
        ? "text-warn"
        : l.includes("contained")
          ? "text-ok"
          : l.startsWith("$")
            ? "text-sky"
            : "text-muted";

  return (
    <div className="overflow-hidden rounded-xl border bg-black/40">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b bg-panel-2 px-3 py-2">
        <span className="min-w-0 truncate font-mono text-xs text-muted">honeypot://isolated-parser-01</span>
        {shown === 0 ? (
          <button
            onClick={() => setShown(1)}
            className="flex shrink-0 items-center gap-1.5 rounded-md border border-cisco px-3 py-1 text-xs font-semibold text-sky transition-colors hover:bg-cisco/15"
          >
            <Crosshair className="h-3.5 w-3.5" />
            Simulate blast radius
          </button>
        ) : (
          <button onClick={() => setShown(0)} disabled={!done} className="flex shrink-0 items-center gap-1.5 rounded-md px-2 py-1 text-xs text-muted hover:text-ink disabled:opacity-40">
            <RotateCcw className="h-3 w-3" />
            Reset
          </button>
        )}
      </div>

      <div className={`mx-3 mt-3 flex gap-2 rounded-md border px-3 py-1.5 font-mono text-xs transition-colors ${FW[fw][1]}`}>
        <span className="shrink-0 text-dim">Firewall</span>
        <span className="min-w-0 break-words">{FW[fw][0]}</span>
      </div>

      <pre className="h-44 overflow-auto p-3 font-mono text-xs leading-relaxed break-words whitespace-pre-wrap">
        {shown === 0 && <span className="font-sans text-sm text-dim">Detonate the held packet against an isolated copy of the firewall parser. Nothing leaves the sandbox.</span>}
        {visible.map((l, i) => (
          <div key={i} className={`${color(l)} animate-in fade-in-0 duration-200`}>
            {l}
          </div>
        ))}
        {shown > 0 && !done && <span className="animate-pulse text-sky">▌</span>}
      </pre>
    </div>
  );
}
