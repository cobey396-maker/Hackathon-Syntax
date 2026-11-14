import { createClient } from "@supabase/supabase-js";

// Server-side client for the audit ledger. Null until .env.local has a URL and a key; the app
// then keeps decisions in memory (ledger shows "source: mock").
//   NEXT_PUBLIC_SUPABASE_URL=https://xxxx.supabase.co
//   NEXT_PUBLIC_SUPABASE_ANON_KEY=...   publishable key; reads + record_audit_decision() only
//   SUPABASE_SERVICE_ROLE_KEY=...       optional secret key; preferred when present
// Only server code imports this file, so neither key reaches the browser.
const url = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "";

export const supabase = url && key ? createClient(url, key, { auth: { persistSession: false } }) : null;
