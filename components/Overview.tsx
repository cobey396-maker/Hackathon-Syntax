"use client";
// Home screen: four headline numbers, how the system works, scenario buttons, and the incident list.
import { ArrowRight, CheckCircle2, FlaskConical, Radar, UserCheck } from "lucide-react";
import { SCENARIOS } from "@/lib/simulation/scenarios";
import { counts } from "@/lib/simulation/selectors";
import { journeyForTraffic } from "./viz/journey";
import JourneyPanel from "./viz/JourneyPanel";
import { useSimulation } from "./simulation/SimulationProvider";
import { Card, StatusBadge } from "./ui";

const HOW = [
  { icon: Radar, title: "Spot", text: "Check every connection for warning signs" },
  { icon: FlaskConical, title: "Test safely", text: "Isolate it and replay it in a sandbox" },
  { icon: UserCheck, title: "Human decides", text: "An analyst approves or rejects the fix" },
  { icon: CheckCircle2, title: "Verify", text: "Prove the fix works without blocking real users" },
];

// Plain one-liners for the audience (the technical summary stays in scenarios.ts).
const SCENARIO_TEXT: Record<string, string> = {
  legit: "An employee logs in from home. Nothing should happen.",
  "malformed-tls": "A broken connection designed to crash the firewall.",
  "false-positive": "Looks unusual, but it is a real user. Should not be blocked.",
  "broad-patch": "The drafted fix would block real users. Watch it get stopped.",
  rollback: "A fix that passes early tests but fails later, then gets undone.",
  inconclusive: "Something odd, but not enough proof to block it.",
};

const SCENARIO_TAG: Record<string, string> = {
  legit: "Normal user",
  "malformed-tls": "Main demo",
  "false-positive": "False alarm",
  "broad-patch": "Unsafe fix",
  rollback: "Undo",
  inconclusive: "Uncertain",
};

export default function Overview({ onLaunch, onOpen }: { onLaunch: (id: string) => void; onOpen: (id: string) => void }) {
  const { state } = useSimulation();
  const c = counts(state);
  const stats: [string, number, string][] = [
    ["Connections checked", c.analyzed, "text-ink"],
    ["Threats caught", c.detected, "text-red-300"],
    ["Waiting for a human", c.awaitingReview, "text-neon-hi"],
    ["Fixes verified", c.verified, "text-emerald-300"],
  ];

  return (
    <div className="space-y-12">
      <div>
        <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">
          The AI investigates. <span className="text-neon-hi">The human authorizes.</span> The system verifies.
        </h1>
        <p className="mt-2 max-w-3xl text-lg text-muted">
          A safe simulation of how suspicious VPN traffic is caught, tested in a sandbox, approved by a person, and checked before it can affect real users.
        </p>
      </div>
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        {stats.map(([label, value, color]) => (
          <Card key={label} className="!p-5">
            <p className="text-sm text-muted">{label}</p>
            <p className={`mt-1 text-4xl font-semibold tabular-nums ${color}`}>{value}</p>
          </Card>
        ))}
      </div>

      <JourneyPanel title="Watch a connection travel through ShieldOps" j={journeyForTraffic(state.traffic[0])} />

      <div>
        <h2 className="mb-3 text-lg font-semibold">How it works</h2>
        <ol className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {HOW.map((h, i) => (
            <li key={h.title} className="flex items-start gap-3 rounded-2xl border border-line bg-panel p-4">
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
      </div>

      <div className="grid gap-8 lg:grid-cols-[1fr_1.4fr]">
        <div>
          <h2 className="mb-1 text-lg font-semibold">Try a scenario</h2>
          <p className="mb-3 text-sm text-muted">Each button sends one synthetic connection through the system.</p>
          <div className="space-y-2">
            {SCENARIOS.map((s) => (
              <button
                key={s.id}
                onClick={() => onLaunch(s.id)}
                className={`group flex w-full items-center gap-4 rounded-xl border px-4 py-3 text-left transition-colors hover:border-neon hover:bg-neon/5 ${s.id === "malformed-tls" ? "border-neon/50 bg-neon/5" : "border-line bg-panel"}`}
              >
                <div className="min-w-0 flex-1">
                  <p className="font-medium">{s.name}</p>
                  <p className="text-sm text-muted">{SCENARIO_TEXT[s.id] ?? s.summary}</p>
                </div>
                <span className="shrink-0 rounded-full bg-panel-2 px-2.5 py-0.5 text-xs text-muted">{SCENARIO_TAG[s.id]}</span>
                <ArrowRight className="h-4 w-4 shrink-0 text-dim group-hover:text-neon-hi" />
              </button>
            ))}
          </div>
        </div>

        <div>
          <h2 className="mb-1 text-lg font-semibold">Threats</h2>
          <p className="mb-3 text-sm text-muted">Click one to see the full story.</p>
          {state.incidents.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-line p-10 text-center text-muted">
              {c.analyzed ? "Everything so far looked normal. No threats." : "No threats yet. Pick a scenario to start."}
            </div>
          ) : (
            <ul className="space-y-2">
              {state.incidents.map((i) => {
                const p = state.packets[i.packetId];
                const sc = SCENARIOS.find((s) => s.id === i.scenarioId);
                return (
                  <li key={i.id}>
                    <button onClick={() => onOpen(i.id)} className="flex w-full items-center gap-4 rounded-xl border border-line bg-panel px-4 py-3 text-left hover:border-neon">
                      <div className="min-w-0 flex-1">
                        <p className="font-medium">{sc?.name ?? "Suspicious connection"}</p>
                        <p className="text-sm text-muted">
                          {i.id} · from {p.srcIp} · risk {i.detection.risk.toLowerCase()}
                        </p>
                      </div>
                      <StatusBadge status={i.status} />
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}
