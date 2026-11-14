// Metrics computed by actually running the fixtures through the engine. No hand-entered numbers.
import { detect } from "./detector.ts";
import { initialState, reduce, runToPause } from "./engine.ts";
import { LABELED_SET } from "./scenarios.ts";
import type { Packet } from "./types.ts";

export type Confusion = { tp: number; fp: number; tn: number; fn: number; recall: number; fpr: number; total: number };

function confusion(rows: { predicted: boolean; actual: boolean }[]): Confusion {
  const c = { tp: 0, fp: 0, tn: 0, fn: 0 };
  for (const r of rows) {
    if (r.predicted && r.actual) c.tp++;
    else if (r.predicted) c.fp++;
    else if (r.actual) c.fn++;
    else c.tn++;
  }
  return { ...c, total: rows.length, recall: c.tp + c.fn ? c.tp / (c.tp + c.fn) : 0, fpr: c.fp + c.tn ? c.fp / (c.fp + c.tn) : 0 };
}

/**
 * Two stages on the same labeled synthetic set:
 *  - detector: did any check flag the packet?
 *  - pipeline: after replay + analysis, did it end as anything other than BENIGN / allowed?
 * The gap between them shows how investigation removes false positives before anyone is blocked.
 */
export function fixtureMetrics() {
  const detector = confusion(LABELED_SET.map((l) => ({ predicted: detect({ ...l.packet, id: "M", tick: 0 } as Packet).suspicious, actual: l.malicious })));

  const pipelineRows = LABELED_SET.map((l) => {
    let s = reduce(initialState(), { type: "INGEST", packet: l.packet });
    const inc = s.incidents[0];
    if (!inc) return { predicted: false, actual: l.malicious };
    s = runToPause(s, inc.id);
    const status = s.incidents[0].status;
    return { predicted: status !== "BENIGN", actual: l.malicious };
  });
  return { detector, pipeline: confusion(pipelineRows), cases: LABELED_SET.length };
}
