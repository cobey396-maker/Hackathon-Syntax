"use client";
// One held handshake told as a story: what looked wrong, the safe replay, Claude's grade, and the
// drafted fix with the human decision. Checks reveal one by one; the decision bar stays in view.
import { useEffect, useState } from "react";
import { ArrowLeft, Brain, Check as CheckIcon, CheckCircle2, FlaskConical, Radar, Siren, UserCheck, X, XCircle, type LucideIcon } from "lucide-react";
import type { Check, Decision, DeployedPatch, LedgerEntry, SandboxItem } from "@/lib/types";
import HoneypotTerminal from "./HoneypotTerminal";
import { Badge, Card, Confidence, CritBadge, Details, hhmmss, mmss, Sev, sevText, StatusPill, td, th, tr } from "./soc";

const TICK_MS = 280;

function hexClass(i: number, checks: Check[], shownChecks: number, hover: number | null) {
  const idx = checks.findIndex((c, k) => k < shownChecks && c.bytes && i >= c.bytes[0] && i <= c.bytes[1]);
  if (idx < 0) return "text-dim";
  const ring = hover === idx ? " outline outline-1 outline-sky" : "";
  return (checks[idx].ok ? "text-ok-hi" : "rounded-sm bg-crit/25 text-crit-hi") + ring;
}

function StepHeader({ icon: Icon, step, title, right }: { icon: LucideIcon; step?: number; title: string; right?: React.ReactNode }) {
  return (
    <div className="mb-4 flex flex-wrap items-center gap-x-3 gap-y-2">
      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-cisco/20 text-sky">
        <Icon className="h-5 w-5" />
      </span>
      <h3 className="min-w-0 flex-1 basis-56 text-lg font-semibold">
        {step && <span className="text-dim">Step {step} · </span>}
        {title}
      </h3>
      {right && <span className="min-w-0 text-sm break-words text-muted">{right}</span>}
    </div>
  );
}

export default function ThreatStory({
  now,
  item,
  ledger,
  patch,
  analyst,
  busy,
  onClose,
  onDecide,
}: {
  now: number;
  item: SandboxItem;
  ledger: LedgerEntry[];
  patch?: DeployedPatch;
  analyst: string;
  busy: boolean;
  onClose: () => void;
  onDecide: (a: Decision) => void;
}) {
  // Reveal: one check per tick, then the verdict, then the patch lines. Decided packets open fully revealed.
  const nChecks = item.checks.length;
  const total = nChecks + 1 + item.plan.length;
  const [tick, setTick] = useState(item.status === "pending" ? 0 : total);
  const [hover, setHover] = useState<number | null>(null);

  useEffect(() => {
    if (tick >= total) return;
    const t = setTimeout(() => setTick((n) => n + 1), TICK_MS);
    return () => clearTimeout(t);
  }, [tick, total]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const shownChecks = Math.min(nChecks, tick);
  const verdictShown = tick > nChecks;
  const planShown = Math.max(0, Math.min(item.plan.length, tick - nChecks - 1));
  const done = tick >= total;
  const grading = item.ai.status === "grading";
  // During the reveal show the rules tally; once Claude has graded, show its verdict
  const liveScore = done && !grading ? item.severity : Math.min(10, item.checks.slice(0, shownChecks).reduce((s, c) => s + c.points, 0));
  const crp = item.crp;
  const slaLeft = crp ? Date.parse(crp.slaDeadline) - now : 0;
  const myPrior = crp?.signoffs[0];
  const sign = (a: Decision) =>
    !crp ? null : myPrior && myPrior.action === a ? (myPrior.analyst === analyst ? "waiting for a second analyst" : "co-sign · 2 of 2") : "signature 1 of 2";
  const failed = item.checks.filter((c) => !c.ok && c.kind === "parser").map((c) => c.field);
  const decision = ledger.find((e) => e.itemId === item.id);
  const rows = Array.from({ length: Math.ceil(item.bytes.length / 16) }, (_, r) => item.bytes.slice(r * 16, r * 16 + 16));
  const slaBreached = item.status === "pending" && slaLeft <= 0;
  const pending = item.status === "pending";

  const protocolSteps: [string, string, boolean?][] = crp
    ? [
        [
          "Source quarantine",
          crp.quarantineLifted
            ? `Lifted ${hhmmss(crp.quarantineLifted)} · ${crp.liftReason === "expired" ? "expired, no analyst confirmed" : "decision signed"}`
            : crp.confirmedBy
              ? `${item.srcIp} held · confirmed by ${crp.confirmedBy.split(" · ")[0]}`
              : crp.quarantineExpires
                ? `${item.srcIp} held · lifts automatically in ${mmss(Math.max(0, Date.parse(crp.quarantineExpires) - now))} unless confirmed`
                : "—",
        ],
        ["Response SLA", !pending ? "Met" : slaLeft > 0 ? `${mmss(slaLeft)} left` : "Breached", slaBreached],
        ["Two-person rule", crp.signoffs.length ? crp.signoffs.map((s) => s.analyst.split(" · ")[0]).join(" + ") + ` (${crp.signoffs.length}/2)` : "0 of 2 signatures"],
        ["Incident", "P1 opened · PSIRT notified"],
      ]
    : [];

  return (
    <div className={`space-y-6 ${pending ? "pb-32" : ""}`}>
      <button onClick={onClose} className="flex items-center gap-2 text-sm text-muted hover:text-ink">
        <ArrowLeft className="h-4 w-4" /> All threats
      </button>

      <header className="flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0">
          <h2 className="text-3xl font-semibold tracking-tight break-words">{grading ? "Suspicious VPN handshake" : item.ai.attackClass}</h2>
          <p className="mt-1 break-words text-muted">
            {item.id} · {item.protocol} ClientHello from <span className="font-mono text-ink">{item.srcIp}</span> to vpn-gw-01:443 · user {item.user} · {hhmmss(item.ts)} UTC · held before the firewall
          </p>
        </div>
        <div className="flex shrink-0 flex-wrap items-center gap-2">
          {crp && <CritBadge />}
          <StatusPill status={item.status} />
        </div>
      </header>

      {/* headline numbers */}
      <section className="grid grid-cols-1 gap-px overflow-hidden rounded-2xl border bg-line sm:grid-cols-3">
        <div className="bg-panel/95 px-5 py-4">
          <p className="text-sm text-muted">Severity</p>
          <div className="mt-1 flex items-end gap-3">
            <span className={`text-3xl leading-8 font-bold tabular-nums ${sevText(liveScore || 1)}`}>
              {liveScore}
              <span className="text-lg text-dim">/10</span>
            </span>
            <Sev value={liveScore} bar num={false} />
          </div>
        </div>
        <div className="bg-panel/95 px-5 py-4">
          <p className="text-sm text-muted">Threat confidence</p>
          <div className="mt-1 flex h-8 items-center">
            <Confidence value={item.confidence} />
          </div>
        </div>
        <div className="bg-panel/95 px-5 py-4">
          <p className="text-sm text-muted">Graded by</p>
          <p className="mt-1 text-lg leading-8 font-semibold">{!done ? "Analysing…" : grading ? "Claude grading…" : item.ai.engine === "claude" ? "Claude" : "Rules engine"}</p>
        </div>
      </section>

      {crp && (
        <section className="overflow-hidden rounded-2xl border border-crit/60 bg-crit/5 backdrop-blur">
          <header className="flex items-center gap-2 border-b border-crit/40 px-6 py-3">
            <Siren className="h-5 w-5 shrink-0 text-crit-hi" />
            <h3 className="text-lg font-semibold text-crit-hi">Critical Response Protocol</h3>
            <span className="ml-auto text-sm text-muted">Severity 7 or higher</span>
          </header>
          <ol className="grid sm:grid-cols-2">
            {protocolSteps.map(([k, v, bad], i) => (
              <li key={k} className="flex gap-3 border-b border-crit/20 px-6 py-3 sm:odd:border-r">
                <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-crit/25 text-xs font-semibold text-crit-hi">{i + 1}</span>
                <div className="min-w-0">
                  <p className="text-sm text-muted">{k}</p>
                  <p className={`break-words ${bad ? "font-semibold text-crit-hi" : "text-ink"}`}>{v}</p>
                </div>
              </li>
            ))}
          </ol>
        </section>
      )}

      {/* evidence on the left, the grade and the decision on the right */}
      <div className="grid items-start gap-6 lg:grid-cols-2">
        <div className="min-w-0 space-y-6">
          <Card>
            <StepHeader icon={Radar} step={1} title="What looked wrong" right={`${item.timings.totalMs.toFixed(2)} ms inline`} />
            {tick === 0 ? (
              <p className="text-muted">Parsing the record header…</p>
            ) : (
              <>
                <p className="text-lg text-crit-hi">
                  {failed.length ? failed.join(", ") : "The handshake"} {failed.length > 1 ? "are" : "is"} malformed in this {item.protocol} ClientHello. No signature-based IPS rule matches it.
                </p>
                {verdictShown && (
                  <p className="mt-2 text-muted animate-in fade-in-0">
                    Verdict: hold in the Holding Center. {grading ? "Escalating to Claude for a severity grade…" : `Severity ${item.severity}/10, confidence ${item.confidence}%.`} Drafting virtual patch {item.ruleId}.
                  </p>
                )}
              </>
            )}
            <div className="mt-4 overflow-x-auto rounded-xl border bg-bg/60">
              <table className="w-full border-collapse">
                <thead>
                  <tr>
                    {["Check", "Observed / expected", "Result", "Pts"].map((h) => (
                      <th key={h} className={`${th} px-3 ${h === "Pts" ? "text-right" : ""}`}>
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {item.checks.map((c, i) => {
                    const shown = i < shownChecks;
                    return (
                      <tr key={c.field} onMouseEnter={() => setHover(i)} onMouseLeave={() => setHover(null)} className={`${tr} ${hover === i ? "bg-cisco/10" : ""}`}>
                        <td className={`${td} px-3 font-mono text-xs break-words`}>{c.field}</td>
                        <td className={`${td} px-3 font-mono text-xs break-words`}>
                          <span className={shown && !c.ok ? "text-crit-hi" : ""}>{shown ? c.observed : "…"}</span>
                          <span className="block text-dim">expected {c.expected}</span>
                        </td>
                        <td className={`${td} px-3 font-semibold whitespace-nowrap`}>
                          {shown ? (
                            c.ok ? <span className="text-ok-hi">Pass</span> : <span className="text-crit-hi">Fail</span>
                          ) : i === shownChecks ? (
                            <span className="text-sky">Checking…</span>
                          ) : (
                            <span className="font-normal text-dim">Queued</span>
                          )}
                        </td>
                        <td className={`${td} px-3 text-right font-mono text-xs ${shown && c.points ? "text-warn-hi" : "text-dim"}`}>{shown ? (c.points ? `+${c.points}` : "0") : ""}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            <Details summary={`Show the captured header (${item.bytes.length} bytes) · hover a check to locate it`} open>
              <pre className="overflow-x-auto p-4 font-mono text-xs leading-relaxed">
                {rows.map((row, r) => (
                  <div key={r} className="flex gap-4">
                    <span className="text-dim/70">{(r * 16).toString(16).padStart(4, "0")}</span>
                    <span className="flex gap-1.5">
                      {row.map((b, k) => (
                        <span key={k} className={`px-px ${hexClass(r * 16 + k, item.checks, shownChecks, hover)}`}>
                          {b.toString(16).padStart(2, "0")}
                        </span>
                      ))}
                    </span>
                  </div>
                ))}
              </pre>
            </Details>
          </Card>

          <Card>
            <StepHeader icon={FlaskConical} step={2} title="Tested safely" right={item.crashes ? "Parser crash expected" : "No crash expected"} />
            <p className="mb-4 text-muted">Replay the held handshake against an isolated copy of the firewall parser. Nothing leaves the Holding Center.</p>
            <HoneypotTerminal key={item.id} lines={item.honeypot} crashes={item.crashes} />
          </Card>
        </div>

        <div className="min-w-0 space-y-6">
          <Card>
            <StepHeader
              icon={Brain}
              step={3}
              title="Claude's assessment"
              right={grading ? "Grading…" : item.ai.engine === "claude" ? `${item.ai.model} · ${((item.ai.ms ?? 0) / 1000).toFixed(1)} s` : (item.ai.note ?? "Rules engine")}
            />
            {grading ? (
              <p className="flex items-center gap-2 text-lg text-sky">
                <Brain className="h-5 w-5 animate-pulse" />
                Claude is weighing the evidence…
              </p>
            ) : (
              <>
                <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
                  <p className="min-w-0 text-lg font-semibold break-words">{item.ai.attackClass}</p>
                  <p className="font-mono text-sm whitespace-nowrap text-muted">
                    rules {item.ai.ruleSeverity}/10 → <span className={`font-semibold ${sevText(item.severity)}`}>{item.ai.engine === "claude" ? "Claude" : "final"} {item.severity}/10</span>
                  </p>
                </div>
                <p className="mt-2 text-muted">{item.ai.rationale}</p>
                {item.ai.riskFactors.length > 0 && (
                  <div className="mt-4 flex flex-wrap gap-2">
                    {item.ai.riskFactors.map((r) => (
                      <span key={r} className="rounded-full bg-panel-2 px-3 py-1 text-sm text-muted">
                        {r}
                      </span>
                    ))}
                  </div>
                )}
                {item.ai.engine === "claude" && (
                  <p className="mt-4 border-t pt-3 text-sm text-dim">
                    Shared with Claude: header fields, check results, honeypot outcome, source masked to /24. Not shared: username, full IP, payload bytes.
                  </p>
                )}
              </>
            )}
          </Card>

          <Card className={pending && done && !grading ? "border-cisco/60" : ""}>
            <StepHeader
              icon={UserCheck}
              step={4}
              title="Proposed fix: your decision"
              right={`${item.ruleId} · ${item.plan.length} changes · ${item.status === "patched" ? "live at the edge" : item.status === "allowed" ? "discarded" : "not applied"}`}
            />
            <div className="min-h-24 space-y-3 rounded-xl bg-bg p-4">
              {item.plan.slice(0, planShown).map((l) => (
                <div key={l.cmd} className="animate-in fade-in-0">
                  <p className={`font-mono text-sm break-words ${item.status === "allowed" ? "text-dim line-through" : "text-sky"}`}>
                    <span className="mr-2 text-cisco select-none">+</span>
                    {l.cmd}
                  </p>
                  <p className="pl-5 text-sm text-muted">{l.note}</p>
                </div>
              ))}
              {planShown === 0 && <p className="text-muted">Waiting for the verdict…</p>}
            </div>
            {done && (
              <p className={`mt-4 flex items-start gap-2 ${item.impact.matched ? "text-warn-hi" : ""}`}>
                {item.impact.matched ? <XCircle className="mt-0.5 h-5 w-5 shrink-0 text-warn" /> : <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-ok" />}
                <span>
                  False-positive check: these rules match <span className="font-semibold">{item.impact.matched}</span> of the last <span className="font-semibold">{item.impact.window}</span> legitimate sessions.
                </span>
              </p>
            )}
            {!pending && (
              <div className="mt-5 flex flex-wrap items-center gap-x-4 gap-y-2 border-t pt-4 text-muted">
                {item.status === "patched" ? <Badge tone="info">Patch deployed to the edge</Badge> : <Badge>Overridden · packet released</Badge>}
                {decision && (
                  <span className="break-words">
                    {decision.analyst} · {decision.ts.slice(11, 19)} UTC · <span className="font-mono text-sm">{decision.id}</span>
                  </span>
                )}
                {patch && (
                  <span className="text-ink">
                    {patch.hits} repeat attempt{patch.hits === 1 ? "" : "s"} refused
                    {patch.lastHit && <span className="text-muted"> · last {patch.lastHit.slice(11, 19)} UTC</span>}
                  </span>
                )}
              </div>
            )}
          </Card>
        </div>
      </div>

      {/* human oversight controls: always in view while a decision is pending */}
      {pending && (
        <div className="fixed inset-x-0 bottom-0 z-30 border-t bg-panel/95 backdrop-blur">
          <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-x-6 gap-y-3 px-6 py-4">
            <p className="min-w-0 flex-1 basis-64 text-muted">
              {!done || grading ? (
                "The decision unlocks when the checks and Claude's grade are complete."
              ) : crp ? (
                <>
                  <span className="font-semibold text-crit-hi">Two-person rule.</span> Signing as <span className="text-ink">{analyst}</span>
                  {myPrior && myPrior.analyst === analyst ? "; switch analyst in the header to co-sign." : "; both signatures go to the audit ledger."}
                </>
              ) : (
                <>
                  Human review required. Signing as <span className="text-ink">{analyst}</span>; the decision is written to the audit ledger.
                </>
              )}
            </p>
            <div className="flex shrink-0 flex-wrap gap-3">
              <button
                disabled={!done || grading || busy || (myPrior?.action === "deny" && myPrior.analyst === analyst)}
                onClick={() => onDecide("deny")}
                className="flex h-16 w-52 flex-col items-center justify-center rounded-xl border text-lg text-muted transition-colors hover:border-muted hover:text-ink disabled:cursor-not-allowed disabled:opacity-40"
              >
                <span className="flex items-center gap-2">
                  <X className="h-5 w-5" /> Override
                </span>
                {sign("deny") && <span className="text-xs">{sign("deny")}</span>}
              </button>
              <button
                disabled={!done || grading || busy || (myPrior?.action === "approve" && myPrior.analyst === analyst)}
                onClick={() => onDecide("approve")}
                className="btn-glow flex h-16 w-64 flex-col items-center justify-center rounded-xl bg-cisco text-lg font-semibold text-white transition hover:bg-sky disabled:cursor-not-allowed disabled:opacity-40"
              >
                <span className="flex items-center gap-2">
                  <CheckIcon className="h-5 w-5" /> Approve virtual patch
                </span>
                {sign("approve") && <span className="text-xs font-normal">{sign("approve")}</span>}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
