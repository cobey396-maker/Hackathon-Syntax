"use client";
// Audit trail as a readable timeline. Every entry is written by the engine when something happens.
import { useState } from "react";
import type { AuditEvent } from "@/lib/simulation/types";
import { simTime } from "./time";
import { useSimulation } from "./simulation/SimulationProvider";
import { Card } from "./ui";

const LABEL: Record<AuditEvent["type"], string> = {
  TRAFFIC_ALLOWED: "Normal connection allowed",
  TRAFFIC_BLOCKED: "Blocked by firewall",
  DETECTED: "Threat spotted",
  CONTAINED: "Connection isolated",
  QUARANTINE_RELEASED: "Isolation lifted",
  SIMULATED: "Sandbox test finished",
  ANALYZED: "Evidence analyzed",
  CLASSIFIED: "Classified",
  PROPOSED: "Fix drafted",
  REVIEW_REQUESTED: "Sent for human review",
  APPROVED: "Human approved fix",
  REJECTED: "Human rejected fix",
  DEPLOYED: "Fix applied",
  VERIFIED: "Fix verified",
  VERIFY_FAILED: "Fix failed verification",
  ROLLED_BACK: "Fix undone",
  ROLLBACK_FAILED: "Undo failed",
  RULE_EXPIRED: "Fix expired",
  RESET: "Reset",
};

const DOT: Record<AuditEvent["outcome"], string> = { ok: "bg-emerald-400", warn: "bg-amber-300", fail: "bg-red-400" };

export default function ActivityLog() {
  const { state } = useSimulation();
  // Live mode adds a routine "allowed" entry every couple of seconds; hide those unless asked.
  const [routine, setRoutine] = useState(false);
  const events = routine ? state.events : state.events.filter((e) => e.type !== "TRAFFIC_ALLOWED");
  return (
    <Card>
      <h2 className="text-xl font-semibold">Activity log</h2>
      <p className="mb-5 text-muted">Every step and every human decision, in order. Demo data kept in this browser only.</p>
      <label className="mb-5 flex w-fit cursor-pointer items-center gap-2 text-sm text-muted">
        <input type="checkbox" checked={routine} onChange={(e) => setRoutine(e.target.checked)} className="accent-[#049fd9]" />
        Show routine allowed connections
      </label>
      {events.length === 0 ? (
        <p className="rounded-xl border border-dashed border-line p-8 text-center text-muted">Nothing yet. Run a scenario.</p>
      ) : (
        <ol className="relative space-y-4 border-l border-line pl-6">
          {events.map((e) => {
            const human = e.actor !== "system";
            return (
              <li key={e.id} className="relative">
                <span className={`absolute top-2 -left-[29px] h-2.5 w-2.5 rounded-full ${DOT[e.outcome]}`} />
                <div className="flex flex-wrap items-baseline gap-x-3">
                  <p className={`font-semibold ${human ? "text-neon-hi" : ""}`}>{LABEL[e.type]}</p>
                  {e.incidentId && <span className="text-sm text-muted">{e.incidentId}</span>}
                  <span className="text-sm text-dim">{simTime(e.tick)}</span>
                  {human && <span className="rounded-full bg-neon/15 px-2 py-0.5 text-xs text-neon-hi">{e.actor}</span>}
                </div>
                <p className="text-sm text-muted">{e.summary}</p>
              </li>
            );
          })}
        </ol>
      )}
    </Card>
  );
}
