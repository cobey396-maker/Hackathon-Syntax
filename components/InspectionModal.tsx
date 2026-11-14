"use client";
// Inspection view for one held packet: AI reasoning trace (staged reveal), flagged hex bytes,
// honeypot terminal, drafted virtual patch, and the human oversight controls.
import { useEffect, useState } from "react";
import { Check as CheckIcon, X } from "lucide-react";
import type { Check, Decision, LedgerEntry, SandboxItem } from "@/lib/types";
import HoneypotTerminal from "./HoneypotTerminal";
import { Confidence, hhmmss, Sev, sevText, StatusPill, td, th } from "./soc";

const TICK_MS = 280;

function hexClass(i: number, checks: Check[], shownChecks: number, hover: number | null) {
  const idx = checks.findIndex((c, k) => k < shownChecks && c.bytes && i >= c.bytes[0] && i <= c.bytes[1]);
  if (idx < 0) return "text-dim";
  const ring = hover === idx ? " outline outline-1 outline-cisco" : "";
  return (checks[idx].ok ? "text-emerald-400" : "bg-red-500/20 text-red-300") + ring;
}

export default function InspectionModal({
  item,
  ledger,
  analyst,
  busy,
  onClose,
  onDecide,
}: {
  item: SandboxItem;
  ledger: LedgerEntry[];
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
  const liveScore = Math.min(10, item.checks.slice(0, shownChecks).reduce((s, c) => s + c.points, 0));
  const failed = item.checks.filter((c) => !c.ok && c.kind === "parser").map((c) => c.field);
  const decision = ledger.find((e) => e.itemId === item.id);
  const rows = Array.from({ length: Math.ceil(item.bytes.length / 16) }, (_, r) => item.bytes.slice(r * 16, r * 16 + 16));
  const label = (t: string, right?: string) => (
    <p className="mb-2 flex items-baseline justify-between text-xs font-semibold tracking-wider text-muted uppercase">
      <span>{t}</span>
      {right && <span className="font-mono font-normal text-dim normal-case">{right}</span>}
    </p>
  );

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-4 animate-in fade-in-0 duration-150" onClick={onClose}>
      <div
        className="flex max-h-full w-full max-w-7xl flex-col border bg-panel shadow-2xl animate-in zoom-in-95 duration-150"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-label={`Inspect ${item.id}`}
      >
        {/* header */}
        <header className="flex flex-wrap items-center justify-between gap-4 border-b px-5 py-3">
          <div>
            <div className="flex items-center gap-3">
              <h2 className="font-mono text-base font-semibold">{item.id}</h2>
              <StatusPill status={item.status} />
            </div>
            <p className="mt-0.5 font-mono text-xs text-muted">
              {item.protocol} ClientHello · <span className="text-ink">{item.srcIp}</span> → vpn-gw-01:443 · user={item.user} · {hhmmss(item.ts)} UTC · held before firewall
            </p>
          </div>
          <div className="flex items-center gap-6">
            <div>
              <p className="text-xs tracking-wider text-dim uppercase">Threat confidence</p>
              <Confidence value={item.confidence} />
            </div>
            <div>
              <p className="text-xs tracking-wider text-dim uppercase">Severity</p>
              <div className="flex items-center gap-2">
                <span className={`font-mono text-lg font-semibold tabular-nums ${sevText(liveScore || 1)}`}>{liveScore}/10</span>
                <Sev value={liveScore} bar num={false} />
              </div>
            </div>
            <div className="w-28">
              <p className="text-xs tracking-wider text-dim uppercase">AI verdict</p>
              <p className="font-mono text-sm">{done ? "complete" : "analysing…"}</p>
            </div>
            <button onClick={onClose} className="p-1 text-muted hover:text-ink" aria-label="Close">
              <X className="h-4 w-4" />
            </button>
          </div>
        </header>

        {/* body */}
        <div className="grid min-h-0 flex-1 gap-px overflow-auto bg-line lg:grid-cols-2">
          <div className="space-y-5 bg-panel p-5">
            <div>
              {label("AI reasoning trace", `${item.timings.totalMs.toFixed(2)} ms inline`)}
              <div className="border bg-bg px-3 py-2 font-mono text-xs leading-relaxed">
                {tick === 0 ? (
                  <span className="text-dim">parsing record header…</span>
                ) : (
                  <>
                    <p className="text-red-300">
                      Anomaly detected: {failed.length ? failed.join(", ") : "handshake"} malformed in {item.protocol} ClientHello. Bypasses signature-based IPS (no rule match).
                    </p>
                    {verdictShown && (
                      <p className="mt-1 text-ink animate-in fade-in-0">
                        Verdict: hold in sandbox. Severity {item.severity}/10, confidence {item.confidence}%. Drafting virtual patch {item.ruleId}.
                      </p>
                    )}
                  </>
                )}
              </div>
              <table className="mt-3 w-full">
                <thead>
                  <tr>
                    {["Check", "Observed", "Expected", "Result", "Pts"].map((h) => (
                      <th key={h} className={`${th} ${h === "Pts" ? "text-right" : ""}`}>
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {item.checks.map((c, i) => {
                    const shown = i < shownChecks;
                    return (
                      <tr
                        key={c.field}
                        onMouseEnter={() => setHover(i)}
                        onMouseLeave={() => setHover(null)}
                        className={`border-b border-line/60 ${hover === i ? "bg-cisco/10" : ""}`}
                      >
                        <td className={`${td} font-mono`}>
                          <span className="mr-2 text-xs text-dim">{c.kind === "parser" ? "P" : c.kind === "model" ? "M" : "S"}</span>
                          {c.field}
                        </td>
                        <td className={`${td} font-mono ${shown && !c.ok ? "text-red-300" : ""}`}>{shown ? c.observed : ""}</td>
                        <td className={`${td} font-mono text-dim`}>{c.expected}</td>
                        <td className={`${td} font-mono text-xs font-semibold`}>
                          {shown ? (
                            c.ok ? <span className="text-emerald-400">PASS</span> : <span className="text-red-400">FAIL</span>
                          ) : i === shownChecks ? (
                            <span className="text-cisco">checking…</span>
                          ) : (
                            <span className="font-normal text-dim">queued</span>
                          )}
                        </td>
                        <td className={`${td} text-right font-mono ${shown && c.points ? "text-cisco" : "text-dim"}`}>{shown ? (c.points ? `+${c.points}` : "0") : ""}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            <div>
              {label("Captured header", `${item.bytes.length} bytes · hover a check to locate it`)}
              <pre className="border bg-bg p-3 font-mono text-xs leading-relaxed">
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
            </div>
          </div>

          <div className="space-y-5 bg-panel p-5">
            <div>
              {label("Honeypot terminal", item.crashes ? "parser crash expected" : "no crash expected")}
              <HoneypotTerminal key={item.id} lines={item.honeypot} crashes={item.crashes} />
            </div>

            <div>
              {label(`Drafted virtual patch · ${item.ruleId}`, `${item.plan.length} changes · ${item.status === "patched" ? "applied" : item.status === "allowed" ? "discarded" : "not applied"}`)}
              <pre className="min-h-24 border bg-bg py-2 font-mono text-xs leading-relaxed break-all whitespace-pre-wrap">
                {item.plan.slice(0, planShown).map((l) => (
                  <div key={l.cmd} className="px-3 animate-in fade-in-0">
                    <div className={item.status === "allowed" ? "text-dim line-through" : "text-cisco"}>
                      <span className="mr-2 select-none text-cisco/60">+</span>
                      {l.cmd}
                    </div>
                    <div className="pl-4 text-dim"># {l.note}</div>
                  </div>
                ))}
                {planShown === 0 && <span className="px-3 text-dim">waiting for verdict…</span>}
              </pre>
              {done && (
                <p className="mt-2 flex items-start gap-3 border px-3 py-2 text-sm">
                  <span className={`mt-0.5 font-mono text-xs font-semibold ${item.impact.matched ? "text-amber-300" : "text-emerald-400"}`}>
                    {item.impact.matched ? "WARN" : "PASS"}
                  </span>
                  <span className="text-muted">
                    False-positive check: these rules match <span className="font-mono text-ink">{item.impact.matched}</span> of the last{" "}
                    <span className="font-mono text-ink">{item.impact.window}</span> legitimate sessions.
                  </span>
                </p>
              )}
            </div>
          </div>
        </div>

        {/* human oversight controls */}
        <footer className="flex flex-wrap items-center justify-between gap-4 border-t bg-panel-2 px-5 py-4">
          {item.status === "pending" ? (
            <>
              <p className="text-sm text-muted">
                {done ? (
                  <>
                    Human review required. Signing as <span className="text-ink">{analyst}</span>; the decision is written to the audit ledger.
                  </>
                ) : (
                  "Controls unlock when the AI trace completes."
                )}
              </p>
              <div className="flex gap-3">
                <button
                  disabled={!done || busy}
                  onClick={() => onDecide("deny")}
                  className="flex items-center gap-2 border bg-panel px-6 py-3 text-sm font-semibold text-muted hover:text-ink disabled:cursor-not-allowed disabled:opacity-40"
                >
                  <X className="h-4 w-4" />
                  Override
                </button>
                <button
                  disabled={!done || busy}
                  onClick={() => onDecide("approve")}
                  className="flex items-center gap-2 bg-neon px-8 py-3 text-sm font-semibold text-white shadow-lg shadow-neon/40 transition-colors hover:bg-neon-hi disabled:cursor-not-allowed disabled:opacity-40 disabled:shadow-none"
                >
                  <CheckIcon className="h-4 w-4" />
                  Approve Virtual Patch
                </button>
              </div>
            </>
          ) : (
            <p className="font-mono text-xs text-muted">
              {item.status === "patched" ? <span className="text-neon-hi">PATCH APPLIED</span> : <span>OVERRIDDEN · packet released</span>}
              {decision && ` · ${decision.analyst} · ${decision.ts.slice(11, 19)} UTC · ${decision.id}`}
            </p>
          )}
        </footer>
      </div>
    </div>
  );
}
