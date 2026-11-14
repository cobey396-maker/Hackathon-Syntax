// Derived views over the shared state, so every screen counts things the same way.
import type { Incident, IncidentStatus, SimState } from "./types.ts";

export const OPEN: IncidentStatus[] = ["DETECTED", "CONTAINED", "SIMULATED", "ANALYZED", "PROPOSED", "AWAITING_REVIEW", "ENFORCED", "VERIFY_FAILED"];

export function counts(s: SimState) {
  const by = (st: IncidentStatus) => s.incidents.filter((i) => i.status === st).length;
  return {
    analyzed: Object.keys(s.packets).length,
    allowed: s.traffic.filter((t) => t.verdict === "ALLOWED").length,
    blocked: s.traffic.filter((t) => t.verdict === "BLOCKED").length,
    detected: s.incidents.length,
    quarantined: s.incidents.filter((i) => i.containment === "QUARANTINED").length,
    awaitingReview: by("AWAITING_REVIEW"),
    verified: by("VERIFIED"),
    rolledBack: by("ROLLED_BACK"),
    rejected: by("REJECTED"),
    open: s.incidents.filter((i) => OPEN.includes(i.status)).length,
    patchRules: s.firewall.rules.filter((r) => r.origin === "patch").length,
  };
}

export const incidentById = (s: SimState, id: string | null): Incident | undefined => (id ? s.incidents.find((i) => i.id === id) : undefined);

export const eventsFor = (s: SimState, incidentId: string) => s.events.filter((e) => e.incidentId === incidentId);
