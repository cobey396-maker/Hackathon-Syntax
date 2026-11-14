// Shared console primitives: panes, risk colouring, status labels.
import type { Containment, IncidentStatus, RiskLevel } from "@/lib/simulation/types";
import { tickToIso } from "@/lib/simulation/engine";

export const simTime = (tick: number) => tickToIso(tick).slice(11, 19);

const RISK: Record<RiskLevel, string> = {
  CRITICAL: "border-red-500/60 text-red-300",
  HIGH: "border-orange-500/60 text-orange-300",
  MEDIUM: "border-amber-400/60 text-amber-200",
  LOW: "border-slate-500/60 text-slate-300",
};

/** Risk as text + score (never colour alone). */
export function Risk({ level, score }: { level: RiskLevel; score?: number }) {
  return (
    <span className={`inline-flex items-center gap-1.5 border px-1.5 py-0.5 font-mono text-xs font-semibold ${RISK[level]}`}>
      {level}
      {score !== undefined && <span className="font-normal opacity-80">{score}/10</span>}
    </span>
  );
}

const STATUS: Record<IncidentStatus, [string, string]> = {
  DETECTED: ["Detected", "bg-red-500/15 text-red-300"],
  CONTAINED: ["Contained", "bg-orange-500/15 text-orange-300"],
  SIMULATED: ["Simulated", "bg-cisco/15 text-cisco"],
  ANALYZED: ["Analyzed", "bg-cisco/15 text-cisco"],
  PROPOSED: ["Proposed", "bg-cisco/15 text-cisco"],
  AWAITING_REVIEW: ["Awaiting Review", "bg-amber-500/15 text-amber-300"],
  ENFORCED: ["Enforced", "bg-neon/15 text-neon-hi"],
  VERIFIED: ["Verified", "bg-emerald-500/15 text-emerald-300"],
  BENIGN: ["Benign", "bg-emerald-500/10 text-emerald-300"],
  INCONCLUSIVE: ["Inconclusive", "bg-slate-500/15 text-slate-300"],
  REJECTED: ["Rejected", "bg-panel-2 text-muted"],
  VERIFY_FAILED: ["Verify Failed", "bg-red-500/15 text-red-300"],
  ROLLED_BACK: ["Rolled Back", "bg-amber-500/15 text-amber-200"],
  ROLLBACK_FAILED: ["Rollback Failed", "bg-red-600/25 text-red-200"],
};

export function StatusPill({ status }: { status: IncidentStatus }) {
  const [label, cls] = STATUS[status];
  return <span className={`inline-block px-2 py-0.5 font-mono text-xs font-semibold whitespace-nowrap ${cls}`}>{label}</span>;
}

export function ContainmentPill({ c }: { c: Containment }) {
  if (c === "NONE") return <span className="font-mono text-xs text-dim">—</span>;
  return c === "QUARANTINED" ? (
    <span className="font-mono text-xs font-semibold text-orange-300">◼ QUARANTINED</span>
  ) : (
    <span className="font-mono text-xs text-muted">○ released</span>
  );
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
