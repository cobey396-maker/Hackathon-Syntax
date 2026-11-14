# Virtual Patch Sandbox

Cisco **Digital Shield** track prototype. A SOC console that holds zero-day VPN handshakes in a sandbox, grades how malformed they are (1–10), detonates them in a honeypot, and drafts a virtual patch. **A human analyst must approve the patch before it is deployed.** Every decision is attributed in an audit ledger.

## Run it

```bash
npm install
npm run dev                      # http://localhost:3000
python traffic_simulator.py      # second terminal; stdlib only
```

Simulator flags: `--rate 2` (events/sec), `--attack-every 5` (more zero-days), `--url` (other host).

## How it works

```
traffic_simulator.py ──POST──▶ /api/traffic ──▶ lib/detector.ts (grade 1-10, trace, patch, honeypot)
                                                   │
dashboard (polls /api/state every 1.5s) ◀──────── lib/store.ts (in-memory)
   └─ Approve / Override ──POST──▶ /api/decision ──▶ audit ledger
```

**Severity grade:** points per finding, summed and capped at 10:

| Finding | Points |
|---|---|
| Record version slightly out of range / nonsense | +1 / +2 |
| Declared length ≠ payload length | +3 |
| Length field exceeds parser buffer (0x4000) | +5 |
| Malformed cipher-suite list | +2 |
| Crashes the parser in honeypot replay | +3 |

All traffic and the vulnerability are **simulated**. IPs use RFC 5737 documentation ranges.

## Supabase

`lib/supabase.ts` returns a client once `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY` are in `.env.local`. Until then the in-memory store is used (it resets when the server restarts).
