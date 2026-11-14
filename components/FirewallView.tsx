"use client";
// Live virtual firewall: installed rules, temporary quarantines, and a packet tester that runs
// the real evaluator so you can watch the same packet change verdict as the policy changes.
import { useState } from "react";
import { evaluatePacket, describeMatch } from "@/lib/simulation/firewall";
import { SCENARIOS } from "@/lib/simulation/scenarios";
import type { Packet } from "@/lib/simulation/types";
import { useSimulation } from "./simulation/SimulationProvider";
import { Pane, simTime, td, th } from "./soc";

export default function FirewallView() {
  const { state } = useSimulation();
  const fw = state.firewall;
  const [probe, setProbe] = useState(SCENARIOS[1].id);
  const sc = SCENARIOS.find((s) => s.id === probe)!;
  const pkt: Packet = { ...sc.packet, id: "PROBE", tick: state.tick };
  const res = evaluatePacket(pkt, fw, state.tick);

  return (
    <div className="grid flex-1 gap-px bg-line lg:grid-cols-[2fr_1fr]">
      <Pane title="Virtual Firewall Policy" meta={<span>first match wins · default allow · in-browser only</span>}>
        <table className="w-full">
          <thead>
            <tr>
              {["#", "Rule", "Action", "Condition", "Origin", "Expires"].map((h) => (
                <th key={h} className={th}>
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {fw.quarantined.map((ip) => (
              <tr key={ip} className="border-b border-line/60 bg-orange-500/5">
                <td className={`${td} font-mono text-dim`}>Q</td>
                <td className={`${td} font-mono`}>QUARANTINE</td>
                <td className={`${td} font-mono text-xs font-semibold text-orange-300`}>BLOCK</td>
                <td className={`${td} font-mono text-xs`}>src = {ip}</td>
                <td className={`${td} text-xs text-muted`}>temporary containment</td>
                <td className={`${td} font-mono text-xs text-dim`}>until released</td>
              </tr>
            ))}
            {fw.rules.map((r, i) => (
              <tr key={r.id} className={`border-b border-line/60 ${r.origin === "patch" ? "bg-neon/5" : ""}`}>
                <td className={`${td} font-mono text-dim`}>{i + 1}</td>
                <td className={`${td} font-mono`}>{r.id}</td>
                <td className={`${td} font-mono text-xs font-semibold ${r.action === "deny" ? "text-red-300" : "text-emerald-400"}`}>{r.action.toUpperCase()}</td>
                <td className={`${td} font-mono text-xs`}>{describeMatch(r.match)}</td>
                <td className={`${td} text-xs ${r.origin === "patch" ? "text-neon-hi" : "text-muted"}`}>{r.origin === "patch" ? "approved virtual patch" : "baseline"}</td>
                <td className={`${td} font-mono text-xs text-dim`}>{r.expiresAtTick !== undefined ? `+${Math.round((r.expiresAtTick - state.tick) / 3600)}h (${simTime(r.expiresAtTick)})` : "—"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </Pane>

      <Pane title="Packet tester">
        <div className="space-y-4 p-4 text-sm">
          <label className="block">
            <span className="text-xs font-semibold tracking-wider text-dim uppercase">Synthetic packet</span>
            <select value={probe} onChange={(e) => setProbe(e.target.value)} className="mt-1.5 h-8 w-full border bg-bg px-2 text-sm focus:border-neon focus:outline-none">
              {SCENARIOS.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </select>
          </label>
          <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 font-mono text-xs">
            <dt className="text-dim">src</dt>
            <dd>{pkt.srcIp}</dd>
            <dt className="text-dim">protocol</dt>
            <dd>{pkt.protocol}</dd>
            <dt className="text-dim">record.len</dt>
            <dd>
              {pkt.declaredLen} declared / {pkt.actualLen} actual
            </dd>
          </dl>
          <div className={`border px-3 py-2 ${res.verdict === "BLOCK" ? "border-red-500/60" : "border-emerald-500/60"}`}>
            <p className={`font-mono text-sm font-semibold ${res.verdict === "BLOCK" ? "text-red-300" : "text-emerald-300"}`}>{res.verdict}</p>
            <p className="mt-1 text-xs text-muted">
              {res.matchedRule ? <span className="font-mono text-ink">{res.matchedRule}</span> : "default"} · {res.reason}
            </p>
          </div>
          <p className="text-xs text-dim">Computed live by evaluatePacket() against the current policy above. Approve or roll back a patch and this verdict changes.</p>
        </div>
      </Pane>
    </div>
  );
}
