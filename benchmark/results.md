# Benchmark results

Run 2026-11-14T06:27:49.040Z against http://localhost:3000 with `npm run benchmark`. All traffic is simulated (lib/sim.ts).

## Detection

| Traffic | Sent | Held for review | Refused at edge | Missed |
|---|---:|---:|---:|---:|
| Attack: version-probe | 15 | 15 | 0 | 0 |
| Attack: cipher-fuzz | 15 | 15 | 0 | 0 |
| Attack: length-desync | 15 | 15 | 0 | 0 |
| Attack: desync-fuzz | 15 | 14 | 1 | 0 |
| Attack: overflow | 15 | 15 | 0 | 0 |
| **All attacks** | 75 | | | **caught 100.0%** |

"Refused at edge" means an earlier critical packet from the same source had already triggered the auto-quarantine.

## False positives (legitimate traffic held)

| Traffic | Sent | Wrongly held | Rate | Highest grade given |
|---|---:|---:|---:|---:|
| Clean logins | 300 | 0 | 0.0% | — |
| Unusual but legit: legacy-tls10 | 15 | 0 | 0.0% | — |
| Unusual but legit: grease-cipher | 15 | 0 | 0.0% | — |
| Unusual but legit: rsa-gcm-cipher | 15 | 0 | 0.0% | — |
| Unusual but legit: large-pq-hello | 15 | 0 | 0.0% | — |
| **All unusual-but-legit** | 60 | 0 | **0.0%** | |

## Severity grades (Claude vs. rules engine)

| Attack | Rules score | Claude mean | Range | Std dev | Most common grade (share) | Armed critical protocol |
|---|---:|---:|---:|---:|---:|---:|
| version-probe | 2 | 2.0 | 2–2 | 0.00 | 2 (100%) | 0/15 |
| cipher-fuzz | 2 | 2.0 | 2–2 | 0.00 | 2 (100%) | 0/15 |
| length-desync | 3 | 4.3 | 4–5 | 0.44 | 4 (73%) | 0/15 |
| desync-fuzz | 5 | 6.0 | 6–6 | 0.00 | 6 (100%) | 0/14 |
| overflow | 8 | 9.5 | 9–10 | 0.50 | 9 (53%) | 15/15 |

- Critical Response Protocol armed exactly when severity ≥ 7: **74/74** held packets.
- Claude fell back to the rules score on **0** packets.

## Latency

| Step | p50 | p95 |
|---|---:|---:|
| Inline verdict (HTTP round trip on localhost, includes Next.js overhead) | 12.1 ms | 31.3 ms |
| Claude grading (runs after the packet is already held) | 4.0 s | 5.6 s |
