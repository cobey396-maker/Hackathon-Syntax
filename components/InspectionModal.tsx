"use client";
import { useEffect } from "react";
import type { SandboxItem } from "@/lib/types";
import HoneypotTerminal from "./HoneypotTerminal";
import { hhmmss, severityBar, severityClass, StatusPill } from "./ui";

export default function InspectionModal({
  item,
  analyst,
  busy,
  onClose,
  onDecide,
}: {
  item: SandboxItem;
  analyst: string;
  busy: boolean;
  onClose: () => void;
  onDecide: (action: "approve" | "override") => void;
}) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const pending = item.status === "pending";
  const label = (t: string) => <h3 className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted">{t}</h3>;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-6" onClick={onClose}>
      <div
        className="flex max-h-full w-full max-w-6xl flex-col overflow-hidden rounded-lg border border-line bg-panel shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <header className="flex items-center justify-between border-b border-line px-6 py-4">
          <div>
            <div className="flex items-center gap-3">
              <h2 className="font-mono text-lg font-semibold">{item.id}</h2>
              <StatusPill status={item.status} />
            </div>
            <p className="mt-1 text-sm text-muted">
              {item.packetType} from <span className="font-mono text-ink">{item.srcIp}</span> · user{" "}
              <span className="font-mono text-ink">{item.user}</span> · {hhmmss(item.ts)} UTC
            </p>
          </div>
          <button onClick={onClose} className="rounded px-3 py-1 text-sm text-muted hover:bg-panel-2 hover:text-ink">
            Close ✕
          </button>
        </header>

        <div className="grid min-h-0 flex-1 grid-cols-2 gap-6 overflow-auto p-6">
          <div className="flex flex-col gap-5">
            <div>
              {label("Malformation severity")}
              <div className="flex items-center gap-4">
                <div className={`rounded-md px-4 py-2 font-mono text-3xl font-bold ring-1 ${severityClass(item.severity)}`}>
                  {item.severity}
                  <span className="text-base font-medium opacity-70">/10</span>
                </div>
                <div className="flex flex-1 gap-1">
                  {Array.from({ length: 10 }, (_, i) => (
                    <div
                      key={i}
                      className={`h-3 flex-1 rounded-sm ${i < item.severity ? severityBar(item.severity) : "bg-line"}`}
                    />
                  ))}
                </div>
                <span className="font-mono text-sm text-muted">{item.confidence}% conf.</span>
              </div>
              <ul className="mt-3 space-y-1">
                {item.findings.map((f) => (
                  <li key={f.label} className="flex gap-3 text-sm">
                    <span className="w-8 shrink-0 font-mono font-semibold text-cisco">+{f.points}</span>
                    <span>{f.label}</span>
                  </li>
                ))}
              </ul>
            </div>

            <div>
              {label("AI reasoning trace")}
              <pre className="rounded-md border border-line bg-bg p-3 font-mono text-xs leading-relaxed whitespace-pre-wrap text-slate-300">
                {item.trace.join("\n")}
              </pre>
            </div>

            <div>
              {label("Captured payload (hex)")}
              <pre className="rounded-md border border-line bg-bg p-3 font-mono text-xs break-all whitespace-pre-wrap text-muted">
                {item.hex}
              </pre>
            </div>
          </div>

          <div className="flex flex-col gap-5">
            <div>
              {label(`Honeypot detonation${item.crashes ? " · parser crash reproduced" : ""}`)}
              <HoneypotTerminal key={item.id} lines={item.honeypot} />
            </div>
            <div>
              {label(`Drafted virtual patch · ${item.ruleId}`)}
              <pre className="rounded-md border border-cisco-deep bg-cisco-deep/15 p-3 font-mono text-xs leading-relaxed text-ink">
                {item.rule}
              </pre>
            </div>
          </div>
        </div>

        <footer className="flex items-center justify-between gap-4 border-t border-line bg-panel-2 px-6 py-4">
          <p className="text-sm text-muted">
            {pending ? (
              <>
                Deciding as <span className="font-medium text-ink">{analyst}</span>. This decision is logged in the audit ledger.
              </>
            ) : (
              "A decision has been recorded for this packet. See the Audit Ledger."
            )}
          </p>
          <div className="flex gap-3">
            <button
              disabled={!pending || busy}
              onClick={() => onDecide("override")}
              className="rounded-md border border-amber-500/60 px-6 py-3 text-sm font-semibold text-amber-300 hover:bg-amber-500/10 disabled:cursor-not-allowed disabled:opacity-40"
            >
              Override (allow traffic)
            </button>
            <button
              disabled={!pending || busy}
              onClick={() => onDecide("approve")}
              className="rounded-md bg-cisco px-8 py-3 text-sm font-semibold text-white hover:bg-cisco/85 disabled:cursor-not-allowed disabled:opacity-40"
            >
              Approve Virtual Patch
            </button>
          </div>
        </footer>
      </div>
    </div>
  );
}
