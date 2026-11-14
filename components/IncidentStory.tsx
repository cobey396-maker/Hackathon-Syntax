"use client";
// One threat told as a four-step story. Each step appears once the engine reaches it.
// Plain English up front; the technical evidence is one click away under "Show details".
import { AlertTriangle, ArrowLeft, Check, CheckCircle2, FlaskConical, Loader2, Play, Radar, ShieldCheck, ShieldOff, Undo2, UserCheck, X, XCircle } from "lucide-react";
import { nextAutoAction } from "@/lib/simulation/engine";
import { describeMatch } from "@/lib/simulation/firewall";
import { SCENARIOS } from "@/lib/simulation/scenarios";
import { incidentById } from "@/lib/simulation/selectors";
import type { CaseResult } from "@/lib/simulation/types";
import HoneypotTerminal from "./HoneypotTerminal";
import { journeyForIncident } from "./viz/journey";
import JourneyPanel from "./viz/JourneyPanel";
import { findingText, impactText, OUTCOME, ruleText, storyStep } from "./plain";
import { useSimulation } from "./simulation/SimulationProvider";
import { Badge, Card, Details, StatusBadge } from "./ui";

const STEPS = [
  { icon: Radar, label: "Spotted" },
  { icon: FlaskConical, label: "Tested safely" },
  { icon: UserCheck, label: "Your decision" },
  { icon: ShieldCheck, label: "Verify" },
];

function CaseTable({ cases }: { cases: CaseResult[] }) {
  return (
    <table className="w-full text-sm">
      <thead className="text-left text-muted">
        <tr>
          <th className="pb-2 font-medium">Connection</th>
          <th className="pb-2 font-medium">Should be</th>
          <th className="pb-2 font-medium">Before fix</th>
          <th className="pb-2 font-medium">After fix</th>
          <th className="pb-2" />
        </tr>
      </thead>
      <tbody>
        {cases.map((c) => (
          <tr key={c.packetId + c.label} className="border-t border-line">
            <td className="py-2">{c.label === "suspicious target" ? "The suspicious connection" : c.label}</td>
            <td className="py-2">{c.expect === "BLOCK" ? "Blocked" : "Allowed"}</td>
            <td className="py-2 text-muted">{c.before.verdict === "BLOCK" ? "Blocked" : "Allowed"}</td>
            <td className={`py-2 ${c.after.verdict === "BLOCK" ? "text-red-300" : "text-emerald-300"}`}>{c.after.verdict === "BLOCK" ? "Blocked" : "Allowed"}</td>
            <td className="py-2 text-right">{c.pass ? <Check className="ml-auto h-4 w-4 text-emerald-400" /> : <X className="ml-auto h-4 w-4 text-red-400" />}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

function StepHeader({ n, title, done }: { n: number; title: string; done: boolean }) {
  const Icon = STEPS[n].icon;
  return (
    <div className="mb-4 flex items-center gap-3">
      <span className={`flex h-9 w-9 items-center justify-center rounded-xl ${done ? "bg-neon/20 text-neon-hi" : "bg-panel-2 text-dim"}`}>
        <Icon className="h-5 w-5" />
      </span>
      <h3 className="text-xl font-semibold">
        <span className="text-dim">Step {n + 1} · </span>
        {title}
      </h3>
    </div>
  );
}

export default function IncidentStory({ id, onBack }: { id: string; onBack: () => void }) {
  const { state, dispatch, persona, autoRun, running, stop } = useSimulation();
  const inc = incidentById(state, id);
  if (!inc) return null;

  const p = state.packets[inc.packetId];
  const sc = SCENARIOS.find((s) => s.id === inc.scenarioId);
  const step = storyStep(inc.status);
  const next = nextAutoAction(inc);
  const isRunning = running === inc.id;
  const prop = inc.proposal;
  const hits = inc.detection.findings.filter((f) => f.triggered);
  const outcome = inc.evidence ? OUTCOME[inc.evidence.outcome] : null;
  const approve = () => {
    dispatch({ type: "APPROVE", incidentId: inc.id, actor: persona });
    autoRun(inc.id); // deploy, then verify (and roll back if needed) automatically
  };

  return (
    <div className="mx-auto max-w-5xl space-y-8 pb-32">
      <button onClick={onBack} className="flex items-center gap-2 text-sm text-muted hover:text-ink">
        <ArrowLeft className="h-4 w-4" /> All threats
      </button>

      <header className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h2 className="text-3xl font-semibold tracking-tight">{sc?.name ?? "Suspicious connection"}</h2>
          <p className="mt-1 text-muted">
            {inc.id} · {p.protocol} connection from {p.srcIp} · synthetic test traffic
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {inc.containment === "QUARANTINED" && (
            <Badge tone="warn">
              <ShieldOff className="h-3.5 w-3.5" /> Isolated from network
            </Badge>
          )}
          <StatusBadge status={inc.status} />
        </div>
      </header>

      {/* progress */}
      <ol className="grid grid-cols-4 gap-2">
        {STEPS.map((s, i) => {
          const reached = i <= step;
          const current = i === step;
          return (
            <li key={s.label} className={`rounded-xl border px-3 py-2.5 text-center text-sm ${current ? "border-neon bg-neon/10 font-semibold text-ink" : reached ? "border-line bg-panel text-muted" : "border-line/50 text-dim"}`}>
              {reached && !current ? "✓ " : ""}
              {s.label}
            </li>
          );
        })}
      </ol>

      <JourneyPanel title="Where this connection is now" j={journeyForIncident(inc, state.firewall.rules.filter((r) => r.origin === "patch").length)} />

      {/* 1. Spotted */}
      <Card>
        <StepHeader n={0} title="What looked wrong" done />
        <ul className="space-y-2">
          {hits.map((f) => (
            <li key={f.check} className="flex items-start gap-3 text-lg">
              <AlertTriangle className={`mt-1 h-5 w-5 shrink-0 ${f.points ? "text-red-400" : "text-amber-300"}`} />
              {findingText(f, p)}
            </li>
          ))}
        </ul>
        <p className="mt-4 text-muted">
          Risk level: <span className="font-semibold text-ink">{inc.detection.risk.toLowerCase()}</span> ({inc.detection.score} of 10)
        </p>
        <Details summary="Show technical checks">
          <table className="w-full font-mono text-xs">
            <tbody>
              {inc.detection.findings.map((f) => (
                <tr key={f.check} className="border-t border-line first:border-0">
                  <td className="py-1.5 pr-3">{f.check}</td>
                  <td className={`py-1.5 pr-3 ${f.triggered ? "text-red-300" : "text-muted"}`}>{f.observed}</td>
                  <td className="py-1.5 pr-3 text-dim">expected {f.expected}</td>
                  <td className="py-1.5 text-right">{f.triggered ? `+${f.points}` : "ok"}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <p className="mt-2 text-xs text-dim">Score = sum of points, capped at 10. These are fixed rules, not a trained AI model.</p>
        </Details>
      </Card>

      {/* 2. Tested safely */}
      {step >= 1 && (
        <Card>
          <StepHeader n={1} title="Tested safely in a sandbox" done />
          {!outcome ? (
            <p className="flex items-center gap-2 text-lg text-muted">
              <Loader2 className="h-5 w-5 animate-spin" /> Connection isolated. Replaying it in the sandbox…
            </p>
          ) : (
            <>
              <div className={`rounded-xl p-5 ${outcome.tone === "bad" ? "bg-red-500/10" : outcome.tone === "warn" ? "bg-amber-500/10" : "bg-emerald-500/10"}`}>
                <p className={`text-2xl font-semibold ${outcome.tone === "bad" ? "text-red-300" : outcome.tone === "warn" ? "text-amber-200" : "text-emerald-300"}`}>{outcome.title}</p>
                <p className="mt-1 text-muted">{outcome.detail}</p>
              </div>
              {inc.status === "BENIGN" && (
                <p className="mt-4 flex items-start gap-3 text-lg">
                  <CheckCircle2 className="mt-1 h-5 w-5 shrink-0 text-emerald-400" />
                  False alarm. The connection was released and no fix is needed, so a real user is not blocked.
                </p>
              )}
              {inc.status === "INCONCLUSIVE" && (
                <p className="mt-4 flex items-start gap-3 text-lg">
                  <AlertTriangle className="mt-1 h-5 w-5 shrink-0 text-amber-300" />
                  Not enough evidence for a permanent block. It stays isolated for an analyst to look into, with no fix proposed.
                </p>
              )}
              <Details summary="Show sandbox replay">
                <HoneypotTerminal key={inc.id} lines={inc.evidence!.log} crashes={inc.evidence!.crashed} />
                <div className="mt-3 grid gap-3 text-sm sm:grid-cols-3">
                  {(
                    [
                      ["What we saw", inc.evidence!.observed],
                      ["What it means", inc.evidence!.inferred],
                      ["What we don't know", inc.evidence!.unknown],
                    ] as const
                  ).map(([h, xs]) => (
                    <div key={h}>
                      <p className="mb-1 font-semibold">{h}</p>
                      <ul className="list-disc space-y-1 pl-4 text-muted">
                        {xs.map((x) => (
                          <li key={x}>{x}</li>
                        ))}
                      </ul>
                    </div>
                  ))}
                </div>
              </Details>
            </>
          )}
        </Card>
      )}

      {/* 3. Your decision */}
      {step >= 2 && prop && (
        <Card className={inc.status === "AWAITING_REVIEW" ? "!border-neon/60" : ""}>
          <StepHeader n={2} title="Proposed fix: your decision" done />
          <p className="rounded-xl bg-bg p-5 text-2xl font-semibold">{ruleText(prop.rule.match)}</p>
          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            <p className="flex items-center gap-2 text-lg">
              <CheckCircle2 className="h-5 w-5 text-emerald-400" /> Temporary: lasts 24 hours
            </p>
            <p className={`flex items-center gap-2 text-lg ${prop.safe ? "" : "text-red-300"}`}>
              {prop.safe ? <CheckCircle2 className="h-5 w-5 text-emerald-400" /> : <XCircle className="h-5 w-5 text-red-400" />}
              {impactText(prop)}
            </p>
          </div>
          {!prop.safe && (
            <p className="mt-4 rounded-xl bg-red-500/10 p-4 text-red-200">
              This fix is too broad: it would block normal users. Approving is disabled. The system stops unsafe changes before they go live.
            </p>
          )}

          {inc.status === "AWAITING_REVIEW" && (
            <div className="mt-6 flex flex-wrap items-center gap-3 border-t border-line pt-5">
              <button
                onClick={approve}
                disabled={!prop.safe}
                className="flex items-center gap-2 rounded-xl bg-neon px-7 py-3.5 text-lg font-semibold text-white shadow-lg shadow-neon/30 hover:bg-neon-hi disabled:cursor-not-allowed disabled:opacity-40 disabled:shadow-none"
              >
                <Check className="h-5 w-5" /> Approve fix
              </button>
              <button onClick={() => dispatch({ type: "REJECT", incidentId: inc.id, actor: persona })} className="flex items-center gap-2 rounded-xl border border-line px-6 py-3.5 text-lg text-muted hover:text-ink">
                <X className="h-5 w-5" /> Reject
              </button>
              <p className="text-sm text-dim">Deciding as {persona} (demo persona, not a real login)</p>
            </div>
          )}

          {inc.status === "REJECTED" && (
            <div className="mt-6 flex flex-wrap items-center justify-between gap-3 border-t border-line pt-5">
              <p className="text-lg">
                Rejected by {inc.decidedBy}. The fix was not applied.
                {inc.containment === "QUARANTINED" && " The connection is still isolated."}
              </p>
              {inc.containment === "QUARANTINED" && (
                <button onClick={() => dispatch({ type: "RELEASE", incidentId: inc.id, actor: persona })} className="rounded-xl border border-line px-4 py-2 text-muted hover:text-ink">
                  Release connection
                </button>
              )}
            </div>
          )}

          <Details summary="Show rule and pre-launch test">
            <p className="mb-3 font-mono text-xs text-sky-300">
              {prop.rule.id} DENY if {describeMatch(prop.rule.match)}
            </p>
            <CaseTable cases={prop.preCheck.cases} />
          </Details>
        </Card>
      )}

      {/* 4. Verified */}
      {step >= 3 && (
        <Card>
          <StepHeader n={3} title="Did the fix work?" done />
          {!inc.verification ? (
            <p className="flex items-center gap-2 text-lg text-muted">
              <Loader2 className="h-5 w-5 animate-spin" /> Fix applied. Testing it now…
            </p>
          ) : inc.verification.passed ? (
            <div className="space-y-2 text-lg">
              <p className="flex items-center gap-3">
                <CheckCircle2 className="h-6 w-6 text-emerald-400" /> The suspicious connection is now blocked
              </p>
              <p className="flex items-center gap-3">
                <CheckCircle2 className="h-6 w-6 text-emerald-400" />
                All {inc.verification.cases.length - 1} normal users still connect
              </p>
              <p className="mt-3 text-muted">The temporary isolation was lifted because the verified fix now protects the network.</p>
            </div>
          ) : (
            <div className="space-y-2 text-lg">
              <p className="flex items-center gap-3 text-red-300">
                <XCircle className="h-6 w-6 text-red-400" />
                The fix blocked {inc.verification.blockedLegit} normal user ({inc.verification.cases.filter((c) => !c.pass).map((c) => c.label.replace(" (regression)", "")).join(", ")})
              </p>
              {inc.rollback ? (
                <p className="flex items-center gap-3">
                  <Undo2 className="h-6 w-6 text-amber-300" />
                  {inc.rollback.restored ? "It was automatically undone. The firewall is back to how it was." : "Automatic undo failed. Needs manual attention."}
                </p>
              ) : (
                <p className="flex items-center gap-2 text-muted">
                  <Loader2 className="h-5 w-5 animate-spin" /> Undoing the fix…
                </p>
              )}
            </div>
          )}
          {inc.verification && (
            <Details summary="Show every test">
              <CaseTable cases={inc.verification.cases} />
            </Details>
          )}
        </Card>
      )}

      {/* continue bar */}
      {next && (
        <div className="fixed inset-x-0 bottom-0 z-30 border-t border-line bg-panel/95 backdrop-blur">
          <div className="mx-auto flex max-w-5xl items-center justify-between gap-4 px-6 py-4">
            <p className="text-muted">{isRunning ? "Investigating…" : "The system pauses here so you can explain each step."}</p>
            <button
              onClick={() => (isRunning ? stop() : autoRun(inc.id))}
              className="flex items-center gap-2 rounded-xl border-2 border-neon bg-neon/15 px-6 py-3 text-lg font-semibold text-neon-hi hover:bg-neon/25"
            >
              {isRunning ? <Loader2 className="h-5 w-5 animate-spin" /> : <Play className="h-5 w-5" />}
              {isRunning ? "Pause" : step === 0 ? "Investigate" : "Continue"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
