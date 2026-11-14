"use client";
// Home screen, kept to roughly two screens: a hero with one clear call to action, a slim row of
// live numbers, the live visualization, and one tabbed card for scenarios / threats / how it works.
import { useState } from "react";
import { ArrowRight, CheckCircle2, FlaskConical, Play, Radar, UserCheck } from "lucide-react";
import { SCENARIOS } from "@/lib/simulation/scenarios";
import { counts } from "@/lib/simulation/selectors";
import LiveTicker from "./LiveTicker";
import { useSimulation } from "./simulation/SimulationProvider";
import { StatusBadge } from "./ui";
import { journeyForTraffic } from "./viz/journey";
import JourneyPanel from "./viz/JourneyPanel";

const HOW = [
  { icon: Radar, title: "Spot", text: "Check every connection for warning signs" },
  { icon: FlaskConical, title: "Test safely", text: "Isolate it and replay it in a sandbox" },
  { icon: UserCheck, title: "Human decides", text: "An analyst approves or rejects the fix" },
  { icon: CheckCircle2, title: "Verify", text: "Prove the fix works without blocking real users" },
];

// Plain one-liners for the audience (the technical summary stays in scenarios.ts).
const SCENARIO_TEXT: Record<string, string> = {
  legit: "An employee logs in from home.",
  "malformed-tls": "A connection built to crash the firewall.",
  "false-positive": "Looks odd, but it's a real user.",
  "broad-patch": "The drafted fix would block real users.",
  rollback: "A fix fails late testing and is undone.",
  inconclusive: "Odd, but not enough proof to block.",
};

const SCENARIO_TAG: Record<string, string> = {
  legit: "Normal user",
  "malformed-tls": "Main demo",
  "false-positive": "False alarm",
  "broad-patch": "Unsafe fix",
  rollback: "Undo",
  inconclusive: "Uncertain",
};

type Tab = "scenarios" | "threats" | "how";

export default function Overview({ onLaunch, onOpen }: { onLaunch: (id: string) => void; onOpen: (id: string) => void }) {
  const { state } = useSimulation();
  const c = counts(state);
  const [tab, setTab] = useState<Tab>("scenarios");
  const stats: [string, number, string][] = [
    ["Connections checked", c.analyzed, "text-ink"],
    ["Threats caught", c.detected, "text-red-300"],
    ["Waiting for a human", c.awaitingReview, "text-neon-hi"],
    ["Fixes verified", c.verified, "text-emerald-300"],
  ];
  const tabs: [Tab, string, number?][] = [
    ["scenarios", "Try a scenario"],
    ["threats", "Threats", state.incidents.length],
    ["how", "How it works"],
  ];

  return (
    <div className="space-y-8">
      {/* hero */}
      <section>
        <p className="mb-3 inline-flex items-center gap-2 rounded-full border border-neon/40 bg-neon/10 px-3 py-1 text-xs font-semibold tracking-wider text-neon-hi uppercase">
          Human-in-the-loop VPN defense
        </p>
        <h1 className="text-4xl leading-[1.1] font-bold tracking-tight sm:text-5xl">
          The AI investigates. <span className="bg-gradient-to-r from-neon-hi to-emerald-300 bg-clip-text text-transparent">The human authorizes.</span>
          <br className="hidden md:block" /> The system verifies.
        </h1>
        <div className="mt-5 flex flex-wrap items-center justify-between gap-5">
          <p className="max-w-xl text-lg text-muted">Catch suspicious connections, test them safely, and let a person approve every fix, without blocking real users.</p>
          <div className="flex flex-wrap gap-3">
            <button
              onClick={() => onLaunch("malformed-tls")}
              className="flex items-center gap-2 rounded-xl bg-neon px-6 py-3.5 text-lg font-semibold text-white shadow-[0_0_30px_rgba(4,159,217,0.45)] transition hover:bg-neon-hi hover:shadow-[0_0_40px_rgba(0,188,235,0.6)]"
            >
              <Play className="h-5 w-5" /> Run the attack demo
            </button>
            <button onClick={() => onLaunch("false-positive")} className="rounded-xl border border-line bg-panel/80 px-5 py-3.5 text-lg text-muted backdrop-blur hover:border-neon hover:text-ink">
              Try a false alarm
            </button>
          </div>
        </div>
      </section>

      {/* slim live numbers */}
      <section className="grid grid-cols-2 divide-line rounded-2xl border border-line bg-panel/80 backdrop-blur sm:grid-cols-4 sm:divide-x">
        {stats.map(([label, value, color]) => (
          <div key={label} className="px-5 py-4">
            {/* re-keyed on change so each new value pops in */}
            <p key={value} className={`text-3xl font-bold tabular-nums animate-in fade-in-0 slide-in-from-bottom-2 duration-300 ${color}`}>
              {value}
            </p>
            <p className="text-sm text-muted">{label}</p>
          </div>
        ))}
      </section>

      <div className="space-y-4">
        <LiveTicker />
        <JourneyPanel title="Watch connections travel through ShieldOps" j={journeyForTraffic(state.traffic[0])} />
      </div>

      {/* one tabbed card instead of three stacked sections */}
      <section className="rounded-3xl border border-line bg-panel/85 p-6 backdrop-blur">
        <div role="tablist" aria-label="Overview sections" className="mb-5 flex flex-wrap gap-1 border-b border-line">
          {tabs.map(([id, label, n]) => (
            <button
              key={id}
              role="tab"
              aria-selected={tab === id}
              onClick={() => setTab(id)}
              className={`-mb-px flex items-center gap-2 border-b-2 px-4 py-2.5 text-sm font-semibold ${tab === id ? "border-neon text-ink" : "border-transparent text-muted hover:text-ink"}`}
            >
              {label}
              {n !== undefined && n > 0 && <span className="rounded-full bg-neon/20 px-2 text-xs text-neon-hi">{n}</span>}
            </button>
          ))}
        </div>

        {tab === "scenarios" && (
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {SCENARIOS.map((s) => (
              <button
                key={s.id}
                onClick={() => onLaunch(s.id)}
                className={`group rounded-2xl border p-4 text-left transition hover:-translate-y-0.5 hover:border-neon hover:shadow-[0_8px_30px_rgba(4,159,217,0.15)] ${s.id === "malformed-tls" ? "border-neon/50 bg-neon/5" : "border-line bg-bg/40"}`}
              >
                <div className="mb-1 flex items-center justify-between gap-2">
                  <span className="rounded-full bg-panel-2 px-2.5 py-0.5 text-xs text-muted">{SCENARIO_TAG[s.id]}</span>
                  <ArrowRight className="h-4 w-4 text-dim transition group-hover:translate-x-0.5 group-hover:text-neon-hi" />
                </div>
                <p className="font-semibold">{s.name}</p>
                <p className="text-sm text-muted">{SCENARIO_TEXT[s.id] ?? s.summary}</p>
              </button>
            ))}
          </div>
        )}

        {tab === "threats" &&
          (state.incidents.length === 0 ? (
            <p className="rounded-2xl border border-dashed border-line p-8 text-center text-muted">No threats yet. Run the attack demo to create one.</p>
          ) : (
            <ul className="grid gap-2 lg:grid-cols-2">
              {state.incidents.map((i) => {
                const p = state.packets[i.packetId];
                const sc = SCENARIOS.find((s) => s.id === i.scenarioId);
                return (
                  <li key={i.id}>
                    <button onClick={() => onOpen(i.id)} className="flex w-full items-center gap-4 rounded-xl border border-line bg-bg/40 px-4 py-3 text-left hover:border-neon">
                      <div className="min-w-0 flex-1">
                        <p className="font-medium">{sc?.name ?? "Suspicious connection"}</p>
                        <p className="text-sm text-muted">
                          {i.id} · {p.srcIp} · risk {i.detection.risk.toLowerCase()}
                        </p>
                      </div>
                      <StatusBadge status={i.status} />
                    </button>
                  </li>
                );
              })}
            </ul>
          ))}

        {tab === "how" && (
          <ol className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {HOW.map((h, i) => (
              <li key={h.title} className="flex items-start gap-3 rounded-2xl border border-line bg-bg/40 p-4">
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-neon/15 text-neon-hi">
                  <h.icon className="h-5 w-5" />
                </span>
                <div>
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
