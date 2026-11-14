// Small shared building blocks for the presentation UI.
import type { IncidentStatus } from "@/lib/simulation/types";
import { STATUS, TONE, type Tone } from "./plain";

export function Badge({ tone, children }: { tone: Tone; children: React.ReactNode }) {
  return <span className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-sm font-medium ring-1 ${TONE[tone]}`}>{children}</span>;
}

export function StatusBadge({ status }: { status: IncidentStatus }) {
  const s = STATUS[status];
  return <Badge tone={s.tone}>{s.label}</Badge>;
}

export function Card({ className = "", children }: { className?: string; children: React.ReactNode }) {
  return <section className={`rounded-2xl border border-line bg-panel p-6 ${className}`}>{children}</section>;
}

export function Details({ summary, children }: { summary: string; children: React.ReactNode }) {
  return (
    <details className="group mt-4 rounded-xl border border-line bg-bg/60">
      <summary className="cursor-pointer list-none px-4 py-2.5 text-sm text-muted select-none hover:text-ink">
        <span className="mr-2 inline-block transition-transform group-open:rotate-90">›</span>
        {summary}
      </summary>
      <div className="border-t border-line p-4">{children}</div>
    </details>
  );
}
