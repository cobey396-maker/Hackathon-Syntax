"use client";
// App shell: sticky header with three tabs. Opening a threat shows its story in place of the tab.
import { useCallback, useEffect, useRef, useState } from "react";
import { RotateCcw } from "lucide-react";
import type { DashboardState, Decision, SandboxItem } from "@/lib/types";
import AuditLedger from "./AuditLedger";
import Overview from "./Overview";
import ShieldOpsLogo from "./ShieldOpsLogo";
import ThreatStory from "./ThreatStory";
import TrafficFeed from "./TrafficFeed";

type View = "overview" | "ledger" | "traffic";
const TABS: [View, string][] = [
  ["overview", "Overview"],
  ["ledger", "Audit ledger"],
  ["traffic", "Live traffic"],
];

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
  const [view, setView] = useState<View>("overview");
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
      else if (res.verdict === "blocked") setNotice({ text: `Connection refused: ${res.srcIp} was blocked at the edge by ${res.ruleId} before it reached the firewall.`, tone: "refused" });
      else if (res.verdict === "sandboxed" && kind === "r") setNotice({ text: `Replay from ${res.srcIp} was held again as ${res.id}: no fix has been approved yet.`, tone: "info" });
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
    const t = setTimeout(() => setNotice(null), 6000);
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
        setNotice({ text: `Signature 1 of 2 recorded (${analyst}). Switch analyst in the header to co-sign.`, tone: "info" });
    } else setNotice({ text: body.error ?? "decision failed", tone: "info" });
    setBusy(false);
  };

  // Two-step reset so a stray click mid-demo doesn't wipe the run
  const [arm, setArm] = useState(false);
  useEffect(() => {
    if (!arm) return;
    const t = setTimeout(() => setArm(false), 3000);
    return () => clearTimeout(t);
  }, [arm]);

  const resetDemo = async () => {
    const r = await fetch("/api/reset", { method: "POST" });
    if (!r.ok) return;
    setOpenId(null);
    setToast(null);
    setNotice(null);
    seen.current = new Set();
    setState(await r.json());
  };

  const open = state.items.find((i) => i.id === openId);
  const pending = state.items.filter((i) => i.status === "pending").length;

  return (
    <div className="min-h-full">
      <div className="aurora" aria-hidden>
        <span />
        <span />
      </div>

      <header className="sticky top-0 z-20 border-b bg-bg/75 backdrop-blur-md">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center gap-x-6 gap-y-3 px-6 py-3">
          <ShieldOpsLogo variant="horizontal" theme="dark" size={36} knockout="#061426" />

          <nav className="flex gap-1" aria-label="Sections">
            {TABS.map(([key, label]) => {
              const active = view === key && !open;
              return (
                <button
                  key={key}
                  onClick={() => {
                    setView(key);
                    setOpenId(null);
                  }}
                  aria-current={active ? "page" : undefined}
                  className={`rounded-lg px-4 py-2 text-sm font-medium whitespace-nowrap ${active ? "bg-panel-2 text-ink" : "text-muted hover:text-ink"}`}
                >
                  {label}
                  {key === "overview" && pending > 0 && <span className="ml-2 rounded-full bg-cisco px-1.5 text-xs text-white">{pending}</span>}
                </button>
              );
            })}
          </nav>

          <div className="ml-auto flex flex-wrap items-center gap-3">
            <button
              onClick={() => setAutoTraffic(!autoTraffic)}
              aria-pressed={autoTraffic}
              title="Background stream of normal logins, one per second"
              className={`flex items-center gap-2 rounded-full border px-3 py-1 text-xs font-semibold tracking-wider ${autoTraffic ? "border-ok/40 bg-ok/10 text-ok-hi" : "text-muted"}`}
            >
              <span className={`h-2 w-2 rounded-full ${autoTraffic ? "live-dot bg-ok" : "bg-dim"}`} />
              {autoTraffic ? "LIVE" : "PAUSED"}
            </button>
            <select value={analyst} onChange={(e) => pickAnalyst(e.target.value)} aria-label="Analyst on duty" className="h-9 rounded-lg border bg-panel px-2 text-sm focus:border-cisco focus:outline-none">
              {ANALYSTS.map((a) => (
                <option key={a}>{a}</option>
              ))}
            </select>
            <button
              onClick={() => {
                if (arm) {
                  setArm(false);
                  resetDemo();
                } else setArm(true);
              }}
              className={`flex items-center gap-1.5 rounded-lg px-3 py-2 text-sm whitespace-nowrap ${arm ? "bg-crit/15 text-crit-hi" : "text-muted hover:bg-panel-2 hover:text-ink"}`}
            >
              <RotateCcw className="h-4 w-4" /> {arm ? "Click again to reset" : "Reset"}
            </button>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-6 py-8">
        {notice && (
          <p
            className={`mb-6 flex items-center justify-between gap-4 rounded-xl px-4 py-3 animate-in fade-in-0 slide-in-from-top-2 ${
              notice.tone === "refused" ? "bg-ok/10 text-ok-hi" : "bg-cisco/10 text-ink"
            }`}
            aria-live="polite"
          >
            <span className="min-w-0 break-words">{notice.text}</span>
            <button onClick={() => setNotice(null)} className="shrink-0 text-sm text-muted hover:text-ink">
              Dismiss
            </button>
          </p>
        )}

        {open ? (
          <ThreatStory key={open.id} now={state.now} item={open} ledger={state.ledger} patch={state.deployed.find((d) => d.itemId === open.id)} analyst={analyst} busy={busy} onClose={() => setOpenId(null)} onDecide={decide} />
        ) : view === "overview" ? (
          <Overview state={state} pending={pending} live={autoTraffic} onLive={setAutoTraffic} onKey={simulate} onOpen={setOpenId} />
        ) : view === "ledger" ? (
          <AuditLedger ledger={state.ledger} source={state.ledgerSource} />
        ) : (
          <TrafficFeed traffic={state.traffic} />
        )}
      </main>

      {toast && !open && (
        <div className="shadow-card fixed right-5 bottom-5 z-40 flex max-w-md items-center gap-4 rounded-2xl border border-crit/60 bg-panel px-4 py-3 animate-in slide-in-from-bottom-4">
          <span className="h-2.5 w-2.5 shrink-0 animate-pulse rounded-full bg-crit" />
          <div className="min-w-0">
            <p className="font-semibold">Zero-day held in the Holding Center</p>
            <p className="truncate text-sm text-muted">
              {toast.id} · {toast.srcIp} · {toast.ai.status === "grading" ? "Claude grading…" : `severity ${toast.severity}/10`}
            </p>
          </div>
          <button
            onClick={() => {
              setView("overview");
              setOpenId(toast.id);
              setToast(null);
            }}
            className="shrink-0 rounded-xl bg-cisco px-4 py-2 text-sm font-semibold text-white hover:bg-sky"
          >
            Inspect
          </button>
        </div>
      )}
    </div>
  );
}
