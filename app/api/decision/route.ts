import { decide, snapshot } from "@/lib/store";

export async function POST(req: Request) {
  const { id, action, analyst } = await req.json();
  if ((action !== "approve" && action !== "override") || !analyst) {
    return Response.json({ error: "bad request" }, { status: 400 });
  }
  if (!decide(id, action, analyst)) {
    return Response.json({ error: "not found or already decided" }, { status: 409 });
  }
  return Response.json(snapshot());
}
