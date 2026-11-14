"use client";
import { useEffect, useRef, useState } from "react";
import type { DashboardState, Decision, SandboxItem } from "@/lib/types";
import AuditLedger from "./AuditLedger";
import DeployedPatches from "./DeployedPatches";
import InspectionModal from "./InspectionModal";
import SandboxQueue from "./SandboxQueue";
import Sidebar, { type View } from "./Sidebar";
import Topology from "./Topology";
import TrafficFeed from "./TrafficFeed";

const ANALYSTS = ["J. Rivera · Tier 2", "A. Chen · Tier 3", "M. Okafor · SOC Lead"];
const EMPTY: DashboardState = {
  items: [],
  ledger: [],
  ledgerSource: "mock",
  traffic: [],
  deployed: [],
  stats: { seen: 0, legit: 0, sandboxed: 0, patched: 0, allowed: 0, crashesPrevented: 0, blockedAtEdge: 0, avgVerdictMs: 0 },
  simOnline: false,
  now: 0,
};

export default function Dashboard() {
  const [state, setState] = useState<DashboardState>(EMPTY);
  const [view, setView] = useState<View>("queue");
  const [openId, setOpenId] = useState<string | null>(null);
  const [toast, setToast] = useState<SandboxItem | null>(null);
  const [analyst, setAnalyst] = useState(ANALYSTS[0]);
  const [busy, setBusy] = useState(false);
  const seen = useRef<Set<string> | null>(null);

  // Poll the API the simulator posts into; toast when a new zero-day lands
  useEffect(() => {
    let alive = true;
    const load = () =>
      fetch("/api/state", { cache: "no-store" })
        .then((r) => r.json())
        .then((s: DashboardState) => {
          if (!alive) return;
          setState(s);
          if (seen.current) {
            const fresh = s.items.find((i) => !seen.current!.has(i.id));
            if (fresh) setToast(fresh);
          }
          seen.current = new Set(s.items.map((i) => i.id));
        })
        .catch(() => {});
    load();
    const t = setInterval(load, 1500);
    return () => {
      alive = false;
      clearInterval(t);
    };
  }, []);

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 8000);
    return () => clearTimeout(t);
  }, [toast]);

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

  const decide = async (action: Decision) => {
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

  const resetDemo = async () => {
    const r = await fetch("/api/reset", { method: "POST" });
    if (!r.ok) return;
    setOpenId(null);
    setToast(null);
    seen.current = new Set();
    setState(await r.json());
  };

  const open = state.items.find((i) => i.id === openId);
  const pending = state.items.filter((i) => i.status === "pending").length;
  const s = state.stats;
  const kpis: [string, string, string?][] = [
    ["Inspected", s.seen.toLocaleString("en-US")],
    ["Clean → firewall", s.legit.toLocaleString("en-US"), "text-emerald-400"],
    ["Held in sandbox", String(s.sandboxed), "text-red-400"],
    ["Pending review", String(pending), pending ? "text-amber-300" : undefined],
    ["Patches approved", String(s.patched), "text-neon-hi"],
    ["Overrides", String(s.allowed)],
    ["Refused at edge", String(s.blockedAtEdge), "text-neon-hi"],
    ["Crashes prevented", String(s.crashesPrevented), "text-cisco"],
    ["Avg AI verdict", `${s.avgVerdictMs.toFixed(2)} ms`, "text-cisco"],
  ];

  return (
    <div className="h-full">
      <Sidebar view={view} onView={setView} pending={pending} simOnline={state.simOnline} analyst={analyst} analysts={ANALYSTS} onAnalyst={pickAnalyst} onReset={resetDemo} />

      <main className="flex h-full flex-col gap-px overflow-auto bg-line pl-64">
        <div className="grid shrink-0 grid-cols-4 bg-panel lg:grid-cols-9">
          {kpis.map(([label, value, color]) => (
            <div key={label} className="border-r border-b px-4 py-2.5 last:border-r-0">
              <p className="text-xs tracking-wider text-dim uppercase">{label}</p>
              <p className={`mt-0.5 font-mono text-lg font-medium tabular-nums ${color ?? "text-ink"}`}>{value}</p>
            </div>
          ))}
        </div>

        {view === "queue" && (
          <>
            <Topology traffic={state.traffic} stats={state.stats} now={state.now} />
            <SandboxQueue items={state.items} now={state.now} onOpen={setOpenId} />
            <DeployedPatches deployed={state.deployed} now={state.now} />
          </>
        )}
        {view === "ledger" && <AuditLedger ledger={state.ledger} source={state.ledgerSource} />}
        {view === "traffic" && <TrafficFeed traffic={state.traffic} />}
      </main>

      {open && <InspectionModal key={open.id} item={open} ledger={state.ledger} patch={state.deployed.find((d) => d.itemId === open.id)} analyst={analyst} busy={busy} onClose={() => setOpenId(null)} onDecide={decide} />}

      {toast && !open && (
        <div className="fixed right-5 bottom-5 z-40 flex items-center gap-4 border border-red-500/60 bg-panel px-4 py-3 shadow-2xl animate-in slide-in-from-bottom-4">
          <span className="h-2 w-2 animate-pulse rounded-full bg-red-500" />
          <div className="text-sm">
            <p className="font-semibold">Zero-day held in sandbox</p>
            <p className="font-mono text-xs text-muted">
              {toast.id} · {toast.srcIp} · severity {toast.severity}/10 · {toast.confidence}%
            </p>
          </div>
          <button
            onClick={() => {
              setView("queue");
              setOpenId(toast.id);
              setToast(null);
            }}
            className="bg-neon px-3 py-1.5 text-sm font-semibold text-white hover:bg-neon-hi"
          >
            Inspect
          </button>
        </div>
      )}
    </div>
  );
}
