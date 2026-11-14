import { decide, snapshot } from "@/lib/store";

export async function POST(req: Request) {
  const { id, action, analyst } = await req.json();
  if ((action !== "approve" && action !== "deny") || !analyst) {
    return Response.json({ error: "bad request" }, { status: 400 });
  }
  const r = await decide(id, action, analyst);
  if (!r.ok) return Response.json({ error: r.error }, { status: r.status });
  return Response.json(await snapshot());
}
