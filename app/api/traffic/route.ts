import { after } from "next/server";
import { gradeItem, ingest } from "@/lib/store";
import type { RawPacket } from "@/lib/types";

export async function POST(req: Request) {
  const p = (await req.json()) as RawPacket;
  if (!p?.src_ip || typeof p.declared_len !== "number" || !Array.isArray(p.cipher_suites)) {
    return Response.json({ error: "bad packet" }, { status: 400 });
  }
  const r = ingest(p);
  if (r && "item" in r) after(() => gradeItem(r.item.id, r.packet)); // Claude grades after we respond
  if (r && "blocked" in r) {
    // Refused at the edge by an approved virtual patch
    return Response.json({ verdict: "blocked", error: "ERR_CONNECTION_REFUSED", ruleId: r.blocked.ruleId }, { status: 403 });
  }
  return Response.json(r ? { verdict: "sandboxed", id: r.item.id, severity: r.item.severity } : { verdict: "allowed" });
}
