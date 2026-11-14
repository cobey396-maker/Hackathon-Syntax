# Benchmark results

Run 2026-11-14T06:26:47.295Z against http://localhost:3000 with `npm run benchmark`. All traffic is simulated (lib/sim.ts).

## Detection

| Traffic | Sent | Held for review | Refused at edge | Missed |
|---|---:|---:|---:|---:|
| Attack: version-probe | 15 | 14 | 1 | 0 |
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
| Unusual but legit: grease-cipher | 15 | 15 | 100.0% | 2 |
| Unusual but legit: rsa-gcm-cipher | 15 | 15 | 100.0% | 2 |
| Unusual but legit: large-pq-hello | 15 | 0 | 0.0% | — |
| **All unusual-but-legit** | 60 | 30 | **50.0%** | |

## Severity grades (Claude vs. rules engine)

| Attack | Rules score | Claude mean | Range | Std dev | Most common grade (share) | Armed critical protocol |
|---|---:|---:|---:|---:|---:|---:|
| version-probe | 1 | 2.0 | 2–2 | 0.00 | 2 (100%) | 0/14 |
| cipher-fuzz | 2 | 2.0 | 2–2 | 0.00 | 2 (100%) | 0/15 |
| length-desync | 3 | 4.1 | 4–5 | 0.35 | 4 (86%) | 0/15 |
| desync-fuzz | 5 | 6.0 | 6–6 | 0.00 | 6 (100%) | 0/14 |
| overflow | 8 | 9.6 | 9–10 | 0.49 | 10 (57%) | 15/15 |

- Critical Response Protocol armed exactly when severity ≥ 7: **73/73** held packets.
- Claude fell back to the rules score on **6** packets (Claude rate-limited; rules score kept).

## Latency

| Step | p50 | p95 |
|---|---:|---:|
| Inline verdict (HTTP round trip on localhost, includes Next.js overhead) | 13.0 ms | 26.3 ms |
| Claude grading (runs after the packet is already held) | 4.0 s | 6.3 s |
