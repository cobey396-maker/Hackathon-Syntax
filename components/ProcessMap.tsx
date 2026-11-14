"use client";
// Animated map of where a connection is in the system. The layout matches the engine's real order:
// the firewall policy is checked before the detector, and an approved fix is installed back into
// the firewall. What is lit up and which packets move is derived from engine state only.
import { Building2, FlaskConical, Laptop, ScanSearch, ShieldCheck, UserCheck, Wifi } from "lucide-react";
import type { Incident, TrafficRecord } from "@/lib/simulation/types";

type NodeId = "device" | "gateway" | "firewall" | "detector" | "network" | "sandbox" | "analyst";
type EdgeId = "dev_gw" | "gw_fw" | "fw_det" | "det_net" | "det_sbx" | "sbx_an" | "an_fw";
type NodeState = "idle" | "done" | "active" | "bad" | "ok" | "warn";
type EdgeState = "idle" | "done" | "flow" | "bad" | "ok" | "blocked";

const POS: Record<NodeId, [number, number]> = {
  device: [80, 80],
  gateway: [265, 80],
  firewall: [450, 80],
  detector: [635, 80],
  network: [900, 80],
  sandbox: [635, 235],
  analyst: [450, 235],
};

const EDGES: Record<EdgeId, string> = {
  dev_gw: "M80 80 H265",
  gw_fw: "M265 80 H450",
  fw_det: "M450 80 H635",
  det_net: "M635 80 H900",
  det_sbx: "M635 80 V235",
  sbx_an: "M635 235 H450",
  an_fw: "M450 235 V80",
};

const NODES: Record<NodeId, { icon: typeof Laptop; label: string; sub: string }> = {
  device: { icon: Laptop, label: "Remote user", sub: "laptop on Wi-Fi" },
  gateway: { icon: Wifi, label: "VPN gateway", sub: "entry point" },
  firewall: { icon: ShieldCheck, label: "Firewall", sub: "policy check" },
  detector: { icon: ScanSearch, label: "Threat detector", sub: "5 checks" },
  network: { icon: Building2, label: "Company network", sub: "apps & data" },
  sandbox: { icon: FlaskConical, label: "Sandbox", sub: "isolated test" },
  analyst: { icon: UserCheck, label: "Analyst", sub: "human approval" },
};

const C = { blue: "#049fd9", sky: "#00bceb", green: "#6cc04a", yellow: "#fbab18", red: "#ff5c55", line: "#1d3b5f", dim: "#2a4a70" };

type View = { nodes: Partial<Record<NodeId, NodeState>>; edges: Partial<Record<EdgeId, EdgeState>>; caption: string; tone: "info" | "bad" | "ok" | "warn" };

const ENTRY: View["edges"] = { dev_gw: "done", gw_fw: "done", fw_det: "done" };
const ENTRY_NODES: View["nodes"] = { device: "done", gateway: "done", firewall: "done" };

export function viewForIncident(inc: Incident, fixes: number): View {
  const harmful = inc.evidence && (inc.evidence.outcome === "BUFFER_OVERRUN" || inc.evidence.outcome === "STATE_DESYNC");
  switch (inc.status) {
    case "DETECTED":
      return { nodes: { ...ENTRY_NODES, detector: "bad" }, edges: { dev_gw: "bad", gw_fw: "bad", fw_det: "bad" }, caption: "The connection passed the firewall, but the detector spotted warning signs.", tone: "bad" };
    case "CONTAINED":
      return { nodes: { ...ENTRY_NODES, detector: "done", sandbox: "active" }, edges: { ...ENTRY, det_sbx: "flow" }, caption: "Pulled off the network and moved into an isolated sandbox. It cannot reach company systems.", tone: "warn" };
    case "SIMULATED":
    case "ANALYZED":
      return {
        nodes: { ...ENTRY_NODES, detector: "done", sandbox: harmful ? "bad" : "warn" },
        edges: { ...ENTRY, det_sbx: "done" },
        caption: harmful ? "Replayed against a test copy of the firewall: it caused harm, safely inside the sandbox." : "Replayed in the sandbox: no harm reproduced.",
        tone: harmful ? "bad" : "warn",
      };
    case "PROPOSED":
    case "AWAITING_REVIEW":
      return { nodes: { ...ENTRY_NODES, detector: "done", sandbox: "done", analyst: "active" }, edges: { ...ENTRY, det_sbx: "done", sbx_an: "flow" }, caption: "Evidence and a proposed fix are sent to a human analyst. Nothing changes until they approve.", tone: "info" };
    case "REJECTED":
      return { nodes: { ...ENTRY_NODES, detector: "done", sandbox: "done", analyst: "warn" }, edges: { ...ENTRY, det_sbx: "done", sbx_an: "done" }, caption: "The analyst rejected the fix, so the firewall was not changed.", tone: "warn" };
    case "ENFORCED":
      return { nodes: { ...ENTRY_NODES, detector: "done", sandbox: "done", analyst: "done", firewall: "active" }, edges: { ...ENTRY, det_sbx: "done", sbx_an: "done", an_fw: "flow" }, caption: "Approved. The fix is installed in the firewall and is being tested.", tone: "info" };
    case "VERIFIED":
      return {
        nodes: { device: "bad", gateway: "done", firewall: "ok", detector: "done", network: "ok", sandbox: "done", analyst: "done" },
        edges: { dev_gw: "bad", gw_fw: "bad", fw_det: "blocked", det_net: "ok", det_sbx: "done", sbx_an: "done", an_fw: "done" },
        caption: `Repeat attacks now stop at the firewall (${fixes} fix active), and normal users still reach the network.`,
        tone: "ok",
      };
    case "VERIFY_FAILED":
      return { nodes: { ...ENTRY_NODES, firewall: "bad", detector: "done", sandbox: "done", analyst: "done" }, edges: { ...ENTRY, det_sbx: "done", sbx_an: "done", an_fw: "done" }, caption: "The fix blocked a normal user during testing. Undoing it…", tone: "bad" };
    case "ROLLED_BACK":
    case "ROLLBACK_FAILED":
      return {
        nodes: { ...ENTRY_NODES, firewall: inc.status === "ROLLED_BACK" ? "warn" : "bad", detector: "done", sandbox: "warn", analyst: "done" },
        edges: { ...ENTRY, det_sbx: "done", sbx_an: "done", an_fw: "done" },
        caption: inc.status === "ROLLED_BACK" ? "The fix was removed and the firewall is back to normal. The connection stays isolated in the sandbox." : "The undo failed. Needs manual attention.",
        tone: "warn",
      };
    case "BENIGN":
      return { nodes: { ...ENTRY_NODES, detector: "done", sandbox: "ok", network: "ok" }, edges: { ...ENTRY, det_sbx: "done", det_net: "ok" }, caption: "False alarm. The sandbox found no harm, so the user was released to the network.", tone: "ok" };
    case "INCONCLUSIVE":
      return { nodes: { ...ENTRY_NODES, detector: "done", sandbox: "warn" }, edges: { ...ENTRY, det_sbx: "done" }, caption: "Not enough proof either way. It stays isolated in the sandbox for an analyst to look into.", tone: "warn" };
  }
}

export function viewForTraffic(t: TrafficRecord | undefined): View {
  if (!t) return { nodes: {}, edges: {}, caption: "Pick a scenario to send a connection through the system.", tone: "info" };
  if (t.verdict === "BLOCKED")
    return { nodes: { device: "bad", gateway: "done", firewall: "ok" }, edges: { dev_gw: "bad", gw_fw: "bad", fw_det: "blocked" }, caption: "Blocked at the firewall by an approved fix, before it reached anything else.", tone: "ok" };
  if (t.verdict === "ALLOWED")
    return { nodes: { device: "done", gateway: "done", firewall: "done", detector: "ok", network: "ok" }, edges: { dev_gw: "ok", gw_fw: "ok", fw_det: "ok", det_net: "ok" }, caption: "A normal connection: every check passed and the user reached the company network.", tone: "ok" };
  return { nodes: { ...ENTRY_NODES, detector: "bad", sandbox: "active" }, edges: { ...ENTRY, det_sbx: "flow" }, caption: "Suspicious connection caught and sent to the sandbox.", tone: "bad" };
}

const NODE_STYLE: Record<NodeState, string> = {
  idle: "border-line bg-panel text-dim",
  done: "border-neon/50 bg-neon/10 text-neon-hi",
  active: "border-neon-hi bg-neon/25 text-white ring-4 ring-neon/30 animate-pulse",
  bad: "border-red-400 bg-red-500/20 text-red-300 ring-4 ring-red-500/20",
  ok: "border-emerald-400 bg-emerald-500/20 text-emerald-300 ring-4 ring-emerald-500/20",
  warn: "border-amber-400 bg-amber-500/20 text-amber-200",
};

const EDGE_COLOR: Record<EdgeState, string> = { idle: C.line, done: C.blue, flow: C.sky, bad: C.red, ok: C.green, blocked: C.red };
const TONE_BAR = { info: "border-neon bg-neon/10", bad: "border-red-400 bg-red-500/10", ok: "border-emerald-400 bg-emerald-500/10", warn: "border-amber-400 bg-amber-500/10" };

function Packets({ id, color }: { id: EdgeId; color: string }) {
  // Three dots looping along the edge; begin offsets space them out.
  return (
    <>
      {[0, 0.45, 0.9].map((b) => (
        <circle key={b} r="6" fill={color}>
          <animateMotion dur="1.35s" begin={`${b}s`} repeatCount="indefinite" path={EDGES[id]} />
        </circle>
      ))}
    </>
  );
}

export default function ProcessMap({ view, title = "What's happening right now" }: { view: View; title?: string }) {
  return (
    <section className="rounded-2xl border border-line bg-panel p-5">
      <h2 className="mb-3 text-lg font-semibold">{title}</h2>
      <div className="overflow-x-auto">
        <div className="relative mx-auto aspect-[1000/350] min-w-[720px]">
          <svg viewBox="0 0 1000 350" className="absolute inset-0 h-full w-full" aria-hidden>
            {(Object.keys(EDGES) as EdgeId[]).map((id) => {
              const st = view.edges[id] ?? "idle";
              return (
                <path
                  key={id}
                  d={EDGES[id]}
                  fill="none"
                  stroke={EDGE_COLOR[st]}
                  strokeWidth={st === "idle" ? 3 : 4}
                  strokeDasharray={id === "an_fw" || st === "blocked" ? "8 8" : undefined}
                  strokeLinecap="round"
                  opacity={st === "idle" ? 0.7 : 1}
                />
              );
            })}
            <text x="438" y="182" fill={C.dim} fontSize="14" textAnchor="end">installs fix ↑</text>
            {(Object.keys(EDGES) as EdgeId[]).map((id) => {
              const st = view.edges[id];
              return st === "flow" || st === "bad" || st === "ok" ? <Packets key={`${id}-${st}`} id={id} color={EDGE_COLOR[st]} /> : null;
            })}
            {view.edges.fw_det === "blocked" && (
              <g transform="translate(500 80)">
                <circle r="16" fill="#061426" stroke={C.red} strokeWidth="3" />
                <path d="M-7 -7 L7 7 M7 -7 L-7 7" stroke={C.red} strokeWidth="3.5" strokeLinecap="round" />
              </g>
            )}
          </svg>

          {(Object.keys(NODES) as NodeId[]).map((id) => {
            const n = NODES[id];
            const st = view.nodes[id] ?? "idle";
            const [x, y] = POS[id];
            return (
              <div key={id} className="absolute flex w-40 -translate-x-1/2 -translate-y-[34px] flex-col items-center text-center" style={{ left: `${x / 10}%`, top: `${(y / 350) * 100}%` }}>
                {/* opaque base so connector lines never show through the tinted box */}
                <span className="rounded-2xl bg-panel">
                  <span className={`flex h-[68px] w-[68px] items-center justify-center rounded-2xl border-2 transition-all duration-500 ${NODE_STYLE[st]}`}>
                    <n.icon className="h-8 w-8" />
                  </span>
                </span>
                <span className="mt-2 rounded-md bg-panel px-1.5 text-center">
                  <span className={`block whitespace-nowrap text-sm font-semibold ${st === "idle" ? "text-dim" : "text-ink"}`}>{n.label}</span>
                  <span className="block text-xs text-dim">{n.sub}</span>
                </span>
              </div>
            );
          })}
        </div>
      </div>
      <p className={`mt-3 rounded-xl border-l-4 px-4 py-3 text-lg ${TONE_BAR[view.tone]}`} aria-live="polite">
        {view.caption}
      </p>
    </section>
  );
}
