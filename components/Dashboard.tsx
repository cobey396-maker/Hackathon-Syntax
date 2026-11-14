"use client";
import { useCallback, useEffect, useState } from "react";
import type { DashboardState } from "@/lib/types";
import AuditLedger from "./AuditLedger";
import InspectionModal from "./InspectionModal";
import SandboxQueue from "./SandboxQueue";
import Sidebar, { type View } from "./Sidebar";
import StatsBar from "./StatsBar";
import TrafficFeed from "./TrafficFeed";

const ANALYSTS = ["J. Rivera · Tier 2", "A. Chen · Tier 3", "M. Okafor · SOC Lead"];
const EMPTY: DashboardState = {
  items: [],
  ledger: [],
  traffic: [],
  stats: { seen: 0, legit: 0, sandboxed: 0, patched: 0, allowed: 0 },
  simOnline: false,
  now: 0,
};

export default function Dashboard() {
  const [state, setState] = useState<DashboardState>(EMPTY);
  const [view, setView] = useState<View>("queue");
  const [openId, setOpenId] = useState<string | null>(null);
  const [analyst, setAnalyst] = useState(ANALYSTS[0]);
  const [busy, setBusy] = useState(false);

  // Poll the API the simulator posts into
  useEffect(() => {
    let alive = true;
    const load = () =>
      fetch("/api/state", { cache: "no-store" })
        .then((r) => r.json())
        .then((s: DashboardState) => alive && setState(s))
        .catch(() => {});
    load();
    const t = setInterval(load, 1500);
    return () => {
      alive = false;
      clearInterval(t);
    };
  }, []);

  // Remember the analyst between reloads (read after mount to stay hydration-safe)
  useEffect(() => {
    try {
      const saved = localStorage.getItem("vps-analyst");
      if (saved && ANALYSTS.includes(saved)) queueMicrotask(() => setAnalyst(saved));
    } catch {}
  }, []);

  const pickAnalyst = (a: string) => {
    setAnalyst(a);
    try {
      localStorage.setItem("vps-analyst", a);
    } catch {}
  };

  const decide = async (action: "approve" | "override") => {
    if (!openId) return;
    setBusy(true);
    const r = await fetch("/api/decision", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: openId, action, analyst }),
    });
    if (r.ok) setState(await r.json());
    setBusy(false);
  };

  const close = useCallback(() => setOpenId(null), []);
  const open = state.items.find((i) => i.id === openId);
  const pending = state.items.filter((i) => i.status === "pending").length;

  return (
    <div className="flex h-full">
      <Sidebar view={view} onView={setView} pending={pending} simOnline={state.simOnline} />

      <main className="flex min-w-0 flex-1 flex-col gap-4 p-5">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl font-semibold">Zero-Day VPN Sandbox</h1>
            <p className="text-sm text-muted">
              Suspicious handshakes are held here. The AI drafts the patch; an analyst approves it before it goes live.
            </p>
          </div>
          <label className="flex items-center gap-2 text-sm text-muted">
            Analyst
            <select
              value={analyst}
              onChange={(e) => pickAnalyst(e.target.value)}
              className="rounded border border-line bg-panel px-3 py-1.5 text-sm text-ink focus:border-cisco focus:outline-none"
            >
              {ANALYSTS.map((a) => (
                <option key={a}>{a}</option>
              ))}
            </select>
          </label>
        </div>

        <StatsBar stats={state.stats} pending={pending} />

        {view === "queue" && <SandboxQueue items={state.items} now={state.now} onOpen={setOpenId} />}
        {view === "ledger" && <AuditLedger ledger={state.ledger} />}
        {view === "traffic" && <TrafficFeed traffic={state.traffic} />}
      </main>

      {open && <InspectionModal item={open} analyst={analyst} busy={busy} onClose={close} onDecide={decide} />}
    </div>
  );
}
