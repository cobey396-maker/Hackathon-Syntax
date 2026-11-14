"use client";
// Packet map: the real network path across the top, the investigation loop underneath.
// Every handshake is a dot. Clean ones travel to the company network, threats are diverted
// into the sandbox, and repeats of a patched attack stop at the AI Shield.
import { useEffect, useRef, useState } from "react";
import { Building2, FlaskConical, Laptop, ScanSearch, ShieldCheck, ShieldPlus, UserCheck, type LucideIcon } from "lucide-react";
import type { Stats, TrafficEvent } from "@/lib/types";

const W = 1000;
const H = 430;
const HEX = { line: "#1d3b5f", dim: "#64809f", blue: "#049fd9", red: "#ff5c55", amber: "#fbab18", green: "#6cc04a", panel: "#0b1e36" };

type NodeId = "device" | "shield" | "firewall" | "network" | "patch" | "analyst" | "sandbox";
type NodeState = "idle" | "active" | "bad" | "ok" | "warn";

const NODES: { id: NodeId; icon: LucideIcon; title: string; x: number; y: number }[] = [
  { id: "device", icon: Laptop, title: "Remote user", x: 90, y: 110 },
  { id: "shield", icon: ScanSearch, title: "AI Shield", x: 370, y: 110 },
  { id: "firewall", icon: ShieldCheck, title: "Firewall", x: 680, y: 110 },
  { id: "network", icon: Building2, title: "Company network", x: 910, y: 110 },
  { id: "patch", icon: ShieldPlus, title: "Virtual patch", x: 370, y: 320 },
  { id: "analyst", icon: UserCheck, title: "Analyst", x: 580, y: 320 },
  { id: "sandbox", icon: FlaskConical, title: "Holding Center", x: 790, y: 320 },
];

const DIVERT = "M370 110 H500 C500 270 790 190 790 320";
const ROUTE: Record<TrafficEvent["verdict"], { d: string; color: string; dur: number; r: number }> = {
  allowed: { d: "M90 110 H910", color: "#e6f6fd", dur: 2.4, r: 4.5 },
  sandboxed: { d: `M90 110 H370 ${DIVERT.slice(DIVERT.indexOf("H"))}`, color: HEX.red, dur: 2.6, r: 6.5 },
  blocked: { d: "M90 110 H322", color: HEX.amber, dur: 1.1, r: 6.5 },
};

const NODE_CLASS: Record<NodeState, string> = {
  idle: "border-line bg-panel-2 text-dim",
  active: "border-cisco bg-cisco/15 text-sky",
  bad: "border-crit bg-crit/15 text-crit-hi",
  ok: "border-ok bg-ok/15 text-ok-hi",
  warn: "border-warn bg-warn/15 text-warn-hi",
};
const NOTE_CLASS: Record<NodeState, string> = { idle: "text-dim", active: "text-sky", bad: "text-crit-hi", ok: "text-ok-hi", warn: "text-warn-hi" };
const STATE_HEX: Record<NodeState, string> = { idle: HEX.line, active: HEX.blue, bad: HEX.red, ok: HEX.green, warn: HEX.amber };

// One handshake: travels its route once, then fades. Replays real arrival spacing, ~1.5 s behind the wire.
function Dot({ ev, now }: { ev: TrafficEvent; now: number }) {
  const [delay] = useState(() => Math.max(0, 1.5 - (now - Date.parse(ev.ts)) / 1000));
  const motion = useRef<SVGAnimateMotionElement>(null);
  const fade = useRef<SVGAnimateElement>(null);
  useEffect(() => {
    motion.current?.beginElementAt(delay);
    fade.current?.beginElementAt(delay);
  }, [delay]);
  const r = ROUTE[ev.verdict];
  return (
    <circle r={r.r} fill={r.color} opacity="0" filter="url(#glow)">
      <animateMotion ref={motion} begin="indefinite" dur={`${r.dur}s`} path={r.d} fill="freeze" />
      <animate ref={fade} attributeName="opacity" begin="indefinite" dur={`${r.dur}s`} values="0;1;1;0" keyTimes="0;0.08;0.85;1" fill="freeze" />
    </circle>
  );
}

export default function Topology({
  traffic,
  stats,
  now,
  pending,
  critical,
  patches,
  quarantines,
}: {
  traffic: TrafficEvent[];
  stats: Stats;
  now: number;
  pending: number; // held packets waiting for a human
  critical: number; // of those, how many are under the Critical Response Protocol
  patches: number; // approved virtual patches live at the edge
  quarantines: number;
}) {
  const live = traffic.filter((e) => now - Date.parse(e.ts) < 3000);
  const hit = traffic.find((e) => e.verdict === "sandboxed" && now - Date.parse(e.ts) < 2500);
  const refused = traffic.find((e) => e.verdict === "blocked" && now - Date.parse(e.ts) < 2500);

  const loop: NodeState = pending === 0 ? "idle" : critical ? "bad" : "warn";
  const state: Record<NodeId, NodeState> = {
    device: stats.seen ? "active" : "idle",
    shield: refused ? "warn" : hit ? "bad" : "active",
    firewall: stats.legit ? "ok" : "idle",
    network: stats.legit ? "ok" : "idle",
    sandbox: loop,
    analyst: pending ? "active" : "idle",
    patch: patches ? "ok" : "idle",
  };
  const note: Record<NodeId, string> = {
    device: `${stats.seen.toLocaleString("en-US")} handshakes`,
    shield: refused ? `Refused by ${refused.ruleId}` : hit ? "Held a handshake" : `Inline · ${stats.avgVerdictMs.toFixed(2)} ms`,
    firewall: `${stats.crashesPrevented} crash${stats.crashesPrevented === 1 ? "" : "es"} avoided`,
    network: `${stats.legit.toLocaleString("en-US")} sessions`,
    sandbox: `${stats.sandboxed} held so far`,
    analyst: pending ? `${pending} waiting` : "Nothing waiting",
    patch: quarantines ? `${patches} live · ${quarantines} quarantined` : `${patches} live at the edge`,
  };

  const edges: { id: string; d: string; state: NodeState; flow?: boolean; dashed?: boolean }[] = [
    { id: "main", d: "M90 110 H910", state: "idle" },
    { id: "divert", d: DIVERT, state: loop, flow: pending > 0 },
    { id: "sbx_an", d: "M790 320 H580", state: loop, flow: pending > 0 },
    { id: "an_fix", d: "M580 320 H370", state: patches ? "ok" : "idle" },
    { id: "fix_sh", d: "M370 320 V110", state: patches ? "ok" : "idle", flow: patches > 0, dashed: true },
  ];

  return (
    <div className="overflow-x-auto">
      <div className="relative mx-auto min-w-3xl" style={{ aspectRatio: `${W} / ${H}` }}>
        <svg viewBox={`0 0 ${W} ${H}`} className="absolute inset-0 h-full w-full overflow-visible" aria-hidden>
          <defs>
            <filter id="glow" filterUnits="userSpaceOnUse" x="-50" y="-50" width={W + 100} height={H + 100}>
              <feGaussianBlur stdDeviation="4" result="b" />
              <feMerge>
                <feMergeNode in="b" />
                <feMergeNode in="SourceGraphic" />
              </feMerge>
            </filter>
          </defs>

          <text x="0" y="28" fill={HEX.dim} fontSize="13" letterSpacing="2">MAIN PATH</text>
          <rect x="285" y="238" width="590" height="184" rx="28" fill="none" stroke={HEX.line} strokeDasharray="4 8" />
          <text x="440" y="262" fill={HEX.dim} fontSize="13" letterSpacing="2">INVESTIGATION LOOP</text>
          <text x="358" y="222" fill={HEX.dim} fontSize="13" textAnchor="end">installs fix ↑</text>

          {edges.map((e) => {
            const idle = e.state === "idle";
            return (
              <g key={e.id}>
                <path d={e.d} fill="none" stroke={STATE_HEX[e.state]} strokeWidth={idle ? 3 : 5} strokeLinecap="round" strokeDasharray={e.dashed ? "10 10" : undefined} opacity={idle ? 0.8 : 1} filter={idle ? undefined : "url(#glow)"} />
                {e.flow && <path d={e.d} fill="none" stroke="#ffffff" strokeOpacity="0.55" strokeWidth="2" strokeLinecap="round" className="dash-flow" />}
              </g>
            );
          })}

          {live.map((e) => (
            <Dot key={e.seq} ev={e} now={now} />
          ))}

          {/* repeat attacks stop here */}
          {refused && (
            <g transform="translate(300 110)">
              <circle r="16" fill={HEX.panel} stroke={HEX.amber} strokeWidth="3" />
              <path d="M-7 -7 L7 7 M7 -7 L-7 7" stroke={HEX.amber} strokeWidth="3.5" strokeLinecap="round" />
            </g>
          )}
        </svg>

        {NODES.map((n) => {
          const st = state[n.id];
          return (
            <div key={n.id} className="absolute flex w-44 flex-col items-center text-center" style={{ left: `${(n.x / W) * 100}%`, top: `${(n.y / H) * 100}%`, transform: "translate(-50%, -38px)" }}>
              <span className="rounded-2xl bg-panel">
                <span className={`flex h-19 w-19 items-center justify-center rounded-2xl border-2 transition-all duration-500 ${NODE_CLASS[st]} ${st === "bad" ? "animate-pulse" : ""}`}>
                  <n.icon className="h-9 w-9" />
                </span>
              </span>
              <span className="mt-2 rounded-md bg-panel px-2">
                <span className={`block font-semibold whitespace-nowrap ${st === "idle" ? "text-dim" : "text-ink"}`}>{n.title}</span>
                <span className={`block text-sm whitespace-nowrap ${NOTE_CLASS[st]}`}>{note[n.id]}</span>
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
