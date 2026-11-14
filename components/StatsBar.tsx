import type { Stats } from "@/lib/types";

export default function StatsBar({ stats, pending }: { stats: Stats; pending: number }) {
  const tiles: [string, number, string][] = [
    ["Packets inspected", stats.seen, "text-ink"],
    ["Legitimate sessions", stats.legit, "text-emerald-400"],
    ["Awaiting review", pending, "text-amber-300"],
    ["Patches deployed", stats.patched, "text-cisco"],
    ["Overrides", stats.allowed, "text-muted"],
  ];
  return (
    <div className="grid grid-cols-5 gap-3">
      {tiles.map(([label, value, color]) => (
        <div key={label} className="rounded-md border border-line bg-panel px-4 py-3">
          <p className="text-xs uppercase tracking-wider text-muted">{label}</p>
          <p className={`mt-1 font-mono text-2xl font-semibold ${color}`}>{value.toLocaleString("en-US")}</p>
        </div>
      ))}
    </div>
  );
}
