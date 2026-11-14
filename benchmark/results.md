# Benchmark results

Run 2026-11-14T06:36:07.431Z against http://localhost:3000 with `npm run benchmark`. All traffic is simulated (lib/sim.ts).

## Detection

| Traffic | Sent | Held for review | Refused at edge | Missed |
|---|---:|---:|---:|---:|
| Attack: version-probe | 15 | 15 | 0 | 0 |
| Attack: cipher-fuzz | 15 | 14 | 1 | 0 |
| Attack: length-desync | 15 | 13 | 2 | 0 |
| Attack: desync-fuzz | 15 | 15 | 0 | 0 |
| Attack: overflow | 15 | 14 | 1 | 0 |
| **All attacks** | 75 | | | **caught 100.0%** |

"Refused at edge" means an earlier critical packet from the same source had already triggered the auto-quarantine.

## Held-out attacks (types the rules were not written for)

| Attack | Sent | Held | Refused at edge | Missed | Grade range when held |
|---|---:|---:|---:|---:|---:|
| sslv3-downgrade | 10 | 10 | 0 | 0 | 2–2 |
| length-underflow | 10 | 7 | 3 | 0 | 4–5 |
| zero-length-record | 10 | 0 | 1 | 9 | — |
| ext-len-overflow | 10 | 0 | 1 | 9 | — |
| buffer-boundary-probe | 10 | 0 | 1 | 9 | — |
| **All held-out** | 50 | | | | **caught by inspection 34.0%** |

Held-out "refused at edge" hits are coincidence: the random source IP was already quarantined by an earlier critical packet. They don't count as detection.

## Time to patch (machine time, one trial per attack type)

Attack sent → held inline → Claude graded → approval signed (two bots for severity ≥ 7) → virtual patch live → identical replay refused at the edge. A real analyst's reading time comes on top of this.

| Attack | Severity | Held | Graded | Patch live | Replay refused |
|---|---:|---:|---:|---:|---:|
| version-probe | 2 | 24.9 ms | 3.3 s | 3.5 s | yes at 3.6 s |
| cipher-fuzz | 2 | 24.4 ms | 5.7 s | 5.9 s | yes at 5.9 s |
| length-desync | 5 | 27.1 ms | 4.6 s | 5.0 s | yes at 5.1 s |
| desync-fuzz | 6 | 28.1 ms | 3.8 s | 3.9 s | yes at 4.0 s |
| overflow | 9 (2 signers) | 20.8 ms | 7.5 s | 7.8 s | yes at 7.9 s |

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
| version-probe | 1 | 2.0 | 2–2 | 0.00 | 2 (100%) | 0/15 |
| cipher-fuzz | 2 | 2.0 | 2–2 | 0.00 | 2 (100%) | 0/14 |
| length-desync | 3 | 4.1 | 4–5 | 0.27 | 4 (92%) | 0/13 |
| desync-fuzz | 5 | 6.0 | 6–6 | 0.00 | 6 (100%) | 0/15 |
| overflow | 8 | 9.4 | 9–10 | 0.49 | 9 (57%) | 14/14 |

- Critical Response Protocol armed exactly when severity ≥ 7: **71/71** held packets.
- Claude fell back to the rules score on **0** packets.

## Latency

| Step | p50 | p95 |
|---|---:|---:|
| Inline verdict (HTTP round trip on localhost, includes Next.js overhead) | 10.0 ms | 25.9 ms |
| Claude grading (runs after the packet is already held) | 4.0 s | 6.6 s |
