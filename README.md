# Virtual Patch Sandbox

Cisco **Digital Shield** track prototype. An enterprise SOC dashboard where an AI sits in front of the VPN firewall, intercepts zero-day handshakes, and holds them in a sandbox. The AI grades the packet (1–10), explains its reasoning, detonates the packet in a honeypot, and drafts a **virtual patch**. **A human analyst must review the evidence and click Approve before the rule is applied**, and every decision is written to an audit ledger with the analyst's name.

Stack: Next.js (App Router) · Tailwind CSS v4 · Python (traffic simulator) · Supabase (audit ledger).

## Run it

```bash
npm install
npm run dev                      # http://localhost:3000
python traffic_simulator.py      # second terminal; stdlib only
```

In the simulator terminal, legitimate remote-worker logins stream in **green**. Press **`z`** to inject a malformed zero-day handshake (rotates mild → moderate → critical), **`q`** to quit. Flags: `--rate 2` (logins/sec), `--auto-attack 10` (also inject ~1 zero-day per 10 logins), `--url` (other host).

## Demo flow

1. Press `z`: a toast and a flashing **NEW** row appear in the **Active Sandbox Queue** within ~1.5 s.
2. Click the row: the **Inspection Modal** opens. The **AI reasoning trace** reveals itself check by check, the bad bytes light up in the captured header, and the drafted virtual patch is listed as a change set with a false-positive check.
3. Click **Simulate Blast Radius**: the honeypot replays the packet; the simulated firewall crashes (or degrades), then the sandbox reports it contained.
4. Click **Approve Virtual Patch** (neon purple) or **Override** (grey). The row updates and the **Audit Ledger** gains an entry naming the analyst on duty.

## How it works

```
traffic_simulator.py ──POST──▶ /api/traffic ──▶ lib/detector.ts  (field checks, severity 1-10, honeypot script, patch)
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
