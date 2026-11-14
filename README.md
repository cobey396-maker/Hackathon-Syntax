# Virtual Patch Sandbox

Cisco **Digital Shield** track prototype. An enterprise SOC dashboard where an AI sits in front of the VPN firewall, intercepts zero-day handshakes, and holds them in a sandbox. The AI grades the packet (1–10), explains its reasoning, detonates the packet in a honeypot, and drafts a **virtual patch**. **A human analyst must review the evidence and click Approve before the rule is applied**, and every decision is written to an audit ledger with the analyst's name.

Stack: Next.js (App Router) · Tailwind CSS v4 · Python (traffic simulator) · Supabase (audit ledger).

## Run it

```bash
npm install
npm run dev                      # http://localhost:3000
python traffic_simulator.py      # second terminal; stdlib only
```

In the simulator terminal, legitimate remote-worker logins stream in **green**. Press **`z`** to inject a malformed zero-day handshake (rotates mild → moderate → critical), **`c`** to inject a critical one every time (10/10, crashes the parser; best for demos), **`r`** to replay the last zero-day from the same attacker, **`q`** to quit. In Git Bash or other terminals that don't pass single keys, type the key and press Enter. Flags: `--rate 2` (logins/sec), `--auto-attack 10` (also inject ~1 zero-day per 10 logins), `--url` (other host).

## Demo flow

1. Press `c` (or `z`): a toast and a flashing **NEW** row appear in the **Active Sandbox Queue** within ~1.5 s.
2. Click the row: the **Inspection Modal** opens. The **AI reasoning trace** reveals itself check by check, the bad bytes light up in the captured header, and the drafted virtual patch is listed as a change set with a false-positive check.
3. Click **Simulate Blast Radius**: the honeypot replays the packet; the simulated firewall crashes (or degrades), then the sandbox reports it contained.
4. Click **Approve Virtual Patch** (neon purple) or **Override** (grey). The row updates and the **Audit Ledger** gains an entry naming the analyst on duty.
5. **Dynamic edge deployment:** an approved patch goes live in **Deployed Virtual Patches**. Press `r` in the simulator: the same attack is now refused at the edge before the AI runs. The simulator prints `ERR_CONNECTION_REFUSED · blocked by VP-0001`, the dot stops at the AI Shield, and the patch's hit count and the **Refused at edge** KPI increase.

Approved patches block the whole malformation class, so later `z` presses that share a condition are refused too. Click **Reset demo** at the bottom of the sidebar (twice, to confirm) to clear the queue, patches, traffic and counters between rehearsals. Rows already written to Supabase are kept; the dashboard just hides them.

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
