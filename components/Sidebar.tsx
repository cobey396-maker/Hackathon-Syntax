export type View = "queue" | "ledger" | "traffic";

const NAV: [View, string][] = [
  ["queue", "Sandbox Queue"],
  ["ledger", "Audit Ledger"],
  ["traffic", "Live Traffic"],
];

export default function Sidebar({
  view,
  onView,
  pending,
  simOnline,
}: {
  view: View;
  onView: (v: View) => void;
  pending: number;
  simOnline: boolean;
}) {
  return (
    <aside className="flex w-64 shrink-0 flex-col border-r border-line bg-panel">
      <div className="border-b border-line px-5 py-4">
        <div className="flex items-center gap-2">
          <span className="h-2.5 w-2.5 rounded-sm bg-cisco" />
          <span className="text-sm font-semibold tracking-wide">Virtual Patch Sandbox</span>
        </div>
        <p className="mt-1 text-xs text-muted">Digital Shield · SOC Console</p>
      </div>

      <nav className="flex flex-col gap-1 p-3">
        <p className="px-2 pb-1 text-xs font-semibold uppercase tracking-wider text-muted">Operations</p>
        {NAV.map(([key, label]) => (
          <button
            key={key}
            onClick={() => onView(key)}
            className={`flex items-center justify-between rounded px-3 py-2 text-left text-sm transition-colors ${
              view === key
                ? "border-l-2 border-cisco bg-cisco-deep/40 text-ink"
                : "border-l-2 border-transparent text-muted hover:bg-panel-2 hover:text-ink"
            }`}
          >
            {label}
            {key === "queue" && pending > 0 && (
              <span className="rounded bg-cisco px-1.5 font-mono text-xs font-semibold text-bg">{pending}</span>
            )}
          </button>
        ))}
      </nav>

      <div className="mt-auto border-t border-line p-4 text-xs text-muted">
        <div className="flex items-center gap-2">
          <span className={`h-2 w-2 rounded-full ${simOnline ? "animate-pulse bg-emerald-400" : "bg-slate-600"}`} />
          Traffic feed {simOnline ? "online" : "offline"}
        </div>
        {!simOnline && <p className="mt-2 font-mono">python traffic_simulator.py</p>}
      </div>
    </aside>
  );
}
