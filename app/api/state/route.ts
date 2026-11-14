import { connection } from "next/server";
import { snapshot } from "@/lib/store";

export async function GET() {
  await connection(); // live data: never prerender
  return Response.json(snapshot());
}
