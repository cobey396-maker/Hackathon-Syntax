"use client";
// Style 2 · Timeline: the journey as a vertical story, one roomy row per stage.
// The current stage expands to explain itself; skipped stages fade out with "Not needed".
import { moving, NODE_CLASS, STAGES, STATE_HEX, TONE_CLASS, type Journey, type StageState } from "./journey";

const NOTE_TEXT: Record<StageState, string> = {
  idle: "text-dim",
  skipped: "text-dim",
  done: "text-neon-hi",
  active: "text-neon-hi",
  bad: "text-red-300",
  ok: "text-emerald-300",
  warn: "text-amber-200",
};

export default function TimelineView({ j }: { j: Journey }) {
  return (
    <ol className="mx-auto max-w-2xl">
      {STAGES.map((s, i) => {
        const st = j.states[s.id];
        const next = STAGES[i + 1];
        const nextSt = next ? j.states[next.id] : "idle";
        const lineOn = next && nextSt !== "idle" && nextSt !== "skipped";
        const isActive = j.active === s.id;
        const faded = st === "idle" || st === "skipped";
        return (
          <li key={s.id} className="grid grid-cols-[64px_1fr] gap-x-5">
            {/* rail */}
            <div className="flex flex-col items-center">
              <span className="rounded-2xl bg-panel">
                <span className={`flex h-14 w-14 items-center justify-center rounded-2xl border-2 transition-all duration-500 ${NODE_CLASS[st]}`}>
                  <s.icon className="h-7 w-7" />
                </span>
              </span>
              {next && (
                <span className="relative my-1 w-1 flex-1 overflow-hidden rounded-full" style={{ minHeight: 28, background: lineOn ? STATE_HEX[nextSt === "warn" ? "warn" : nextSt === "bad" ? "bad" : nextSt === "ok" ? "ok" : "done"] : "#1d3b5f" }}>
                  {moving(nextSt) && <span className="animate-drop absolute left-1/2 h-3 w-3 -translate-x-1/2 rounded-full bg-white shadow-[0_0_12px_4px_rgba(0,188,235,0.6)]" />}
                </span>
              )}
            </div>

            {/* content */}
            <div className={`pb-6 ${faded ? "opacity-50" : ""}`}>
              <div className="flex flex-wrap items-baseline gap-x-3 pt-3">
                <p className="text-lg font-semibold">{s.title}</p>
                <p className={`text-sm font-medium ${NOTE_TEXT[st]}`}>{j.notes[s.id] ?? (st === "skipped" ? "Not needed" : "")}</p>
              </div>
              {isActive ? (
                <div className={`mt-2 rounded-xl border-l-4 px-4 py-3 animate-in fade-in-0 slide-in-from-left-2 ${TONE_CLASS[j.tone]}`}>
                  <p className="text-lg">{j.caption}</p>
                </div>
              ) : (
                <p className="text-sm text-muted">{s.blurb}</p>
              )}
            </div>
          </li>
        );
      })}
    </ol>
  );
}
