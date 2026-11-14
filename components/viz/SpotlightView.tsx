"use client";
// Style 3 · Spotlight: one big scene for the step happening now, built for a projector.
// A slim progress track underneath keeps the whole journey in view.
import { HEX, NODE_CLASS, STAGES, STATE_HEX, TONE_TEXT, type Journey } from "./journey";

const RING: Record<Journey["tone"], string> = { info: "bg-neon/30", bad: "bg-red-500/30", ok: "bg-emerald-500/30", warn: "bg-amber-500/30" };
const DISC: Record<Journey["tone"], string> = {
  info: "border-neon-hi bg-neon/20 text-neon-hi",
  bad: "border-red-400 bg-red-500/20 text-red-300",
  ok: "border-emerald-400 bg-emerald-500/20 text-emerald-300",
  warn: "border-amber-400 bg-amber-500/20 text-amber-200",
};

export default function SpotlightView({ j }: { j: Journey }) {
  const idx = j.active ? STAGES.findIndex((s) => s.id === j.active) : -1;
  const stage = idx >= 0 ? STAGES[idx] : null;
  const Icon = stage?.icon;

  return (
    <div>
      <div key={`${j.active}-${j.headline}`} className="flex flex-col items-center gap-14 py-10 text-center animate-in fade-in-0 zoom-in-95 duration-500 sm:flex-row sm:text-left">
        <div className="relative flex h-44 w-44 shrink-0 items-center justify-center">
          {/* slow orbit rings */}
          <span className="absolute -inset-4 animate-spin rounded-full border-2 border-dashed border-neon/30 [animation-duration:18s]" />
          <span className="absolute -inset-9 animate-spin rounded-full border border-dotted border-neon/20 [animation-direction:reverse] [animation-duration:28s]" />
          {stage && <span className={`absolute inset-0 animate-ping rounded-full opacity-40 [animation-duration:2.2s] ${RING[j.tone]}`} />}
          <span className={`relative flex h-40 w-40 items-center justify-center rounded-full border-4 ${stage ? DISC[j.tone] : "border-line bg-panel text-dim"}`}>
            {Icon ? <Icon className="h-20 w-20" strokeWidth={1.5} /> : <span className="text-5xl">·</span>}
          </span>
        </div>
        <div className="min-w-0">
          <p className="text-sm font-semibold tracking-[0.2em] text-dim uppercase">{stage ? `Stage ${idx + 1} of ${STAGES.length} · ${stage.title}` : "ShieldOps"}</p>
          <p className={`mt-2 text-4xl font-semibold tracking-tight sm:text-5xl ${stage ? TONE_TEXT[j.tone] : "text-ink"}`}>{j.headline}</p>
          <p className="mt-3 max-w-xl text-xl text-muted">{j.caption}</p>
        </div>
      </div>

      {/* progress track */}
      <ol className="mt-6 grid grid-cols-7 gap-0">
        {STAGES.map((s, i) => {
          const st = j.states[s.id];
          const nextSt = STAGES[i + 1] ? j.states[STAGES[i + 1].id] : null;
          return (
            <li key={s.id} className="relative flex flex-col items-center text-center">
              {nextSt && (
                <span
                  className="absolute top-5 left-1/2 h-1 w-full rounded-full"
                  style={{ background: nextSt === "idle" || nextSt === "skipped" ? HEX.line : STATE_HEX[nextSt] }}
                />
              )}
              <span className="relative rounded-xl bg-panel">
                <span className={`flex h-10 w-10 items-center justify-center rounded-xl border-2 ${NODE_CLASS[st]} ${j.active === s.id ? "scale-110" : ""}`}>
                  <s.icon className="h-5 w-5" />
                </span>
              </span>
              <span className={`mt-2 px-1 text-xs leading-tight ${j.active === s.id ? "font-semibold text-ink" : "text-dim"}`}>{s.title}</span>
            </li>
          );
        })}
      </ol>
    </div>
  );
}
