// Shared console primitives: panes, severity colouring, status labels.
import type { Status } from "@/lib/types";

export const hhmmss = (iso: string) => iso.slice(11, 19);

export function sevText(s: number) {
  if (s >= 9) return "text-red-400";
  if (s >= 7) return "text-orange-400";
  if (s >= 4) return "text-amber-300";
  return "text-slate-300";
}

export function sevFill(s: number) {
  if (s >= 9) return "bg-red-500";
  if (s >= 7) return "bg-orange-500";
  if (s >= 4) return "bg-amber-400";
  return "bg-slate-400";
}

// "07" in severity colour, optionally with a 10-segment micro bar
export function Sev({ value, bar = false, num = true }: { value: number; bar?: boolean; num?: boolean }) {
  return (
    <span className="inline-flex items-center gap-2">
      {num && <span className={`font-mono text-sm font-semibold tabular-nums ${sevText(value)}`}>{String(value).padStart(2, "0")}</span>}
      {bar && (
        <span className="flex gap-px">
          {Array.from({ length: 10 }, (_, i) => (
            <span key={i} className={`h-2.5 w-1 ${i < value ? sevFill(value) : "bg-line"}`} />
          ))}
        </span>
      )}
    </span>
  );
}

// Cisco-blue confidence bar + percentage
export function Confidence({ value }: { value: number }) {
  return (
    <span className="inline-flex items-center gap-2">
      <span className="h-1.5 w-16 bg-line">
        <span className="block h-1.5 bg-cisco" style={{ width: `${value}%` }} />
      </span>
      <span className="font-mono text-sm tabular-nums">{value}%</span>
    </span>
  );
}

const STATUS: Record<Status, [string, string]> = {
  pending: ["Pending Review", "bg-amber-500/15 text-amber-300"],
  patched: ["Patched", "bg-neon/15 text-neon-hi"],
  allowed: ["Overridden", "bg-panel-2 text-muted"],
};

export function StatusPill({ status }: { status: Status }) {
  const [label, cls] = STATUS[status];
  return <span className={`inline-block px-2 py-0.5 font-mono text-xs font-semibold ${cls}`}>{label}</span>;
}

export function Pane({
  title,
  meta,
  className = "",
  children,
}: {
  title: string;
  meta?: React.ReactNode;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <section className={`flex min-h-0 flex-col border bg-panel ${className}`}>
      <header className="flex h-9 shrink-0 items-center justify-between gap-3 border-b px-3">
        <h2 className="text-xs font-semibold tracking-wider text-muted uppercase">{title}</h2>
        {meta && <div className="flex items-center gap-3 font-mono text-xs text-dim">{meta}</div>}
      </header>
      <div className="min-h-0 flex-1 overflow-auto">{children}</div>
    </section>
  );
}

export const th = "sticky top-0 z-10 border-b bg-panel px-3 py-2 text-left text-xs font-medium tracking-wider text-dim uppercase";
export const td = "px-3 py-2 text-sm";
