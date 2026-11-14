import type { Status } from "@/lib/types";

export const hhmmss = (iso: string) => iso.slice(11, 19);

export function severityClass(s: number) {
  if (s >= 9) return "bg-red-500/15 text-red-400 ring-red-500/40";
  if (s >= 7) return "bg-orange-500/15 text-orange-400 ring-orange-500/40";
  if (s >= 4) return "bg-amber-500/15 text-amber-300 ring-amber-500/40";
  return "bg-slate-500/15 text-slate-300 ring-slate-500/40";
}

export function severityBar(s: number) {
  if (s >= 9) return "bg-red-500";
  if (s >= 7) return "bg-orange-500";
  if (s >= 4) return "bg-amber-400";
  return "bg-slate-400";
}

export function SeverityBadge({ value }: { value: number }) {
  return (
    <span
      className={`inline-flex w-14 justify-center rounded px-2 py-0.5 font-mono text-xs font-semibold ring-1 ${severityClass(value)}`}
    >
      {value}/10
    </span>
  );
}

const STATUS: Record<Status, [string, string]> = {
  pending: ["Pending Review", "bg-amber-500/15 text-amber-300"],
  patched: ["Patched", "bg-emerald-500/15 text-emerald-400"],
  allowed: ["Overridden", "bg-slate-500/20 text-slate-300"],
};

export function StatusPill({ status }: { status: Status }) {
  const [label, cls] = STATUS[status];
  return <span className={`rounded px-2 py-0.5 text-xs font-medium ${cls}`}>{label}</span>;
}

export function Panel({ title, right, children }: { title: string; right?: React.ReactNode; children: React.ReactNode }) {
  return (
    <section className="flex min-h-0 flex-1 flex-col rounded-md border border-line bg-panel">
      <header className="flex items-center justify-between border-b border-line px-4 py-2.5">
        <h2 className="text-sm font-semibold tracking-wide">{title}</h2>
        {right}
      </header>
      <div className="min-h-0 flex-1 overflow-auto">{children}</div>
    </section>
  );
}

export const th = "sticky top-0 bg-panel-2 px-4 py-2 text-left text-xs font-semibold uppercase tracking-wider text-muted";
export const td = "px-4 py-2 text-sm";
