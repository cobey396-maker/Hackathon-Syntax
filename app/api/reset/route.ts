import { reset, snapshot } from "@/lib/store";

// Clears the demo state between rehearsals. Audit rows already in Supabase are kept.
export async function POST() {
  reset();
  return Response.json(await snapshot());
}
