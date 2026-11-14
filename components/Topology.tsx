"use client";
// Packet path diagram. Each new traffic record animates once along the path its verdict took:
// blocked at the virtual firewall, flagged into the sandbox, or allowed through to the gateway.
import { useEffect, useRef } from "react";
import { counts } from "@/lib/simulation/selectors";
import type { TrafficRecord } from "@/lib/simulation/types";
import { useSimulation } from "./simulation/SimulationProvider";
import { Pane } from "./soc";

const PATHS = {
  ALLOWED: "M150 40 L830 40",
  BLOCKED: "M150 40 L285 40",
  FLAGGED: "M150 40 L490 40 Q540 40 540 90",
};
const COLOR = { ALLOWED: "#049fd9", BLOCKED: "#c858ff", FLAGGED: "#f87171" };

function Dot({ t }: { t: TrafficRecord }) {
  const motion = useRef<SVGAnimateMotionElement>(null);
  const fade = useRef<SVGAnimateElement>(null);
  useEffect(() => {
    motion.current?.beginElement();
    fade.current?.beginElement();
  }, []);
  return (
    <circle r={t.verdict === "ALLOWED" ? 4 : 5.5} fill={COLOR[t.verdict]} opacity="0">
      <animateMotion ref={motion} begin="indefinite" dur="1.3s" path={PATHS[t.verdict]} fill="freeze" />
      <animate ref={fade} attributeName="opacity" begin="indefinite" dur="1.3s" values="1;1;0.9;0" keyTimes="0;0.1;0.9;1" fill="freeze" />
    </circle>
  );
}

function Box({ x, y = 18, w = 135, h = 44, label, sub, stroke = "#1e2330", accent = "#f3f4f6" }: { x: number; y?: number; w?: number; h?: number; label: string; sub: string; stroke?: string; accent?: string }) {
  return (
    <g>
      <rect x={x} y={y} width={w} height={h} fill="#11141b" stroke={stroke} strokeWidth="1.25" />
      <text x={x + 10} y={y + 18} fill={accent} fontSize="12" fontWeight="600" fontFamily="var(--font-mono)" letterSpacing="0.5">{label}</text>
      <text x={x + 10} y={y + 34} fill="#5b6476" fontSize="11" fontFamily="var(--font-mono)">{sub}</text>
    </g>
  );
}

export default function Topology() {
  const { state } = useSimulation();
  const c = counts(state);
  return (
    <Pane
      title="Synthetic packet path"
      meta={
        <>
          <span className="flex items-center gap-1.5"><span className="h-1.5 w-1.5 rounded-full bg-cisco" />allowed</span>
          <span className="flex items-center gap-1.5"><span className="h-1.5 w-1.5 rounded-full bg-neon-hi" />blocked by policy</span>
          <span className="flex items-center gap-1.5"><span className="h-1.5 w-1.5 rounded-full bg-red-400" />flagged</span>
        </>
      }
      className="shrink-0"
    >
      <svg viewBox="0 0 1000 132" className="h-36 w-full" preserveAspectRatio="xMidYMid meet" role="img" aria-label="Packet path: internet, virtual firewall, detector, VPN gateway; flagged packets diverted to sandbox">
        <path d={PATHS.ALLOWED} stroke="#1e2330" strokeWidth="2" fill="none" />
        <path d="M470 40 L490 40 Q540 40 540 90" stroke="#3b1d1d" strokeWidth="2" strokeDasharray="4 4" fill="none" />
        {state.traffic.slice(0, 6).map((t) => (
          <Dot key={t.packetId} t={t} />
        ))}
        <Box x={20} label="SYNTHETIC SRC" sub={`${c.analyzed} packets`} />
        <Box x={285} label="VIRTUAL FW" sub={`${state.firewall.rules.length} rules · ${state.firewall.quarantined.length} quar.`} stroke="#5b2a7a" accent="#c858ff" />
        <Box x={560} label="DETECTOR" sub={`${c.detected} flagged`} stroke="#049fd9" accent="#049fd9" w={130} />
        <Box x={830} label="VPN GATEWAY" sub={`${c.allowed} allowed`} />
        <Box x={465} y={90} h={38} w={150} label="SANDBOX" sub={`${c.open} open incidents`} stroke="#5b2a2a" accent="#f87171" />
      </svg>
    </Pane>
  );
}
