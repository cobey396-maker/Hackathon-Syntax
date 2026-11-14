# Virtual Patch Sandbox

Cisco **Digital Shield** track prototype. An enterprise SOC dashboard where an AI sits in front of the VPN firewall, intercepts zero-day handshakes, and holds them in a sandbox. The AI grades the packet (1–10), explains its reasoning, detonates the packet in a honeypot, and drafts a **virtual patch**. **A human analyst must review the evidence and click Approve before the rule is applied**, and every decision is written to an audit ledger with the analyst's name.

Stack: Next.js (App Router) · Tailwind CSS v4 · Python (traffic simulator) · Supabase (audit ledger).

## Run it

```bash
npm install
npm run dev                      # http://localhost:3000
python traffic_simulator.py      # optional second terminal; stdlib only
```

**No terminal needed:** the dashboard generates its own background logins and has the attack keys built in. On the page press **`Z`** (zero-day, rotating tier), **`C`** (critical 10/10), **`R`** (replay the last held attack), or click the same buttons under **Attack simulator** in the sidebar. Untick **Background logins** if you run the Python simulator instead.

Optionally, in the simulator terminal, legitimate remote-worker logins stream in **green**. Press **`z`** to inject a malformed zero-day handshake (rotates mild → moderate → critical), **`c`** to inject a critical one every time (10/10, crashes the parser; best for demos), **`r`** to replay the last zero-day from the same attacker, **`q`** to quit. In Git Bash or other terminals that don't pass single keys, type the key and press Enter. Flags: `--rate 2` (logins/sec), `--auto-attack 10` (also inject ~1 zero-day per 10 logins), `--url` (other host).

## Demo flow

1. Press `c` (or `z`): a toast and a flashing **NEW** row appear in the **Active Sandbox Queue** within ~1.5 s.
2. Click the row: the **Inspection Modal** opens. The **AI reasoning trace** reveals itself check by check, the bad bytes light up in the captured header, and the drafted virtual patch is listed as a change set with a false-positive check.
3. Click **Simulate Blast Radius**: the honeypot replays the packet; the simulated firewall crashes (or degrades), then the sandbox reports it contained.
4. Click **Approve Virtual Patch** (neon purple) or **Override** (grey). The row updates and the **Audit Ledger** gains an entry naming the analyst on duty.
5. **Dynamic edge deployment:** an approved patch goes live in **Deployed Virtual Patches**. Press `r` in the simulator: the same attack is now refused at the edge before the AI runs. The simulator prints `ERR_CONNECTION_REFUSED · blocked by VP-0001`, the dot stops at the AI Shield, and the patch's hit count and the **Refused at edge** KPI increase.

Approved patches block the whole malformation class, so later `z` presses that share a condition are refused too. Click **Reset demo** at the bottom of the sidebar (twice, to confirm) to clear the queue, patches, traffic and counters between rehearsals. Rows already written to Supabase are kept; the dashboard just hides them.

## Claude grades severity

When a packet is held, the parser checks give a quick **rules score**. The server then sends the evidence (field checks, baseline comparison, honeypot result) to **Claude Opus 5.5** (`lib/grader.ts`), which returns a severity 1–10, confidence, attack class, a short rationale and risk factors as structured JSON. The queue shows "Claude grading…" for the few seconds that takes. Without `ANTHROPIC_API_KEY` (or if the call fails), the rules score stands and the modal says so.

```
ANTHROPIC_API_KEY=sk-ant-...     # in .env.local (and in Vercel's environment variables)
```

**Data minimization:** Claude only gets what grading needs: header fields, check results and the honeypot outcome. The **username, full source IP and payload bytes are never sent**; the source is masked to its /24 network (`maskIp` in `lib/grader.ts`). The modal says this under every Claude assessment.

## Critical Response Protocol (severity 7+)

1. **Auto-quarantine, time-limited:** the source IP is blocked at the edge the moment it's graded 7+, before any human looks (`QRN-xxxx` in Deployed Virtual Patches). It **lifts itself after 15 minutes** unless an analyst confirms it, which the first "Approve" signature does. An AI mistake can't block anyone indefinitely without a human agreeing.
2. **5-minute response SLA:** countdown in the queue and the modal.
3. **Two-person rule:** approving *or* overriding needs two different analysts. Sign once, switch analyst in the sidebar, sign again. The ledger records both names.
4. **P1 incident:** the drafted patch opens a P1 incident and notifies PSIRT.

The decision lifts the quarantine; an approval replaces it with the virtual patch.

## Validation: benchmark

`npm run benchmark` (with `npm run dev` running) drives the real pipeline end to end: edge enforcement, AI Shield checks, honeypot, Claude grading, Critical Response Protocol. It sends **300 clean logins, 60 unusual-but-legitimate handshakes** (TLS 1.0 clients, Chrome GREASE values, an uncommon RSA-GCM suite, large post-quantum ClientHellos) and **75 attacks** (15 each of five types). Full output is in `benchmark/results.md`.

| | Run 1 | Run 2 (after fix) |
|---|---:|---:|
| Attacks caught (75) | 100% | 100% |
| False positives, clean logins (300) | 0% | 0% |
| **False positives, unusual-but-legit (60)** | **50%** | **0%** |
| Critical protocol armed exactly at severity ≥ 7 | 73/73 | 74/74 |
| Claude grading fell back to rules | 6 (rate-limited) | 0 |

**What run 1 caught:** the shield held *every* handshake carrying RFC 8701 GREASE cipher values, which Chrome sends on purpose, and every handshake offering the valid but uncommon `0x009C` suite. In production that would have quarantined real users. We fixed the detector (ignore GREASE, recognize registered suites) and re-ran; run 1 is kept in `benchmark/results-v1-before-fix.md`.

**Claude's grades are consistent and spread across the scale** (run 2, 15 per type):

| Attack | Rules score | Claude mean | Range | Critical protocol |
|---|---:|---:|---:|---:|
| Protocol version probe | 2 | 2.0 | 2–2 | 0/15 |
| Cipher-suite fuzz | 2 | 2.0 | 2–2 | 0/15 |
| Small length desync | 3 | 4.3 | 4–5 | 0/15 |
| Large desync + fuzz | 5 | 6.0 | 6–6 | 0/14 |
| Length overflow (parser crash) | 8 | 9.5 | 9–10 | 15/15 |

No attack type ever crossed the critical line in the wrong direction: none of the mild types reached 7, and every overflow did.

| Step | p50 | p95 |
|---|---:|---:|
| Inline verdict (HTTP round trip on localhost, includes Next.js overhead) | 12.1 ms | 31.3 ms |
| Claude grading (runs after the packet is already held) | 4.0 s | 5.6 s |

## Limitations & Safeguards

**Limitations (what this prototype does not prove)**
- **Simulated traffic only.** Attacks and logins come from our generator (`lib/sim.ts`), so 100% detection means "catches the attack types we modeled," not "catches real zero-days." The next step is replaying real pcaps (e.g. public TLS fuzzing corpora) through `/api/traffic`.
- **Detection is structural.** The inline shield catches handshakes that break the protocol's structure. An exploit hidden inside a *well-formed* handshake would pass. Claude grades and explains *after* a packet is flagged; it does not decide what gets flagged.
- **The honeypot is simulated.** It predicts crash / leak / timeout from the packet's fields; it doesn't run real firewall firmware.
- **Claude can be wrong.** It runs at low effort for speed; small desyncs vary between 4 and 5. The rules score is always shown beside Claude's so analysts can see disagreements.
- **State is in memory.** On Vercel, serverless instances can split or reset the queue; the audit ledger in Supabase is the durable record. Run locally for demos.
- **Ledger keeps full source IPs** of blocked sources, because accountability needs them.

**Safeguards (how we limit harm)**
- **Human in the loop:** nothing the AI drafts goes live until an analyst approves it; severity 7+ needs two different analysts.
- **Proportionate blocking:** the only automatic action (critical quarantine) lifts after 15 minutes unless a human confirms it, and the response scales with severity (watch → rate-limit → ACL block).
- **False-positive check before approval:** each drafted rule is tested against recent legitimate logins, and the benchmark tests it against unusual-but-legitimate clients.
- **Explainability:** every verdict shows the failing bytes, the checks, the honeypot log, Claude's rationale and the exact config changes.
- **Accountability:** decisions go to an append-only Supabase ledger written through a validated database function, naming who signed.
- **Data minimization:** no usernames, full IPs or payloads go to the AI model.
- **Fail-safe:** if Claude is unreachable, rate-limited or declines, the deterministic rules score stands and the UI says so.

## How it works

```
traffic_simulator.py ──POST──▶ /api/traffic ──▶ deployed patches? ──match──▶ 403 ERR_CONNECTION_REFUSED
                                                    │ no match
                                                    ▼
                                               lib/detector.ts  (field checks, severity 1-10, honeypot script, patch)
                                                    │
dashboard (polls /api/state every 1.5 s) ◀──────── lib/store.ts  (in-memory queue + stats)
   └─ Approve / Override ──POST──▶ /api/decision ──▶ lib/audit.ts (Supabase `audit_ledger`, or memory until keys exist)
```

**Severity grade:** points per failed check, summed and capped at 10:

| Check | Points |
|---|---|
| Record version slightly out of range / nonsense | +1 / +2 |
| Declared length ≠ payload length | +3 |
| Length field exceeds parser buffer (0x4000) | +5 |
| Malformed cipher-suite list | +2 |
| Crashes the parser in honeypot replay | +3 |

All traffic and the vulnerability are **simulated**. IPs use RFC 5737 documentation ranges.

## Supabase

1. Run `supabase/audit_ledger.sql` in the Supabase SQL editor (creates the append-only `audit_ledger` table with RLS).
2. Add to `.env.local`:
   ```
   NEXT_PUBLIC_SUPABASE_URL=https://xxxx.supabase.co
   NEXT_PUBLIC_SUPABASE_ANON_KEY=...
   SUPABASE_SERVICE_ROLE_KEY=...      # server only; used for inserts
   ```
3. Restart `npm run dev`. The ledger header switches from `source: mock` to `source: supabase`.

Until then decisions are kept in memory and reset when the server restarts.
