// Benchmark: drives the real pipeline (edge enforcement -> AI Shield checks -> honeypot -> Claude
// grading -> Critical Response Protocol) through the running app and measures it.
//
//   npm run dev            (in another terminal)
//   npm run benchmark      [-- --url http://localhost:3000 --legit 300 --unusual 15 --per-type 15 --keep]
//
// Resets the demo before it starts and again when it finishes (unless --keep). All traffic is simulated.
// Writes benchmark/results.md and benchmark/results.json.
// Time-to-patch trials approve patches as "Benchmark bot A/B"; those decisions land in the audit ledger.
import { mkdirSync, writeFileSync } from "node:fs";

const arg = (k, d) => {
  const i = process.argv.indexOf(`--${k}`);
  return i > -1 ? process.argv[i + 1] : d;
};
const URL_ = arg("url", "http://localhost:3000");
const N_LEGIT = +arg("legit", 300);
const N_UNUSUAL = +arg("unusual", 15);
const PER_TYPE = +arg("per-type", 15);
const PER_HELDOUT = +arg("per-heldout", 10);
const KEEP = process.argv.includes("--keep");

const TIERS = ["version-probe", "cipher-fuzz", "length-desync", "desync-fuzz", "overflow"];
// Attack types the detector was NOT written for (lib/sim.ts HELDOUT).
const HELDOUT = ["sslv3-downgrade", "length-underflow", "zero-length-record", "ext-len-overflow", "buffer-boundary-probe"];
const UNUSUAL = ["legacy-tls10", "grease-cipher", "rsa-gcm-cipher", "large-pq-hello"];
const CRITICAL = 7;

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const pct = (a, b) => (b ? ((100 * a) / b).toFixed(1) + "%" : "—");
const q = (xs, p) => {
  if (!xs.length) return null;
  const s = [...xs].sort((a, b) => a - b);
  return s[Math.min(s.length - 1, Math.floor(p * s.length))];
};
const mean = (xs) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : null);
const sd = (xs) => {
  const m = mean(xs);
  return xs.length > 1 ? Math.sqrt(xs.reduce((a, b) => a + (b - m) ** 2, 0) / xs.length) : 0;
};
const f1 = (x) => (x == null ? "—" : x.toFixed(1));

async function post(path, body) {
  const t0 = performance.now();
  const r = await fetch(URL_ + path, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
  const j = await r.json();
  if (!r.ok) throw new Error(`${path} ${r.status}: ${JSON.stringify(j)}`);
  return { ...j, rtt: performance.now() - t0 };
}

async function main() {
  try {
    await fetch(URL_ + "/api/state");
  } catch {
    console.error(`Can't reach ${URL_}. Start the app first: npm run dev`);
    process.exit(1);
  }
  console.log(`Benchmark against ${URL_}: ${N_LEGIT} clean logins, ${N_UNUSUAL}×${UNUSUAL.length} unusual-but-legit, ${PER_TYPE}×${TIERS.length} attacks`);
  await post("/api/reset", {});

  const rtt = [];
  // 1. Clean logins (also builds the length baseline)
  const legit = { n: 0, flagged: 0 };
  for (let i = 0; i < N_LEGIT; i++) {
    const r = await post("/api/simulate", { kind: "legit" });
    rtt.push(r.rtt);
    legit.n++;
    if (r.verdict !== "allowed") legit.flagged++;
  }
  console.log(`  clean logins: ${legit.flagged}/${legit.n} flagged`);

  // 2. Unusual but legitimate handshakes
  const unusual = Object.fromEntries(UNUSUAL.map((v) => [v, { n: 0, flagged: 0, ids: [] }]));
  for (let i = 0; i < N_UNUSUAL; i++)
    for (const v of UNUSUAL) {
      const r = await post("/api/simulate", { kind: "unusual", variant: v });
      rtt.push(r.rtt);
      unusual[v].n++;
      if (r.verdict !== "allowed") {
        unusual[v].flagged++;
        if (r.id) unusual[v].ids.push(r.id);
      }
    }
  for (const v of UNUSUAL) console.log(`  unusual ${v}: ${unusual[v].flagged}/${unusual[v].n} flagged`);

  // 3. Attacks, interleaved and paced so Claude calls don't pile up
  const attacks = Object.fromEntries(TIERS.map((t) => [t, { n: 0, held: 0, refused: 0, missed: 0, ids: [] }]));
  for (let i = 0; i < PER_TYPE; i++)
    for (const t of TIERS) {
      const r = await post("/api/simulate", { kind: "attack", tier: t });
      rtt.push(r.rtt);
      const a = attacks[t];
      a.n++;
      if (r.verdict === "sandboxed") {
        a.held++;
        a.ids.push(r.id);
      } else if (r.verdict === "blocked") a.refused++;
      else a.missed++;
      await sleep(300);
    }
  for (const t of TIERS) console.log(`  attack ${t}: ${attacks[t].held} held, ${attacks[t].refused} refused at edge, ${attacks[t].missed} missed`);

  // 3b. Held-out attacks the rules were not written for
  const held = Object.fromEntries(HELDOUT.map((t) => [t, { n: 0, held: 0, refused: 0, missed: 0, ids: [] }]));
  for (let i = 0; i < PER_HELDOUT; i++)
    for (const t of HELDOUT) {
      const r = await post("/api/simulate", { kind: "heldout", tier: t });
      const a = held[t];
      a.n++;
      if (r.verdict === "sandboxed") {
        a.held++;
        a.ids.push(r.id);
      } else if (r.verdict === "blocked") a.refused++;
      else a.missed++;
      await sleep(300);
    }
  for (const t of HELDOUT) console.log(`  held-out ${t}: ${held[t].held} held, ${held[t].refused} refused at edge, ${held[t].missed} missed`);

  // 4. Wait for Claude to finish grading every held packet
  const want = new Set([...TIERS.flatMap((t) => attacks[t].ids), ...HELDOUT.flatMap((t) => held[t].ids), ...UNUSUAL.flatMap((v) => unusual[v].ids)]);
  let items = [];
  const deadline = Date.now() + 180_000;
  process.stdout.write(`  waiting for ${want.size} grades`);
  for (;;) {
    const s = await (await fetch(URL_ + "/api/state")).json();
    items = s.items.filter((i) => want.has(i.id));
    const pending = items.filter((i) => i.ai.status === "grading").length;
    if (!pending || Date.now() > deadline) break;
    process.stdout.write(".");
    await sleep(2000);
  }
  console.log("");
  const byId = Object.fromEntries(items.map((i) => [i.id, i]));

  // 5. Grades, protocol correctness, latency
  const grades = {};
  let crpOk = 0, crpTotal = 0;
  const claudeMs = [];
  let fallbacks = 0;
  const fallbackNotes = new Set();
  for (const t of TIERS) {
    const its = attacks[t].ids.map((id) => byId[id]).filter(Boolean);
    const claude = its.filter((i) => i.ai.engine === "claude" && i.ai.status === "done");
    for (const i of its) {
      if (i.ai.engine !== "claude") {
        fallbacks++;
        if (i.ai.note) fallbackNotes.add(i.ai.note);
      }
      if (i.ai.ms != null && i.ai.engine === "claude") claudeMs.push(i.ai.ms);
      crpTotal++;
      if ((i.severity >= CRITICAL) === Boolean(i.crp)) crpOk++;
    }
    const sev = claude.map((i) => i.severity);
    const counts = {};
    for (const x of sev) counts[x] = (counts[x] ?? 0) + 1;
    grades[t] = {
      rules: its[0]?.ai.ruleSeverity ?? null,
      graded: claude.length,
      mean: mean(sev),
      min: sev.length ? Math.min(...sev) : null,
      max: sev.length ? Math.max(...sev) : null,
      sd: sd(sev),
      mode: Object.entries(counts).sort((a, b) => b[1] - a[1])[0]?.[0] ?? null,
      modeShare: sev.length ? Math.max(...Object.values(counts)) / sev.length : null,
      critical: its.filter((i) => i.severity >= CRITICAL).length,
      classes: [...new Set(claude.map((i) => i.ai.attackClass))].slice(0, 3),
    };
  }
  const unusualGrades = Object.fromEntries(
    UNUSUAL.map((v) => {
      const sev = unusual[v].ids.map((id) => byId[id]?.severity).filter((x) => x != null);
      return [v, { mean: mean(sev), max: sev.length ? Math.max(...sev) : null, critical: sev.filter((x) => x >= CRITICAL).length }];
    }),
  );

  const heldGrades = Object.fromEntries(
    HELDOUT.map((t) => {
      const sev = held[t].ids.map((id) => byId[id]?.severity).filter((x) => x != null);
      return [t, { mean: mean(sev), min: sev.length ? Math.min(...sev) : null, max: sev.length ? Math.max(...sev) : null }];
    }),
  );
  const totHeld = HELDOUT.reduce((s, t) => s + held[t].n, 0);
  // Held-out "refused at edge" hits are coincidence (random source IP already quarantined), so detection counts inspection only.
  const caughtHeld = HELDOUT.reduce((s, t) => s + held[t].held, 0);

  // 6. Time to patch: attack -> held -> Claude graded -> analyst approval -> patch live -> replay refused.
  // One trial per attack type, each on a fresh demo so earlier patches don't interfere.
  const ttp = [];
  for (const t of TIERS) {
    await post("/api/reset", {});
    const t0 = performance.now();
    const r = await post("/api/simulate", { kind: "attack", tier: t });
    const tHeld = performance.now() - t0;
    if (r.verdict !== "sandboxed") continue;
    let item;
    for (let k = 0; k < 150; k++) {
      const s = await (await fetch(URL_ + "/api/state")).json();
      item = s.items.find((i) => i.id === r.id);
      if (item && item.ai.status === "done") break;
      await sleep(200);
    }
    const tGraded = performance.now() - t0;
    let snap = await post("/api/decision", { id: r.id, action: "approve", analyst: "Benchmark bot A" });
    let after = snap.items.find((i) => i.id === r.id);
    const twoPerson = after.status === "pending";
    if (twoPerson) {
      snap = await post("/api/decision", { id: r.id, action: "approve", analyst: "Benchmark bot B" });
      after = snap.items.find((i) => i.id === r.id);
    }
    const tPatched = performance.now() - t0;
    const replay = await post("/api/simulate", { kind: "r" });
    const tRefused = performance.now() - t0;
    ttp.push({ tier: t, severity: after.severity, twoPerson, patched: after.status === "patched", replayRefused: replay.verdict === "blocked", tHeld, tGraded, tPatched, tRefused });
    console.log(`  time-to-patch ${t}: sev ${after.severity}, patch live at ${(tPatched / 1000).toFixed(1)} s, replay ${replay.verdict}`);
  }

  const totAtk = TIERS.reduce((s, t) => s + attacks[t].n, 0);
  const caught = TIERS.reduce((s, t) => s + attacks[t].held + attacks[t].refused, 0);
  const totUnusual = UNUSUAL.reduce((s, v) => s + unusual[v].n, 0);
  const fpUnusual = UNUSUAL.reduce((s, v) => s + unusual[v].flagged, 0);

  const result = {
    ranAt: new Date().toISOString(),
    url: URL_,
    legit,
    unusual: Object.fromEntries(UNUSUAL.map((v) => [v, { n: unusual[v].n, flagged: unusual[v].flagged, ...unusualGrades[v] }])),
    attacks: Object.fromEntries(TIERS.map((t) => [t, { n: attacks[t].n, held: attacks[t].held, refused: attacks[t].refused, missed: attacks[t].missed, ...grades[t] }])),
    detectionRate: caught / totAtk,
    heldout: Object.fromEntries(HELDOUT.map((t) => [t, { n: held[t].n, held: held[t].held, refused: held[t].refused, missed: held[t].missed, ...heldGrades[t] }])),
    heldoutDetectionRate: caughtHeld / totHeld,
    timeToPatch: ttp,
    crpCorrect: { ok: crpOk, total: crpTotal },
    claudeFallbacks: fallbacks,
    fallbackNotes: [...fallbackNotes],
    latency: {
      inlineRttP50: q(rtt, 0.5),
      inlineRttP95: q(rtt, 0.95),
      claudeP50: q(claudeMs, 0.5),
      claudeP95: q(claudeMs, 0.95),
    },
  };

  const md = [
    `# Benchmark results`,
    ``,
    `Run ${result.ranAt} against ${URL_} with \`npm run benchmark\`. All traffic is simulated (lib/sim.ts).`,
    ``,
    `## Detection`,
    ``,
    `| Traffic | Sent | Held for review | Refused at edge | Missed |`,
    `|---|---:|---:|---:|---:|`,
    ...TIERS.map((t) => `| Attack: ${t} | ${attacks[t].n} | ${attacks[t].held} | ${attacks[t].refused} | ${attacks[t].missed} |`),
    `| **All attacks** | ${totAtk} | | | **caught ${pct(caught, totAtk)}** |`,
    ``,
    `"Refused at edge" means an earlier critical packet from the same source had already triggered the auto-quarantine.`,
    ``,
    `## Held-out attacks (types the rules were not written for)`,
    ``,
    `| Attack | Sent | Held | Refused at edge | Missed | Grade range when held |`,
    `|---|---:|---:|---:|---:|---:|`,
    ...HELDOUT.map((t) => `| ${t} | ${held[t].n} | ${held[t].held} | ${held[t].refused} | ${held[t].missed} | ${heldGrades[t].min == null ? "—" : `${heldGrades[t].min}–${heldGrades[t].max}`} |`),
    `| **All held-out** | ${totHeld} | | | | **caught by inspection ${pct(caughtHeld, totHeld)}** |`,
    ``,
    `Held-out "refused at edge" hits are coincidence: the random source IP was already quarantined by an earlier critical packet. They don't count as detection.`,
    ``,
    `## Time to patch (machine time, one trial per attack type)`,
    ``,
    `Attack sent → held inline → Claude graded → approval signed (two bots for severity ≥ ${CRITICAL}) → virtual patch live → identical replay refused at the edge. A real analyst's reading time comes on top of this.`,
    ``,
    `| Attack | Severity | Held | Graded | Patch live | Replay refused |`,
    `|---|---:|---:|---:|---:|---:|`,
    ...ttp.map((x) => `| ${x.tier} | ${x.severity}${x.twoPerson ? " (2 signers)" : ""} | ${f1(x.tHeld)} ms | ${f1(x.tGraded / 1000)} s | ${f1(x.tPatched / 1000)} s | ${x.replayRefused ? "yes" : "NO"} at ${f1(x.tRefused / 1000)} s |`),
    ``,
    `## False positives (legitimate traffic held)`,
    ``,
    `| Traffic | Sent | Wrongly held | Rate | Highest grade given |`,
    `|---|---:|---:|---:|---:|`,
    `| Clean logins | ${legit.n} | ${legit.flagged} | ${pct(legit.flagged, legit.n)} | — |`,
    ...UNUSUAL.map((v) => `| Unusual but legit: ${v} | ${unusual[v].n} | ${unusual[v].flagged} | ${pct(unusual[v].flagged, unusual[v].n)} | ${unusualGrades[v].max ?? "—"} |`),
    `| **All unusual-but-legit** | ${totUnusual} | ${fpUnusual} | **${pct(fpUnusual, totUnusual)}** | |`,
    ``,
    `## Severity grades (Claude vs. rules engine)`,
    ``,
    `| Attack | Rules score | Claude mean | Range | Std dev | Most common grade (share) | Armed critical protocol |`,
    `|---|---:|---:|---:|---:|---:|---:|`,
    ...TIERS.map((t) => {
      const g = grades[t];
      return `| ${t} | ${g.rules ?? "—"} | ${f1(g.mean)} | ${g.min ?? "—"}–${g.max ?? "—"} | ${g.sd.toFixed(2)} | ${g.mode ?? "—"} (${g.modeShare == null ? "—" : Math.round(g.modeShare * 100) + "%"}) | ${g.critical}/${attacks[t].held} |`;
    }),
    ``,
    `- Critical Response Protocol armed exactly when severity ≥ ${CRITICAL}: **${crpOk}/${crpTotal}** held packets.`,
    `- Claude fell back to the rules score on **${fallbacks}** packets${fallbackNotes.size ? ` (${[...fallbackNotes].join("; ")})` : ""}.`,
    ``,
    `## Latency`,
    ``,
    `| Step | p50 | p95 |`,
    `|---|---:|---:|`,
    `| Inline verdict (HTTP round trip on localhost, includes Next.js overhead) | ${f1(result.latency.inlineRttP50)} ms | ${f1(result.latency.inlineRttP95)} ms |`,
    `| Claude grading (runs after the packet is already held) | ${f1(result.latency.claudeP50 && result.latency.claudeP50 / 1000)} s | ${f1(result.latency.claudeP95 && result.latency.claudeP95 / 1000)} s |`,
    ``,
  ].join("\n");

  mkdirSync("benchmark", { recursive: true });
  writeFileSync("benchmark/results.json", JSON.stringify(result, null, 2));
  writeFileSync("benchmark/results.md", md);
  console.log("\n" + md);
  if (!KEEP) await post("/api/reset", {});
  console.log(KEEP ? "Kept benchmark data on the dashboard (--keep)." : "Demo reset.");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
