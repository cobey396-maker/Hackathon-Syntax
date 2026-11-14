"use client";
// One incident, end to end. Everything shown is read from the shared simulation state; every
// button dispatches an engine Action, and the engine decides whether it is allowed.
import { useEffect } from "react";
import { Check as CheckIcon, FastForward, Pause, ShieldOff, StepForward, X } from "lucide-react";
import { nextAutoAction } from "@/lib/simulation/engine";
import { eventsFor, incidentById } from "@/lib/simulation/selectors";
import type { CaseResult, IncidentStatus } from "@/lib/simulation/types";
import { EventRows } from "./AuditLedger";
import HoneypotTerminal from "./HoneypotTerminal";
import { useSimulation } from "./simulation/SimulationProvider";
import { ContainmentPill, Risk, simTime, StatusPill, td, th } from "./soc";

const FLOW: IncidentStatus[] = ["DETECTED", "CONTAINED", "SIMULATED", "ANALYZED", "PROPOSED", "AWAITING_REVIEW", "ENFORCED", "VERIFIED"];

function Label({ t, right }: { t: string; right?: string }) {
  return (
    <p className="mb-2 flex items-baseline justify-between gap-3 text-xs font-semibold tracking-wider text-muted uppercase">
      <span>{t}</span>
      {right && <span className="font-mono font-normal text-dim normal-case">{right}</span>}
    </p>
  );
}

function Cases({ cases }: { cases: CaseResult[] }) {
  const v = (x: string) => <span className={x === "BLOCK" ? "text-red-300" : "text-emerald-400"}>{x}</span>;
  return (
    <table className="w-full">
      <thead>
        <tr>
          {["Case", "Expect", "Before", "After", ""].map((h) => (
            <th key={h} className={th}>
              {h}
            </th>
          ))}
        </tr>
      </thead>
      <tbody className="font-mono text-xs">
        {cases.map((c) => (
          <tr key={c.packetId + c.label} className="border-b border-line/60">
            <td className={`${td} font-sans text-xs`}>{c.label}</td>
            <td className={td}>{c.expect}</td>
            <td className={td}>{v(c.before.verdict)}</td>
            <td className={td}>
              {v(c.after.verdict)} <span className="text-dim">{c.after.matchedRule ?? "default"}</span>
            </td>
            <td className={`${td} font-semibold ${c.pass ? "text-emerald-400" : "text-red-400"}`}>{c.pass ? "PASS" : "FAIL"}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

export default function IncidentPanel({ id, onClose }: { id: string; onClose: () => void }) {
  const { state, dispatch, persona, autoRun, running, stop } = useSimulation();
  const inc = incidentById(state, id);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  if (!inc) return null;
  const p = state.packets[inc.packetId];
  const next = nextAutoAction(inc);
  const isRunning = running === inc.id;
  const reached = new Set(eventsFor(state, inc.id).map((e) => e.to));
  const prop = inc.proposal;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-4 animate-in fade-in-0 duration-150" onClick={onClose}>
      <div className="flex max-h-full w-full max-w-7xl flex-col border bg-panel shadow-2xl" onClick={(e) => e.stopPropagation()} role="dialog" aria-label={`Investigate ${inc.id}`}>
        <header className="flex flex-wrap items-center justify-between gap-4 border-b px-5 py-3">
          <div>
            <div className="flex items-center gap-3">
              <h2 className="font-mono text-base font-semibold">{inc.id}</h2>
              <StatusPill status={inc.status} />
              <ContainmentPill c={inc.containment} />
            </div>
            <p className="mt-0.5 font-mono text-xs text-muted">
              {p.id} · {p.protocol} · <span className="text-ink">{p.srcIp}</span> → {p.service} · detected {simTime(inc.createdTick)} sim · synthetic traffic
            </p>
          </div>
          <div className="flex items-center gap-5">
            <Risk level={inc.detection.risk} score={inc.detection.score} />
            <button onClick={onClose} className="p-1 text-muted hover:text-ink" aria-label="Close">
              <X className="h-4 w-4" />
            </button>
          </div>
        </header>

        {/* lifecycle strip */}
        <ol className="flex flex-wrap gap-px border-b bg-line text-xs">
          {FLOW.map((s) => {
            const here = inc.status === s;
            const done = reached.has(s) && !here;
            return (
              <li key={s} className={`flex-1 px-2 py-1.5 text-center font-mono ${here ? "bg-neon/20 text-ink" : done ? "bg-panel-2 text-muted" : "bg-panel text-dim"}`}>
                {done ? "✓ " : ""}
                {s.replace("_", " ")}
              </li>
            );
          })}
          {!FLOW.includes(inc.status) && <li className="w-full bg-panel-2 px-2 py-1.5 text-center font-mono text-amber-200">Outcome: {inc.status.replace("_", " ")}</li>}
        </ol>

        <div className="grid min-h-0 flex-1 gap-px overflow-auto bg-line lg:grid-cols-2">
          <div className="space-y-5 bg-panel p-5">
            <div>
              <Label t="1 · Detection checks" right={inc.detection.summary} />
              <table className="w-full">
                <thead>
                  <tr>
                    {["Check", "Observed", "Expected", "Result", "Pts"].map((h) => (
                      <th key={h} className={th}>
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {inc.detection.findings.map((f) => (
                    <tr key={f.check} className="border-b border-line/60" title={f.explanation}>
                      <td className={`${td} font-mono text-xs`}>{f.check}</td>
                      <td className={`${td} font-mono text-xs ${f.triggered ? "text-red-300" : ""}`}>{f.observed}</td>
                      <td className={`${td} font-mono text-xs text-dim`}>{f.expected}</td>
                      <td className={`${td} font-mono text-xs font-semibold ${f.triggered ? "text-red-400" : "text-emerald-400"}`}>{f.triggered ? "FLAG" : "PASS"}</td>
                      <td className={`${td} font-mono text-xs text-dim`}>{f.triggered ? `+${f.points}` : "0"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <p className="mt-2 text-xs text-dim">Risk score = sum of flagged points, capped at 10. Deterministic rules, not a trained model.</p>
            </div>

            <div>
              <Label t="2 · Honeypot replay" right={inc.evidence ? `outcome ${inc.evidence.outcome}` : "not run yet"} />
              {inc.evidence ? (
                <>
                  <HoneypotTerminal key={inc.id} lines={inc.evidence.log} crashes={inc.evidence.crashed} />
                  <div className="mt-3 grid gap-3 text-xs sm:grid-cols-3">
                    {(
                      [
                        ["Observed", inc.evidence.observed, "text-ink"],
                        ["Inferred", inc.evidence.inferred, "text-cisco"],
                        ["Unknown", inc.evidence.unknown, "text-dim"],
                      ] as const
                    ).map(([h, xs, c]) => (
                      <div key={h} className="border p-2">
                        <p className="mb-1 font-semibold tracking-wider text-muted uppercase">{h}</p>
                        <ul className={`list-disc space-y-1 pl-4 ${c}`}>
                          {xs.map((x) => (
                            <li key={x}>{x}</li>
                          ))}
                        </ul>
                      </div>
                    ))}
                  </div>
                </>
              ) : (
                <p className="border bg-bg p-3 text-xs text-dim">The packet has not been replayed yet. Use “Next step”.</p>
              )}
            </div>

            {inc.analysis && (
              <div>
                <Label t="3 · Analysis" />
                <p className="border bg-bg p-3 text-sm">
                  <span className="font-mono font-semibold text-cisco uppercase">{inc.analysis.conclusion}</span> · <span className="text-muted">{inc.analysis.rationale}</span>
                </p>
              </div>
            )}
          </div>

          <div className="space-y-5 bg-panel p-5">
            <div>
              <Label t="4 · Proposed virtual patch" right={prop ? `${prop.rule.id} · expires in 24h` : "none"} />
              {prop ? (
                <>
                  <pre className="border bg-bg p-3 font-mono text-xs whitespace-pre-wrap">
                    <span className="text-cisco">+ {prop.rule.id} DENY if {prop.scope}</span>
                    {"\n"}
                    <span className="text-dim"># why: {prop.rationale}</span>
                  </pre>
                  <p className={`mt-2 border px-3 py-2 text-xs ${prop.safe ? "border-emerald-500/50 text-emerald-300" : "border-red-500/60 text-red-300"}`}>
                    Pre-deployment test (isolated policy copy, {prop.preCheck.cases.length - 1} legitimate samples):{" "}
                    <b>{prop.safe ? "PASS" : `UNSAFE: blocks ${prop.preCheck.blockedLegit} legitimate case(s). Deployment disabled.`}</b>
                  </p>
                  <div className="mt-2 border">
                    <Cases cases={prop.preCheck.cases} />
                  </div>
                </>
              ) : (
                <p className="border bg-bg p-3 text-xs text-dim">
                  {inc.status === "BENIGN" || inc.status === "INCONCLUSIVE" ? "No patch: evidence does not justify a persistent rule." : "Drafted after analysis."}
                </p>
              )}
            </div>

            {inc.verification && (
              <div>
                <Label t="5 · Post-deployment verification" right={inc.verification.passed ? "passed" : "FAILED"} />
                <div className="border">
                  <Cases cases={inc.verification.cases} />
                </div>
              </div>
            )}

            {inc.rollback && (
              <div>
                <Label t="6 · Rollback" right={inc.rollback.restored ? "policy restored" : "FAILED"} />
                <p className="border bg-bg p-3 text-xs text-muted">
                  {inc.rollback.restored
                    ? `Rule removed. Re-checked ${inc.rollback.controls.length} legitimate cases: all allowed again. The source stays quarantined because the threat is still unpatched.`
                    : "The previous policy could not be restored. Manual intervention required."}
                </p>
              </div>
            )}

            <div>
              <Label t="Incident timeline" right={`${eventsFor(state, inc.id).length} events`} />
              <div className="max-h-56 overflow-auto border">
                <EventRows events={eventsFor(state, inc.id)} />
              </div>
            </div>
          </div>
        </div>

        <footer className="flex flex-wrap items-center justify-between gap-4 border-t bg-panel-2 px-5 py-4">
          <div className="text-sm">
            {state.lastError ? (
              <p className="font-mono text-xs text-red-300">Engine refused: {state.lastError}</p>
            ) : inc.status === "AWAITING_REVIEW" ? (
              <p className="text-muted">
                Human decision required. Acting as <span className="text-ink">{persona}</span> <span className="text-dim">(demo persona, not authenticated)</span>.
              </p>
            ) : next ? (
              <p className="text-muted">
                Next automatic step: <span className="font-mono text-ink">{next.type}</span>
              </p>
            ) : (
              <p className="text-muted">No further automatic steps.</p>
            )}
          </div>
          <div className="flex flex-wrap gap-3">
            {inc.containment === "QUARANTINED" && !next && (
              <button onClick={() => dispatch({ type: "RELEASE", incidentId: inc.id, actor: persona })} className="flex items-center gap-2 border bg-panel px-4 py-2.5 text-sm text-muted hover:text-ink">
                <ShieldOff className="h-4 w-4" /> Release quarantine
              </button>
            )}
            {next && (
              <>
                <button disabled={isRunning} onClick={() => dispatch({ type: "ADVANCE", incidentId: inc.id })} className="flex items-center gap-2 border bg-panel px-4 py-2.5 text-sm hover:border-cisco disabled:opacity-40">
                  <StepForward className="h-4 w-4" /> Next step
                </button>
                <button onClick={() => (isRunning ? stop() : autoRun(inc.id))} className="flex items-center gap-2 border border-cisco px-4 py-2.5 text-sm text-cisco hover:bg-cisco/10">
                  {isRunning ? <Pause className="h-4 w-4" /> : <FastForward className="h-4 w-4" />}
                  {isRunning ? "Pause" : "Run to next decision"}
                </button>
              </>
            )}
            {inc.status === "AWAITING_REVIEW" && (
              <>
                <button onClick={() => dispatch({ type: "REJECT", incidentId: inc.id, actor: persona })} className="flex items-center gap-2 border bg-panel px-6 py-2.5 text-sm font-semibold text-muted hover:text-ink">
                  <X className="h-4 w-4" /> Reject
                </button>
                <button
                  disabled={!prop?.safe}
                  title={prop?.safe ? "Install in the virtual firewall, then verify" : "Blocked: failed pre-deployment test"}
                  onClick={() => dispatch({ type: "APPROVE", incidentId: inc.id, actor: persona })}
                  className="flex items-center gap-2 bg-neon px-8 py-2.5 text-sm font-semibold text-white shadow-lg shadow-neon/40 hover:bg-neon-hi disabled:cursor-not-allowed disabled:opacity-40 disabled:shadow-none"
                >
                  <CheckIcon className="h-4 w-4" /> Approve Virtual Patch
                </button>
              </>
            )}
          </div>
        </footer>
      </div>
    </div>
  );
}
