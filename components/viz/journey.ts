// One shared description of "where is this connection right now", derived only from engine state.
// Every visual style (map, timeline, spotlight) renders this same model, so they always agree.
import { Building2, FlaskConical, Laptop, ScanSearch, ShieldCheck, ShieldPlus, UserCheck, type LucideIcon } from "lucide-react";
import type { Incident, TrafficRecord } from "@/lib/simulation/types";

export type StageId = "device" | "firewall" | "detector" | "sandbox" | "analyst" | "fix" | "network";
export type StageState = "idle" | "done" | "active" | "bad" | "ok" | "warn" | "skipped";
export type Tone = "info" | "bad" | "ok" | "warn";

export const STAGES: { id: StageId; icon: LucideIcon; title: string; blurb: string }[] = [
  { id: "device", icon: Laptop, title: "Remote user", blurb: "A laptop on Wi-Fi connects through the VPN gateway" },
  { id: "firewall", icon: ShieldCheck, title: "Firewall", blurb: "Checks the connection against approved rules" },
  { id: "detector", icon: ScanSearch, title: "Threat detector", blurb: "Runs 5 checks for warning signs" },
  { id: "sandbox", icon: FlaskConical, title: "Sandbox", blurb: "Isolates and replays it against a test firewall" },
  { id: "analyst", icon: UserCheck, title: "Analyst", blurb: "A human approves or rejects the proposed fix" },
  { id: "fix", icon: ShieldPlus, title: "Fix & verify", blurb: "Installs the fix and proves it works" },
  { id: "network", icon: Building2, title: "Company network", blurb: "Apps and data that real users need" },
];

export type Journey = {
  states: Record<StageId, StageState>;
  notes: Partial<Record<StageId, string>>; // short status under each stage
  active: StageId | null; // the stage to spotlight
  headline: string; // big one-liner for the spotlight
  caption: string; // plain-English explanation
  tone: Tone;
  blockedAtFirewall: boolean; // draw the ✕: repeat attacks stop here
};

const all = (s: StageState): Record<StageId, StageState> => ({ device: s, firewall: s, detector: s, sandbox: s, analyst: s, fix: s, network: s });

function make(partial: Partial<Record<StageId, StageState>>, rest: Omit<Journey, "states">): Journey {
  return { states: { ...all("idle"), ...partial }, ...rest };
}

const IN = { device: "done", firewall: "done" } as const; // got past the gateway and firewall
const IN_NOTES = { device: "Connected", firewall: "No rule matched, let through" };

export function journeyForIncident(inc: Incident, fixes: number): Journey {
  const harmful = inc.evidence?.outcome === "BUFFER_OVERRUN" || inc.evidence?.outcome === "STATE_DESYNC";
  const base = { blockedAtFirewall: false };
  switch (inc.status) {
    case "DETECTED":
      return make({ ...IN, detector: "bad" }, { ...base, notes: { ...IN_NOTES, detector: "Warning signs found" }, active: "detector", headline: "Warning signs spotted", caption: "The connection got past the firewall, but the threat detector found warning signs.", tone: "bad" });
    case "CONTAINED":
      return make({ ...IN, detector: "done", sandbox: "active" }, { ...base, notes: { ...IN_NOTES, detector: "Flagged", sandbox: "Isolating…" }, active: "sandbox", headline: "Moved into the sandbox", caption: "Pulled off the network into an isolated sandbox. It cannot reach company systems.", tone: "warn" });
    case "SIMULATED":
    case "ANALYZED":
      return make(
        { ...IN, detector: "done", sandbox: harmful ? "bad" : "warn" },
        {
          ...base,
          notes: { ...IN_NOTES, detector: "Flagged", sandbox: harmful ? "Caused harm (safely)" : "No harm reproduced" },
          active: "sandbox",
          headline: harmful ? "It crashed the test firewall" : "No harm reproduced",
          caption: harmful ? "Replayed against a test copy of the firewall. It caused harm, but only inside the sandbox." : "Replayed in the sandbox. Nothing harmful happened.",
          tone: harmful ? "bad" : "warn",
        },
      );
    case "PROPOSED":
    case "AWAITING_REVIEW":
      return make({ ...IN, detector: "done", sandbox: "done", analyst: "active" }, { ...base, notes: { ...IN_NOTES, detector: "Flagged", sandbox: "Harm confirmed", analyst: "Waiting for you" }, active: "analyst", headline: "Waiting for a human", caption: "Evidence and a proposed fix go to an analyst. Nothing changes until a person approves.", tone: "info" });
    case "REJECTED":
      return make({ ...IN, detector: "done", sandbox: "done", analyst: "warn", fix: "skipped", network: "skipped" }, { ...base, notes: { ...IN_NOTES, detector: "Flagged", sandbox: "Tested", analyst: "Rejected", fix: "Not applied" }, active: "analyst", headline: "Fix rejected", caption: "The analyst said no, so the firewall was not changed.", tone: "warn" });
    case "ENFORCED":
      return make({ ...IN, detector: "done", sandbox: "done", analyst: "done", fix: "active" }, { ...base, notes: { ...IN_NOTES, detector: "Flagged", sandbox: "Harm confirmed", analyst: "Approved", fix: "Installing & testing…" }, active: "fix", headline: "Installing the fix", caption: "Approved. The fix goes into the firewall and is tested against real-user traffic.", tone: "info" });
    case "VERIFIED":
      return make(
        { device: "bad", firewall: "ok", detector: "done", sandbox: "done", analyst: "done", fix: "ok", network: "ok" },
        {
          blockedAtFirewall: true,
          notes: { device: "Attacker retries", firewall: "Now blocks it", detector: "Flagged", sandbox: "Harm confirmed", analyst: "Approved", fix: "Works, users fine", network: "Normal users get in" },
          active: "fix",
          headline: "Protected",
          caption: `Repeat attacks now stop at the firewall (${fixes} fix active), and normal users still reach the network.`,
          tone: "ok",
        },
      );
    case "VERIFY_FAILED":
      return make({ ...IN, detector: "done", sandbox: "done", analyst: "done", fix: "bad" }, { ...base, notes: { ...IN_NOTES, detector: "Flagged", sandbox: "Harm confirmed", analyst: "Approved", fix: "Blocked a real user" }, active: "fix", headline: "The fix broke something", caption: "Testing showed the fix also blocks a normal user. Undoing it now.", tone: "bad" });
    case "ROLLED_BACK":
    case "ROLLBACK_FAILED": {
      const ok = inc.status === "ROLLED_BACK";
      return make(
        { ...IN, detector: "done", sandbox: "warn", analyst: "done", fix: ok ? "warn" : "bad" },
        {
          ...base,
          notes: { ...IN_NOTES, detector: "Flagged", sandbox: "Still isolated", analyst: "Approved", fix: ok ? "Undone safely" : "Undo failed" },
          active: "fix",
          headline: ok ? "Fix undone safely" : "Undo failed",
          caption: ok ? "The firewall is back to how it was. The suspicious connection stays isolated." : "The firewall could not be restored. Needs manual attention.",
          tone: ok ? "warn" : "bad",
        },
      );
    }
    case "BENIGN":
      return make({ ...IN, detector: "done", sandbox: "ok", analyst: "skipped", fix: "skipped", network: "ok" }, { ...base, notes: { ...IN_NOTES, detector: "Looked unusual", sandbox: "No harm found", analyst: "Not needed", fix: "Not needed", network: "User let in" }, active: "network", headline: "False alarm, user let in", caption: "The sandbox found no harm, so the user was released. No real user gets blocked.", tone: "ok" });
    case "INCONCLUSIVE":
      return make({ ...IN, detector: "done", sandbox: "warn" }, { ...base, notes: { ...IN_NOTES, detector: "Flagged", sandbox: "Held for review" }, active: "sandbox", headline: "Not enough proof", caption: "Odd, but no proof of harm. It stays isolated for an analyst, with no permanent block.", tone: "warn" });
  }
}

export function journeyForTraffic(t: TrafficRecord | undefined): Journey {
  if (!t) return make({}, { blockedAtFirewall: false, notes: {}, active: null, headline: "Ready", caption: "Pick a scenario to send a connection through ShieldOps.", tone: "info" });
  if (t.verdict === "BLOCKED")
    return make(
      { device: "bad", firewall: "ok", detector: "skipped", sandbox: "skipped", analyst: "skipped", fix: "skipped", network: "skipped" },
      { blockedAtFirewall: true, notes: { device: "Known attack", firewall: "Blocked by approved fix", network: "Never reached" }, active: "firewall", headline: "Blocked at the firewall", caption: "An approved fix stopped it at the firewall, before it reached anything else.", tone: "ok" },
    );
  if (t.verdict === "ALLOWED")
    return make(
      { device: "done", firewall: "done", detector: "ok", sandbox: "skipped", analyst: "skipped", fix: "skipped", network: "ok" },
      { blockedAtFirewall: false, notes: { device: "Connected", firewall: "Let through", detector: "All checks passed", network: "User let in" }, active: "network", headline: "Normal user let in", caption: "Every check passed and the user reached the company network.", tone: "ok" },
    );
  return make({ ...IN, detector: "bad", sandbox: "active" }, { blockedAtFirewall: false, notes: { ...IN_NOTES, detector: "Warning signs", sandbox: "Isolating…" }, active: "sandbox", headline: "Threat caught", caption: "Suspicious connection caught and sent to the sandbox.", tone: "bad" });
}

// ── shared styling ───────────────────────────────────────────────────────────────────────
export const HEX = { blue: "#049fd9", sky: "#00bceb", green: "#6cc04a", yellow: "#fbab18", red: "#ff5c55", line: "#1d3b5f", dim: "#3a5a80" };

export const STATE_HEX: Record<StageState, string> = { idle: HEX.line, done: HEX.blue, active: HEX.sky, bad: HEX.red, ok: HEX.green, warn: HEX.yellow, skipped: HEX.line };

export const NODE_CLASS: Record<StageState, string> = {
  idle: "border-line bg-panel text-dim",
  skipped: "border-line/60 bg-panel text-dim/60 border-dashed",
  done: "border-neon/60 bg-neon/10 text-neon-hi",
  active: "border-neon-hi bg-neon/20 text-white shadow-[0_0_0_6px_rgba(0,188,235,0.18)]",
  bad: "border-red-400 bg-red-500/15 text-red-300 shadow-[0_0_0_6px_rgba(255,92,85,0.15)]",
  ok: "border-emerald-400 bg-emerald-500/15 text-emerald-300 shadow-[0_0_0_6px_rgba(108,192,74,0.15)]",
  warn: "border-amber-400 bg-amber-500/15 text-amber-200",
};

export const TONE_CLASS: Record<Tone, string> = {
  info: "border-neon bg-neon/10",
  bad: "border-red-400 bg-red-500/10",
  ok: "border-emerald-400 bg-emerald-500/10",
  warn: "border-amber-400 bg-amber-500/10",
};

export const TONE_TEXT: Record<Tone, string> = { info: "text-neon-hi", bad: "text-red-300", ok: "text-emerald-300", warn: "text-amber-200" };

/** Packets move on a segment when its destination is busy or has an outcome. */
export const moving = (s: StageState) => s === "active" || s === "bad" || s === "ok";
