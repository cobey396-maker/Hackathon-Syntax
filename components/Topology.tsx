"use client";
// Live inline topology: each handshake is a dot. Clean ones pass the AI Shield and the
// firewall into the LAN; threats are diverted at the shield into the sandbox.
import { useEffect, useRef, useState } from "react";
import type { Stats, TrafficEvent } from "@/lib/types";
import { Pane } from "./soc";

const CLEAN = "M150 40 L830 40";
const THREAT = "M150 40 L440 40 Q490 40 490 90";

function Dot({ ev, now }: { ev: TrafficEvent; now: number }) {
  const threat = ev.verdict === "sandboxed";
  // replay real arrival spacing, ~1.5 s behind the wire; captured once at mount
  const [delay] = useState(() => Math.max(0, 1.5 - (now - Date.parse(ev.ts)) / 1000));
  const motion = useRef<SVGAnimateMotionElement>(null);
  const fade = useRef<SVGAnimateElement>(null);
  useEffect(() => {
    motion.current?.beginElementAt(delay);
    fade.current?.beginElementAt(delay);
  }, [delay]);
  const dur = threat ? "1.1s" : "1.6s";
  return (
    <circle r={threat ? 5 : 3.5} fill={threat ? "#f87171" : "#049fd9"} opacity="0">
      <animateMotion ref={motion} begin="indefinite" dur={dur} path={threat ? THREAT : CLEAN} fill="freeze" />
      <animate ref={fade} attributeName="opacity" begin="indefinite" dur={dur} values="1;1;0.9;0" keyTimes="0;0.1;0.9;1" fill="freeze" />
    </circle>
  );
}

function Box({ x, y = 18, w = 130, h = 44, label, sub, stroke = "#1e2330", accent = "#f3f4f6" }: {
  x: number; y?: number; w?: number; h?: number; label: string; sub: string; stroke?: string; accent?: string;
}) {
  return (
    <g>
      <rect x={x} y={y} width={w} height={h} fill="#11141b" stroke={stroke} strokeWidth="1.25" />
      <text x={x + 10} y={y + 18} fill={accent} fontSize="12" fontWeight="600" fontFamily="var(--font-mono)" letterSpacing="0.5">{label}</text>
      <text x={x + 10} y={y + 34} fill="#5b6476" fontSize="11" fontFamily="var(--font-mono)">{sub}</text>
    </g>
  );
}

export default function Topology({ traffic, stats, now }: { traffic: TrafficEvent[]; stats: Stats; now: number }) {
  const live = traffic.filter((e) => now - Date.parse(e.ts) < 3000);
  const hit = traffic.find((e) => e.verdict === "sandboxed" && now - Date.parse(e.ts) < 2500);

  return (
    <Pane
      title="Inline packet path"
      meta={
        <>
          <span className="flex items-center gap-1.5"><span className="h-1.5 w-1.5 rounded-full bg-cisco" />clean</span>
          <span className="flex items-center gap-1.5"><span className="h-1.5 w-1.5 rounded-full bg-red-400" />held</span>
        </>
      }
      className="shrink-0"
    >
      <svg viewBox="0 0 1000 132" className="h-36 w-full" preserveAspectRatio="xMidYMid meet" role="img" aria-label="Packet path: internet, AI Shield, firewall, LAN; threats diverted to sandbox">
        {/* wires */}
        <path d={CLEAN} stroke="#1e2330" strokeWidth="2" fill="none" />
        <path d="M420 40 L440 40 Q490 40 490 90" stroke="#3b1d1d" strokeWidth="2" strokeDasharray="4 4" fill="none" />
        <text x="505" y="70" fill="#5b6476" fontSize="10" fontFamily="var(--font-mono)">divert</text>

        {live.map((e) => <Dot key={e.seq} ev={e} now={now} />)}

        <Box x={20} label="INTERNET" sub={`${stats.seen} handshakes`} />
        <Box
          x={290}
          label="AI SHIELD"
          sub={`inline · ${stats.avgVerdictMs.toFixed(2)} ms`}
          stroke={hit ? "#f87171" : "#049fd9"}
          accent="#049fd9"
        />
        <Box x={560} label="FIREWALL" sub={`ASA/FTD · ${stats.crashesPrevented} crashes avoided`} w={150} />
        <Box x={830} label="LAN" sub={`${stats.legit} sessions`} />
        <Box x={425} y={90} h={38} w={150} label="SANDBOX" sub={`${stats.sandboxed} held`} stroke="#5b2a2a" accent="#f87171" />
      </svg>
    </Pane>
  );
}
