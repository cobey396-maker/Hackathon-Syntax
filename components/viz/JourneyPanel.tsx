"use client";
// The visualization card with a style switcher (Map / Timeline / Spotlight).
// The chosen style is shared across pages so it stays put while presenting.
import { GitBranch, ListOrdered, Presentation } from "lucide-react";
import { useSimulation, type VizStyle } from "../simulation/SimulationProvider";
import type { Journey } from "./journey";
import { TONE_CLASS } from "./journey";
import MapView from "./MapView";
import SpotlightView from "./SpotlightView";
import TimelineView from "./TimelineView";

const STYLES: { id: VizStyle; label: string; icon: typeof GitBranch }[] = [
  { id: "map", label: "Map", icon: GitBranch },
  { id: "timeline", label: "Timeline", icon: ListOrdered },
  { id: "spotlight", label: "Spotlight", icon: Presentation },
];

export default function JourneyPanel({ j, title }: { j: Journey; title: string }) {
  const { vizStyle, setVizStyle } = useSimulation();
  return (
    <section className="rounded-3xl border border-line bg-panel p-6 sm:p-8">
      <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
        <h2 className="text-xl font-semibold">{title}</h2>
        <div role="tablist" aria-label="Visualization style" className="flex rounded-xl border border-line bg-bg p-1">
          {STYLES.map((s) => (
            <button
              key={s.id}
              role="tab"
              aria-selected={vizStyle === s.id}
              onClick={() => setVizStyle(s.id)}
              className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm ${vizStyle === s.id ? "bg-neon text-white" : "text-muted hover:text-ink"}`}
            >
              <s.icon className="h-4 w-4" />
              {s.label}
            </button>
          ))}
        </div>
      </div>

      {vizStyle === "map" && <MapView j={j} />}
      {vizStyle === "timeline" && <TimelineView j={j} />}
      {vizStyle === "spotlight" && <SpotlightView j={j} />}

      {/* Map shows its caption underneath; the other styles already show it inline. */}
      {vizStyle === "map" && (
        <p className={`mt-6 rounded-2xl border-l-4 px-5 py-4 text-lg ${TONE_CLASS[j.tone]}`} aria-live="polite">
          {j.caption}
        </p>
      )}
    </section>
  );
}
