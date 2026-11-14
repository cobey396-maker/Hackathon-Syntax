# ShieldOps

**The AI investigates. The human authorizes. The system verifies.**

HackNCAT 10.0 · Track 01 Operation Digital Shield (Cisco). A frontend-only simulation of a
human-in-the-loop response to suspicious VPN traffic: detect → contain → sandbox replay →
analyze → propose a virtual firewall fix → human approval → enforce & verify (with automatic
rollback) → audit log.

Everything runs in the browser on synthetic data (RFC 5737 documentation IPs). There is no
backend, no real network capture and no real firewall. The "AI" is a set of deterministic,
explainable rules, not a trained model.

## Run it

```bash
npm install
npm run dev        # http://localhost:3000
npm test           # simulation engine tests (Node's built-in runner)
```

## Demo (about 90 seconds)

1. **Malformed TLS handshake** → Investigate → Approve fix. Watch the connection move through the
   sandbox to the analyst; after approval the fix is verified and repeat attacks stop at the firewall.
2. **Unusual but legitimate** → Investigate. The sandbox finds no harm and the user is let in (no unfair blocking).
3. **Verification failure → rollback** → Investigate → Approve. Testing catches a blocked normal user
   and the fix is undone automatically.
4. **Firewall** tab → test the malformed connection: it now shows *Blocked*.

Use the **Map / Timeline / Spotlight** switch to pick how the journey is visualized.

## Code map

| Path | What it does |
|---|---|
| `lib/simulation/engine.ts` | Incident state machine; every change goes through `reduce()` |
| `lib/simulation/detector.ts` | Field checks → 0-10 risk score |
| `lib/simulation/honeypot.ts` | Mock parser replay → evidence (observed / inferred / unknown) |
| `lib/simulation/firewall.ts` | Virtual firewall: evaluate, apply, rollback, quarantine |
| `lib/simulation/proposals.ts`, `verification.ts` | Draft fixes; before/after tests on an isolated policy copy |
| `lib/simulation/scenarios.ts` | Synthetic scenarios and legitimate control traffic |
| `components/simulation/SimulationProvider.tsx` | Single shared React state |
| `components/viz/*` | Journey model + Map, Timeline and Spotlight visualizations |
| `tests/simulation.test.ts` | Engine tests |
