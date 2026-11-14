"use client";
// Style 1 · Map: the real network path across the top, the investigation loop underneath.
// Generous spacing; packets move only on segments that are part of what is happening now.
import { useEffect, useRef, useState } from "react";
import type { TrafficRecord } from "@/lib/simulation/types";
import { HEX, moving, NODE_CLASS, STAGES, STATE_HEX, type Journey, type StageId, type StageState } from "./journey";

/** Route each live connection takes, by the verdict the engine gave it. */
const STREAM: Record<TrafficRecord["verdict"], { d: string; color: string; dur: number }> = {
  ALLOWED: { d: "M90 110 H910", color: "#e6f6fd", dur: 2.6 },
  BLOCKED: { d: "M90 110 H330", color: HEX.red, dur: 1.2 },
  FLAGGED: { d: "M90 110 H610 C610 240 790 210 790 340", color: HEX.red, dur: 2.8 },
};

/** One live connection: travels its route once, then fades. */
function StreamDot({ t }: { t: TrafficRecord }) {
  const m = useRef<SVGAnimateMotionElement>(null);
  const o = useRef<SVGAnimateElement>(null);
  useEffect(() => {
    m.current?.beginElement();
    o.current?.beginElement();
  }, []);
  const r = STREAM[t.verdict];
  return (
    <g filter="url(#glow)">
      <circle r="5" fill={r.color} opacity="0">
        <animateMotion ref={m} begin="indefinite" dur={`${r.dur}s`} path={r.d} fill="freeze" />
        <animate ref={o} attributeName="opacity" begin="indefinite" dur={`${r.dur}s`} values="0;1;1;0" keyTimes="0;0.08;0.85;1" fill="freeze" />
      </circle>
    </g>
  );
}

const W = 1000;
const H = 470;
const POS: Record<StageId, [number, number]> = {
  device: [90, 110],
  firewall: [330, 110],
  detector: [610, 110],
  network: [910, 110],
  fix: [330, 340],
  analyst: [560, 340],
  sandbox: [790, 340],
};

const EDGES: { id: string; from: StageId; to: StageId; d: string; dashed?: boolean }[] = [
  { id: "dev_fw", from: "device", to: "firewall", d: "M90 110 H330" },
  { id: "fw_det", from: "firewall", to: "detector", d: "M330 110 H610" },
  { id: "det_net", from: "detector", to: "network", d: "M610 110 H910" },
  { id: "det_sbx", from: "detector", to: "sandbox", d: "M610 110 C610 240 790 210 790 340" },
  { id: "sbx_an", from: "sandbox", to: "analyst", d: "M790 340 H560" },
  { id: "an_fix", from: "analyst", to: "fix", d: "M560 340 H330" },
  { id: "fix_fw", from: "fix", to: "firewall", d: "M330 340 V110", dashed: true },
];

function edgeState(j: Journey, from: StageId, to: StageId, id: string): StageState {
  const a = j.states[from];
  const b = j.states[to];
  if (id === "fix_fw") return a === "idle" || a === "skipped" ? "idle" : a; // the fix travels up into the firewall
  if (b === "idle" || b === "skipped") return "idle";
  if (a === "bad") return "bad";
  return b === "active" || b === "bad" || b === "ok" || b === "warn" ? b : "done";
}

function Dots({ d, color }: { d: string; color: string }) {
  return (
    <>
      {[0, 0.5, 1].map((b) => (
        <circle key={b} r="6.5" fill={color}>
          <animateMotion dur="1.5s" begin={`${b}s`} repeatCount="indefinite" path={d} />
        </circle>
      ))}
    </>
  );
}

export default function MapView({ j, stream = [] }: { j: Journey; stream?: TrafficRecord[] }) {
  // Only animate connections that arrive after this view mounts (no replay of history).
  const [since] = useState(() => (stream[0]?.tick ?? -1));
  const fresh = stream.filter((t) => t.tick > since).slice(0, 8);
  return (
    <div className="overflow-x-auto">
      <div className="relative mx-auto min-w-[760px]" style={{ aspectRatio: `${W} / ${H}` }}>
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
          {/* lane labels */}
          <text x="0" y="28" fill={HEX.dim} fontSize="13" letterSpacing="2">MAIN PATH</text>
          <rect x="250" y="268" width="640" height="190" rx="28" fill="none" stroke={HEX.line} strokeDasharray="4 8" />
          <text x="365" y="292" fill={HEX.dim} fontSize="13" letterSpacing="2">INVESTIGATION LOOP</text>

          {EDGES.map((e) => {
            const st = edgeState(j, e.from, e.to, e.id);
            const idle = st === "idle";
            return (
              <g key={e.id}>
                <path d={e.d} fill="none" stroke={idle ? HEX.line : STATE_HEX[st]} strokeWidth={idle ? 3 : 5} strokeLinecap="round" strokeDasharray={e.dashed ? "10 10" : undefined} opacity={idle ? 0.8 : 1} filter={idle ? undefined : "url(#glow)"} />
                {/* flowing "current" on the busy segments */}
                {moving(st) && <path d={e.d} fill="none" stroke="#ffffff" strokeOpacity="0.55" strokeWidth="2" strokeLinecap="round" className="dash-flow" />}
              </g>
            );
          })}
          <text x="318" y="232" fill={HEX.dim} fontSize="13" textAnchor="end">installs fix ↑</text>

          {EDGES.map((e) => {
            const st = edgeState(j, e.from, e.to, e.id);
            return moving(st) ? <Dots key={`${e.id}-${st}`} d={e.d} color={STATE_HEX[st]} /> : null;
          })}

          {fresh.map((t) => (
            <StreamDot key={t.packetId} t={t} />
          ))}

          {j.blockedAtFirewall && (
            <g transform="translate(400 110)">
              <circle r="18" fill="#0b1e36" stroke={HEX.red} strokeWidth="3" />
              <path d="M-8 -8 L8 8 M8 -8 L-8 8" stroke={HEX.red} strokeWidth="3.5" strokeLinecap="round" />
            </g>
          )}
        </svg>

        {STAGES.map((s) => {
          const st = j.states[s.id];
          const [x, y] = POS[s.id];
          return (
            <div key={s.id} className="absolute flex w-44 flex-col items-center text-center" style={{ left: `${(x / W) * 100}%`, top: `${(y / H) * 100}%`, transform: "translate(-50%, -38px)" }}>
              <span className="rounded-2xl bg-panel">
                <span className={`flex h-[76px] w-[76px] items-center justify-center rounded-2xl border-2 transition-all duration-500 ${NODE_CLASS[st]} ${st === "active" ? "animate-pulse" : ""}`}>
                  <s.icon className="h-9 w-9" />
                </span>
              </span>
              <span className="mt-3 rounded-md bg-panel px-2">
                <span className={`block text-base font-semibold whitespace-nowrap ${st === "idle" || st === "skipped" ? "text-dim" : "text-ink"}`}>{s.title}</span>
                <span className={`block text-sm whitespace-nowrap ${st === "bad" ? "text-red-300" : st === "ok" ? "text-emerald-300" : st === "warn" ? "text-amber-200" : st === "active" ? "text-neon-hi" : "text-dim"}`}>
                  {j.notes[s.id] ?? (st === "skipped" ? "Not needed" : " ")}
                </span>
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
