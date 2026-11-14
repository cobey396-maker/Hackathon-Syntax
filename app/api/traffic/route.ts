import { ingest } from "@/lib/store";
import type { RawPacket } from "@/lib/types";

export async function POST(req: Request) {
  const p = (await req.json()) as RawPacket;
  if (!p?.src_ip || typeof p.declared_len !== "number" || !Array.isArray(p.cipher_suites)) {
    return Response.json({ error: "bad packet" }, { status: 400 });
  }
  const item = ingest(p);
  return Response.json(item ? { verdict: "sandboxed", id: item.id, severity: item.severity } : { verdict: "allowed" });
}
