import { demoCritical, legit, malformed, TIERS, UNUSUAL, unusualLegit, type Tier, type Unusual } from "@/lib/sim";
import { after } from "next/server";
import { gradeItem, ingest, lastAttack, nextTier } from "@/lib/store";

// Built-in simulator for the dashboard hotkeys and background traffic.
//   legit = one normal login   z = zero-day (rotating tier)   c = critical 10/10   r = replay last held attack
//   attack + tier = a specific attack type   unusual + variant = legitimate but odd handshake (benchmark)
export async function POST(req: Request) {
  const { kind, tier: want, variant } = (await req.json().catch(() => ({}))) as { kind?: string; tier?: string; variant?: string };
  let tier: string | null = null;
  let p;
  if (kind === "legit") p = legit();
  else if (kind === "attack" && TIERS.includes(want as Tier)) {
    p = malformed(want as Tier);
    tier = want as Tier;
  } else if (kind === "unusual" && UNUSUAL.includes(variant as Unusual)) {
    p = unusualLegit(variant as Unusual);
    tier = `unusual:${variant}`;
  } else if (kind === "z") {
    const t: Tier = TIERS[nextTier(TIERS.length)];
    p = malformed(t);
    tier = t;
  } else if (kind === "c") {
    p = demoCritical();
    tier = "critical";
  }
  else if (kind === "r") {
    const last = lastAttack();
    if (!last) return Response.json({ error: "nothing to replay yet; press z or c first" }, { status: 409 });
    p = { ...last, ts: new Date().toISOString() };
    tier = "replay";
  } else return Response.json({ error: "kind must be legit | z | c | r | attack (+tier) | unusual (+variant)" }, { status: 400 });

  const r = ingest(p);
  if (r && "item" in r) after(() => gradeItem(r.item.id, r.packet)); // Claude grades after we respond
  if (r && "blocked" in r) return Response.json({ verdict: "blocked", ruleId: r.blocked.ruleId, srcIp: p.src_ip, tier });
  if (r) return Response.json({ verdict: "sandboxed", id: r.item.id, severity: r.item.severity, srcIp: p.src_ip, tier });
  return Response.json({ verdict: "allowed", srcIp: p.src_ip, tier });
}
