import { tickToIso } from "@/lib/simulation/engine";

/** Simulation clock as HH:MM:SS (fixed epoch, so it is identical on server and client). */
export const simTime = (tick: number) => tickToIso(tick).slice(11, 19);
