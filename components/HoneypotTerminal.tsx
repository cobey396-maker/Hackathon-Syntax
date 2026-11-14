"use client";
import { useEffect, useState } from "react";

// Reveals lines one at a time. Remount with a new `key` to replay.
export default function HoneypotTerminal({ lines }: { lines: string[] }) {
  const [shown, setShown] = useState(0);

  useEffect(() => {
    const t = setInterval(() => setShown((n) => (n >= lines.length ? n : n + 1)), 450);
    return () => clearInterval(t);
  }, [lines.length]);

  const color = (l: string) =>
    l.includes("SIGSEGV") || l.includes("would have crashed")
      ? "text-red-400"
      : l.includes("WARN") || l.includes("exhaust")
        ? "text-amber-300"
        : l.includes("contained")
          ? "text-emerald-400"
          : l.startsWith("$")
            ? "text-cisco"
            : "text-slate-300";

  return (
    <div className="overflow-hidden rounded-md border border-line bg-black">
      <div className="flex items-center gap-1.5 border-b border-line bg-panel-2 px-3 py-1.5">
        <span className="h-2.5 w-2.5 rounded-full bg-red-500/70" />
        <span className="h-2.5 w-2.5 rounded-full bg-amber-500/70" />
        <span className="h-2.5 w-2.5 rounded-full bg-emerald-500/70" />
        <span className="ml-2 font-mono text-xs text-muted">honeypot://isolated-parser-01</span>
      </div>
      <pre className="h-56 overflow-auto p-3 font-mono text-xs leading-relaxed whitespace-pre-wrap">
        {lines.slice(0, shown).map((l, i) => (
          <div key={i} className={color(l)}>
            {l}
          </div>
        ))}
        {shown < lines.length && <span className="animate-pulse text-cisco">▌</span>}
      </pre>
    </div>
  );
}
