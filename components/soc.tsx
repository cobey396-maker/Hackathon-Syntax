// Shared building blocks: cards, badges, severity signal bars, collapsible details.
import type { Status } from "@/lib/types";

export const hhmmss = (iso: string) => iso.slice(11, 19);

// "4:59" countdown; never negative
export function mmss(ms: number) {
  const s = Math.max(0, Math.ceil(ms / 1000));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
}

export type Tone = "neutral" | "info" | "ok" | "warn" | "crit";
const TONE: Record<Tone, string> = {
  neutral: "bg-panel-2 text-muted ring-line",
  info: "bg-cisco/15 text-sky ring-cisco/40",
  ok: "bg-ok/15 text-ok-hi ring-ok/40",
  warn: "bg-warn/15 text-warn-hi ring-warn/40",
  crit: "bg-crit/15 text-crit-hi ring-crit/50",
};

export function Badge({ tone = "neutral", children }: { tone?: Tone; children: React.ReactNode }) {
  return <span className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-sm font-medium whitespace-nowrap ring-1 ${TONE[tone]}`}>{children}</span>;
}

// Solid red tag for packets under the Critical Response Protocol
export function CritBadge() {
  return <span className="inline-block rounded-full bg-crit px-3 py-1 text-xs font-bold tracking-wider text-white">CRITICAL</span>;
}

export function sevText(s: number) {
  if (s >= 9) return "text-crit-hi";
  if (s >= 7) return "text-orange-400";
  if (s >= 4) return "text-warn";
  return "text-muted";
}

export function sevFill(s: number) {
  if (s >= 9) return "bg-crit";
  if (s >= 7) return "bg-orange-500";
  if (s >= 4) return "bg-warn";
  return "bg-muted";
}

const BAR_H = ["h-1", "h-1.5", "h-2", "h-2.5", "h-3", "h-3.5", "h-4", "h-4.5", "h-5", "h-5.5"];

// Severity as ascending signal bars, filled to the score; optional "9/10" number
export function Sev({ value, bar = false, num = true }: { value: number; bar?: boolean; num?: boolean }) {
  return (
    <span className="inline-flex items-end gap-2.5" title={`Severity ${value}/10`}>
      {num && (
        <span className={`font-mono text-sm leading-5 font-semibold tabular-nums ${sevText(value)}`}>
          {value}
          <span className="text-dim">/10</span>
        </span>
      )}
      {bar && (
        <span className="flex h-6 items-end gap-0.5" aria-hidden>
          {BAR_H.map((h, i) => (
            <span key={i} className={`w-1 rounded-sm ${h} ${i < value ? sevFill(value) : "bg-line"}`} />
          ))}
        </span>
      )}
    </span>
  );
}

export function Confidence({ value }: { value: number }) {
  return (
    <span className="inline-flex items-center gap-2.5">
      <span className="h-1.5 w-16 overflow-hidden rounded-full bg-line">
        <span className="block h-1.5 rounded-full bg-cisco" style={{ width: `${value}%` }} />
      </span>
      <span className="font-mono text-sm tabular-nums">{value}%</span>
    </span>
  );
}

const STATUS: Record<Status, [string, Tone]> = {
  pending: ["Waiting for a human", "warn"],
  patched: ["Fix approved", "info"],
  allowed: ["Overridden", "neutral"],
};

export function StatusPill({ status }: { status: Status }) {
  const [label, tone] = STATUS[status];
  return <Badge tone={tone}>{label}</Badge>;
}

export function Card({ className = "", children }: { className?: string; children: React.ReactNode }) {
  return <section className={`shadow-card rounded-2xl border bg-panel/85 p-6 backdrop-blur ${className}`}>{children}</section>;
}

// Card heading with a one-line explanation and an optional right-hand slot
export function CardTitle({ title, sub, right }: { title: string; sub?: string; right?: React.ReactNode }) {
  return (
    <div className="mb-5 flex flex-wrap items-start justify-between gap-x-4 gap-y-2">
      <div className="min-w-0">
        <h2 className="text-xl font-semibold">{title}</h2>
        {sub && <p className="text-muted">{sub}</p>}
      </div>
      {right && <div className="flex shrink-0 flex-wrap items-center gap-2">{right}</div>}
    </div>
  );
}

export function Details({ summary, children, open = false }: { summary: string; children: React.ReactNode; open?: boolean }) {
  return (
    <details open={open} className="group mt-4 overflow-hidden rounded-xl border bg-bg/60">
      <summary className="cursor-pointer list-none px-4 py-2.5 text-sm text-muted select-none hover:text-ink">
        <span className="mr-2 inline-block transition-transform group-open:rotate-90">›</span>
        {summary}
      </summary>
      <div className="border-t">{children}</div>
    </details>
  );
}

export function Empty({ children }: { children: React.ReactNode }) {
  return <p className="rounded-2xl border border-dashed p-8 text-center text-muted">{children}</p>;
}

export function Kbd({ children }: { children: React.ReactNode }) {
  return <kbd className="rounded-md border bg-bg px-1.5 py-0.5 font-mono text-xs text-ink">{children}</kbd>;
}

export const th = "border-b px-4 py-2.5 text-left text-sm font-medium whitespace-nowrap text-muted";
export const td = "px-4 py-2.5 text-sm";
export const tr = "border-b border-line/60 last:border-b-0";
