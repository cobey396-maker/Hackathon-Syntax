import { createClient } from "@supabase/supabase-js";

// Null until keys are added to .env.local; the app then runs on the in-memory store.
// Server routes prefer the service-role key (inserts); the anon key works for reads.
//   NEXT_PUBLIC_SUPABASE_URL=https://xxxx.supabase.co
//   NEXT_PUBLIC_SUPABASE_ANON_KEY=...
//   SUPABASE_SERVICE_ROLE_KEY=...   (server only, never exposed to the browser)
const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

export const supabase = url && key ? createClient(url, key, { auth: { persistSession: false } }) : null;
