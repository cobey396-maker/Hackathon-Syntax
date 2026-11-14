"use client";
// The virtual firewall in plain English, plus a tester that runs the real evaluator so the
// audience can see the same connection change from Allowed to Blocked after a fix is approved.
import { useState } from "react";
import { ShieldCheck, ShieldOff, ShieldX } from "lucide-react";
import { describeMatch, evaluatePacket } from "@/lib/simulation/firewall";
import { SCENARIOS } from "@/lib/simulation/scenarios";
import type { Packet } from "@/lib/simulation/types";
import { ruleText } from "./plain";
import { useSimulation } from "./simulation/SimulationProvider";
import { Card } from "./ui";

export default function FirewallView() {
  const { state } = useSimulation();
  const fw = state.firewall;
  const patches = fw.rules.filter((r) => r.origin === "patch");
  const [probe, setProbe] = useState(SCENARIOS[1].id);
  const sc = SCENARIOS.find((s) => s.id === probe)!;
  const res = evaluatePacket({ ...sc.packet, id: "PROBE", tick: state.tick } as Packet, fw, state.tick);
  const blocked = res.verdict === "BLOCK";

  return (
    <div className="grid gap-6 lg:grid-cols-[1.4fr_1fr]">
      <div className="space-y-6">
        <Card>
          <h2 className="text-xl font-semibold">Approved fixes</h2>
          <p className="mb-4 text-muted">Rules a human approved and the system verified. Each one expires automatically.</p>
          {patches.length === 0 ? (
            <p className="rounded-xl border border-dashed border-line p-6 text-center text-muted">No fixes active yet.</p>
          ) : (
            <ul className="space-y-3">
              {patches.map((r) => (
                <li key={r.id} className="rounded-xl bg-neon/10 p-4">
                  <p className="text-lg font-medium">{ruleText(r.match)}</p>
                  <p className="mt-1 text-sm text-muted">
                    {r.id} · expires in {Math.round(((r.expiresAtTick ?? 0) - state.tick) / 3600)} hours
                  </p>
                </li>
              ))}
            </ul>
          )}
        </Card>

        <Card>
          <h2 className="text-xl font-semibold">Isolated connections</h2>
          <p className="mb-4 text-muted">Temporarily cut off while being investigated.</p>
          {fw.quarantined.length === 0 ? (
            <p className="text-muted">None right now.</p>
          ) : (
            <ul className="flex flex-wrap gap-2">
              {fw.quarantined.map((ip) => (
                <li key={ip} className="flex items-center gap-2 rounded-full bg-amber-500/15 px-3 py-1.5 text-amber-200">
                  <ShieldOff className="h-4 w-4" /> {ip}
                </li>
              ))}
            </ul>
          )}
        </Card>

        <details className="rounded-2xl border border-line bg-panel p-5 text-sm">
          <summary className="cursor-pointer text-muted">Show full rule list (technical)</summary>
          <ol className="mt-3 space-y-1 font-mono text-xs">
            {fw.rules.map((r, i) => (
              <li key={r.id}>
                {i + 1}. {r.id} {r.action.toUpperCase()} if {describeMatch(r.match)}
              </li>
            ))}
            <li className="text-dim">otherwise ALLOW</li>
          </ol>
        </details>
      </div>

      <Card className="h-fit">
        <h2 className="text-xl font-semibold">Test a connection</h2>
        <p className="mb-4 text-muted">See what the firewall would do right now.</p>
        <select value={probe} onChange={(e) => setProbe(e.target.value)} className="h-11 w-full rounded-xl border border-line bg-bg px-3 text-base focus:border-neon focus:outline-none">
          {SCENARIOS.map((s) => (
            <option key={s.id} value={s.id}>
              {s.name}
            </option>
          ))}
        </select>
        <div className={`mt-5 flex items-center gap-4 rounded-xl p-5 ${blocked ? "bg-red-500/10" : "bg-emerald-500/10"}`}>
          {blocked ? <ShieldX className="h-10 w-10 text-red-400" /> : <ShieldCheck className="h-10 w-10 text-emerald-400" />}
          <div>
            <p className={`text-3xl font-semibold ${blocked ? "text-red-300" : "text-emerald-300"}`}>{blocked ? "Blocked" : "Allowed"}</p>
            <p className="text-sm text-muted">{res.matchedRule === "QUARANTINE" ? "Source is isolated" : res.matchedRule?.startsWith("VP-") ? `By approved fix ${res.matchedRule}` : "No fix applies"}</p>
          </div>
        </div>
      </Card>
    </div>
  );
}
