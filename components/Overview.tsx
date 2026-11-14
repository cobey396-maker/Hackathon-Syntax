"use client";
// Home screen: a hero with the demo controls, a slim row of live numbers, the live packet map,
// and one tabbed card for threats / deployed fixes / how it works.
import { useState } from "react";
import { CheckCircle2, FlaskConical, Play, Radar, UserCheck } from "lucide-react";
import type { DashboardState } from "@/lib/types";
import DeployedPatches from "./DeployedPatches";
import LiveTicker from "./LiveTicker";
import SandboxQueue from "./SandboxQueue";
import { Kbd, mmss } from "./soc";
import Topology from "./Topology";

const HOW = [
  { icon: Radar, title: "Spot", text: "The AI Shield checks every VPN handshake inline, before the firewall sees it." },
  { icon: FlaskConical, title: "Test safely", text: "A held handshake is replayed against an isolated parser, then Claude grades it 1 to 10." },
  { icon: UserCheck, title: "Human decides", text: "An analyst approves or overrides the drafted fix. Severity 7+ needs two analysts." },
  { icon: CheckCircle2, title: "Enforce", text: "The approved virtual patch refuses repeat attacks at the edge." },
];

type Tab = "threats" | "fixes" | "how";
type Tone = "info" | "bad" | "ok" | "warn";
const CAPTION: Record<Tone, string> = {
  info: "border-cisco bg-cisco/10",
  bad: "border-crit bg-crit/10",
  ok: "border-ok bg-ok/10",
  warn: "border-warn bg-warn/10",
};

// One plain-English line about what is happening right now, derived from live state
function caption(state: DashboardState): [Tone, string] {
  const last = state.traffic[0];
  if (last?.verdict === "blocked" && state.now - Date.parse(last.ts) < 6000)
    return ["ok", `A repeat attack from ${last.srcIp} was refused at the edge by ${last.ruleId}. It never reached the firewall.`];
  const held = state.items.filter((i) => i.status === "pending").sort((a, b) => b.ts.localeCompare(a.ts))[0];
  if (!held) return ["info", "Normal logins are flowing through the AI Shield to the firewall. Send an attack to see it get caught."];
  if (held.ai.status === "grading") return ["warn", `${held.id} from ${held.srcIp} was held before the firewall. Claude is grading how dangerous it is…`];
  if (held.crp)
    return [
      "bad",
      `${held.ai.attackClass} from ${held.srcIp}: severity ${held.severity}/10. The source is quarantined and two analysts must sign${
        Date.parse(held.crp.slaDeadline) > state.now ? ` within ${mmss(Date.parse(held.crp.slaDeadline) - state.now)}` : " (response SLA breached)"
      }.`,
    ];
  return ["warn", `${held.ai.attackClass} from ${held.srcIp} is held in the Holding Center at severity ${held.severity}/10, waiting for an analyst.`];
}

export default function Overview({
  state,
  pending,
  live,
  onLive,
  onKey,
  onOpen,
}: {
  state: DashboardState;
  pending: number;
  live: boolean;
  onLive: (on: boolean) => void;
  onKey: (k: "z" | "c" | "r") => void;
  onOpen: (id: string) => void;
}) {
  const [tab, setTab] = useState<Tab>("threats");
  const s = state.stats;
  const stats: [string, number, string][] = [
    ["Connections checked", s.seen, "text-ink"],
    ["Threats held", s.sandboxed, "text-crit-hi"],
    ["Waiting for a human", pending, "text-sky"],
    ["Fixes approved", s.patched, "text-ok-hi"],
    ["Refused at the edge", s.blockedAtEdge, "text-warn-hi"],
    ["Crashes prevented", s.crashesPrevented, "text-ink"],
  ];
  const patches = state.deployed.filter((d) => d.kind === "patch").length;
  const quarantines = state.deployed.length - patches;
  const critical = state.items.filter((i) => i.status === "pending" && i.crp).length;
  const tabs: [Tab, string, number?][] = [
    ["threats", "Threats", state.items.length],
    ["fixes", "Deployed fixes", state.deployed.length],
    ["how", "How it works"],
  ];
  const [tone, text] = caption(state);

  return (
    <div className="space-y-8">
      {/* hero */}
      <section>
        <p className="mb-3 inline-flex items-center gap-2 rounded-full border border-cisco/40 bg-cisco/10 px-3 py-1 text-xs font-semibold tracking-wider text-sky uppercase">Human-in-the-loop VPN defense</p>
        <h1 className="text-4xl leading-tight font-bold tracking-tight sm:text-5xl">
          The AI investigates. <span className="bg-linear-to-r from-sky to-ok-hi bg-clip-text text-transparent">The human authorizes.</span>
          <br className="hidden md:block" /> The edge enforces.
        </h1>
        <div className="mt-5 flex flex-wrap items-center justify-between gap-5">
          <p className="max-w-xl text-lg text-muted">Zero-day VPN handshakes are held before the firewall, tested safely, graded by Claude, and patched only when a person approves.</p>
          <div className="flex flex-wrap gap-3">
            <button onClick={() => onKey("c")} className="btn-glow flex items-center gap-2 rounded-xl bg-cisco px-6 py-3.5 text-lg font-semibold text-white transition hover:bg-sky">
              <Play className="h-5 w-5" /> Run the attack demo <Kbd>C</Kbd>
            </button>
            <button onClick={() => onKey("z")} className="flex items-center gap-2 rounded-xl border bg-panel/80 px-5 py-3.5 text-lg text-muted backdrop-blur hover:border-cisco hover:text-ink">
              Send a zero-day <Kbd>Z</Kbd>
            </button>
            <button onClick={() => onKey("r")} className="flex items-center gap-2 rounded-xl border bg-panel/80 px-5 py-3.5 text-lg text-muted backdrop-blur hover:border-cisco hover:text-ink">
              Replay last attack <Kbd>R</Kbd>
            </button>
          </div>
        </div>
      </section>

      {/* slim live numbers */}
      <section className="grid grid-cols-2 gap-px overflow-hidden rounded-2xl border bg-line sm:grid-cols-3 lg:grid-cols-6">
        {stats.map(([label, value, color]) => (
          <div key={label} className="bg-panel/95 px-5 py-4">
            {/* re-keyed on change so each new value pops in */}
            <p key={value} className={`text-3xl font-bold tabular-nums animate-in fade-in-0 slide-in-from-bottom-2 duration-300 ${color}`}>
              {value.toLocaleString("en-US")}
            </p>
            <p className="text-sm text-muted">{label}</p>
          </div>
        ))}
      </section>

      <div className="space-y-4">
        <LiveTicker traffic={state.traffic} live={live} onLive={onLive} />
        <div className="glow-ring">
          <section className="relative rounded-3xl border bg-panel/95 p-6 backdrop-blur sm:p-8">
            <div className="mb-6 flex flex-wrap items-center gap-3">
              <h2 className="text-xl font-semibold">Watch handshakes travel through the shield</h2>
              {state.simOnline && (
                <span className="flex items-center gap-1.5 rounded-full bg-ok/15 px-2.5 py-0.5 text-xs font-semibold tracking-wider text-ok-hi">
                  <span className="live-dot h-1.5 w-1.5 rounded-full bg-ok" /> LIVE
                </span>
              )}
            </div>
            <Topology traffic={state.traffic} stats={s} now={state.now} pending={pending} critical={critical} patches={patches} quarantines={quarantines} />
            <p className={`mt-6 rounded-2xl border-l-4 px-5 py-4 text-lg ${CAPTION[tone]}`} aria-live="polite">
              {text}
            </p>
          </section>
        </div>
      </div>

      {/* one tabbed card */}
      <section className="rounded-3xl border bg-panel/85 p-6 backdrop-blur">
        <div role="tablist" aria-label="Overview sections" className="mb-5 flex flex-wrap gap-1 border-b">
          {tabs.map(([id, label, n]) => (
            <button
              key={id}
              role="tab"
              aria-selected={tab === id}
              onClick={() => setTab(id)}
              className={`-mb-px flex items-center gap-2 border-b-2 px-4 py-2.5 text-sm font-semibold ${tab === id ? "border-cisco text-ink" : "border-transparent text-muted hover:text-ink"}`}
            >
              {label}
              {n !== undefined && n > 0 && <span className="rounded-full bg-cisco/20 px-2 text-xs text-sky">{n}</span>}
            </button>
          ))}
        </div>

        {tab === "threats" && <SandboxQueue items={state.items} now={state.now} onOpen={onOpen} />}
        {tab === "fixes" && <DeployedPatches deployed={state.deployed} now={state.now} />}
        {tab === "how" && (
          <ol className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {HOW.map((h, i) => (
              <li key={h.title} className="flex items-start gap-3 rounded-2xl border bg-bg/40 p-4">
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-cisco/15 text-sky">
                  <h.icon className="h-5 w-5" />
                </span>
                <div className="min-w-0">
                  <p className="font-semibold">
                    {i + 1}. {h.title}
                  </p>
                  <p className="text-sm text-muted">{h.text}</p>
                </div>
              </li>
            ))}
          </ol>
        )}
      </section>
    </div>
  );
}
