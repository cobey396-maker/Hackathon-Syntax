"use client";
// Single source of truth for the UI. Every screen reads this state and changes it only by
// dispatching engine Actions, so the queue, panel, firewall and audit log can never disagree.
import { createContext, useCallback, useContext, useEffect, useMemo, useReducer, useRef, useState } from "react";
import { initialState, nextAutoAction, reduce } from "@/lib/simulation/engine";
import type { Action, SimState } from "@/lib/simulation/types";

export const PERSONAS = ["Demo Analyst · Tier 2", "Demo Analyst · Tier 3", "Demo SOC Lead"];
const STEP_MS = 900; // slow enough for an audience to follow each step

export type VizStyle = "map" | "timeline" | "spotlight";
const VIZ_KEY = "shieldops-viz";

type Ctx = {
  state: SimState;
  dispatch: (a: Action) => void;
  persona: string;
  setPersona: (p: string) => void;
  /** Step an incident automatically until it needs a human (cancelable). */
  autoRun: (incidentId: string) => void;
  running: string | null;
  stop: () => void;
  vizStyle: VizStyle;
  setVizStyle: (v: VizStyle) => void;
};

const SimContext = createContext<Ctx | null>(null);

export function SimulationProvider({ children }: { children: React.ReactNode }) {
  const [state, dispatch] = useReducer(reduce, undefined, initialState);
  const [persona, setPersona] = useState(PERSONAS[0]);
  const [running, setRunning] = useState<string | null>(null);
  const [vizStyle, setVizStyleState] = useState<VizStyle>("map");

  // Remember the chosen visualization per browser (read after mount to keep hydration identical).
  useEffect(() => {
    try {
      const v = localStorage.getItem(VIZ_KEY);
      if (v === "map" || v === "timeline" || v === "spotlight") queueMicrotask(() => setVizStyleState(v));
    } catch {}
  }, []);
  const setVizStyle = useCallback((v: VizStyle) => {
    setVizStyleState(v);
    try {
      localStorage.setItem(VIZ_KEY, v);
    } catch {}
  }, []);
  const stateRef = useRef(state);
  useEffect(() => {
    stateRef.current = state;
  }, [state]);

  // One automatic step per tick while `running` is set; stops at a human gate, an error or the end.
  useEffect(() => {
    if (!running) return;
    const t = setTimeout(() => {
      const inc = stateRef.current.incidents.find((i) => i.id === running);
      if (!inc || !nextAutoAction(inc) || stateRef.current.lastError) {
        setRunning(null);
        return;
      }
      dispatch({ type: "ADVANCE", incidentId: running });
    }, STEP_MS);
    return () => clearTimeout(t);
  }, [running, state]);

  const wrapped = useCallback((a: Action) => {
    if (a.type === "RESET") setRunning(null);
    dispatch(a);
  }, []);

  const value = useMemo<Ctx>(
    () => ({ state, dispatch: wrapped, persona, setPersona, autoRun: setRunning, running, stop: () => setRunning(null), vizStyle, setVizStyle }),
    [state, wrapped, persona, running, vizStyle, setVizStyle],
  );
  return <SimContext.Provider value={value}>{children}</SimContext.Provider>;
}

export function useSimulation() {
  const ctx = useContext(SimContext);
  if (!ctx) throw new Error("useSimulation must be used inside <SimulationProvider>");
  return ctx;
}
