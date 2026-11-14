"use client";
import { useCallback, useEffect, useRef, useState } from "react";
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
  const [notice, setNotice] = useState<{ text: string; tone: "refused" | "info" } | null>(null);
  const [autoTraffic, setAutoTraffic] = useState(true);
  const seen = useRef<Set<string> | null>(null);

  // Poll the server; toast when a new zero-day lands
  const load = useCallback(
    () =>
      fetch("/api/state", { cache: "no-store" })
        .then((r) => r.json())
        .then((s: DashboardState) => {
          setState(s);
          if (seen.current) {
            const fresh = s.items.find((i) => !seen.current!.has(i.id));
            if (fresh) setToast(fresh);
          }
          seen.current = new Set(s.items.map((i) => i.id));
        })
        .catch(() => {}),
    [],
  );

  useEffect(() => {
    load();
    const t = setInterval(load, 1500);
    return () => clearInterval(t);
  }, [load]);

  // Built-in background traffic: one legitimate login per second
  useEffect(() => {
    if (!autoTraffic) return;
    const t = setInterval(() => {
      fetch("/api/simulate", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ kind: "legit" }) }).catch(() => {});
    }, 1000);
    return () => clearInterval(t);
  }, [autoTraffic]);

  // Demo hotkeys on the page: z = zero-day, c = critical 10/10, r = replay the last held attack
  const simulate = useCallback(
    async (kind: "z" | "c" | "r") => {
      const r = await fetch("/api/simulate", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ kind }) });
      const res = await r.json().catch(() => ({}));
      if (!r.ok) setNotice({ text: res.error ?? "simulate failed", tone: "info" });
      else if (res.verdict === "blocked") setNotice({ text: `ERR_CONNECTION_REFUSED · ${res.srcIp} blocked by ${res.ruleId}`, tone: "refused" });
      else if (res.verdict === "sandboxed" && kind === "r") setNotice({ text: `Replay from ${res.srcIp} held again as ${res.id}: no patch approved yet`, tone: "info" });
      load();
    },
    [load],
  );

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.ctrlKey || e.metaKey || e.altKey || e.repeat) return;
      const el = e.target as HTMLElement;
      if (el.closest("input, select, textarea, [contenteditable]")) return;
      const k = e.key.toLowerCase();
      if (k === "z" || k === "c" || k === "r") {
        e.preventDefault();
        simulate(k);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [simulate]);

  useEffect(() => {
    if (!notice) return;
    const t = setTimeout(() => setNotice(null), 5000);
    return () => clearTimeout(t);
  }, [notice]);

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
    const body = await r.json().catch(() => ({}));
    if (r.ok) {
      setState(body);
      const it = (body as DashboardState).items.find((i) => i.id === openId);
      if (it?.crp && it.status === "pending" && it.crp.signoffs.length === 1)
        setNotice({ text: `Signature 1 of 2 recorded (${analyst}). Switch analyst in the sidebar to co-sign.`, tone: "info" });
    } else setNotice({ text: body.error ?? "decision failed", tone: "info" });
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
      <Sidebar view={view} onView={setView} pending={pending} simOnline={state.simOnline} analyst={analyst} analysts={ANALYSTS} onAnalyst={pickAnalyst} onReset={resetDemo} autoTraffic={autoTraffic} onAutoTraffic={setAutoTraffic} onKey={simulate} />

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

      {open && <InspectionModal key={open.id} now={state.now} item={open} ledger={state.ledger} patch={state.deployed.find((d) => d.itemId === open.id)} analyst={analyst} busy={busy} onClose={() => setOpenId(null)} onDecide={decide} />}

      {notice && (
        <div
          className={`fixed top-4 left-1/2 z-[60] -translate-x-1/2 border px-4 py-2.5 font-mono text-sm shadow-2xl animate-in fade-in-0 slide-in-from-top-2 ${
            notice.tone === "refused" ? "border-neon bg-panel text-neon-hi" : "border-line bg-panel text-muted"
          }`}
        >
          {notice.text}
        </div>
      )}

      {toast && !open && (
        <div className="fixed right-5 bottom-5 z-40 flex items-center gap-4 border border-red-500/60 bg-panel px-4 py-3 shadow-2xl animate-in slide-in-from-bottom-4">
          <span className="h-2 w-2 animate-pulse rounded-full bg-red-500" />
          <div className="text-sm">
            <p className="font-semibold">Zero-day held in sandbox</p>
            <p className="font-mono text-xs text-muted">
              {toast.id} · {toast.srcIp} · {toast.ai.status === "grading" ? "Claude grading…" : `severity ${toast.severity}/10 · ${toast.confidence}%`}
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
