-- Audit ledger for Virtual Patch Sandbox. Run in the Supabase SQL editor once keys exist.
-- Every analyst decision on an AI-drafted virtual patch lands here, append-only.

create table if not exists public.audit_ledger (
  id          bigint generated always as identity primary key,
  ts          timestamptz not null default now(),
  analyst     text        not null,
  action      text        not null check (action in ('approve', 'deny')),
  packet_id   text        not null,   -- SBX-0004
  rule_id     text        not null,   -- VP-0004
  severity    smallint    not null check (severity between 1 and 10),
  confidence  smallint    not null check (confidence between 0 and 100),
  src_ip      inet        not null,
  changes     smallint    not null default 0
);

create index if not exists audit_ledger_ts_idx on public.audit_ledger (ts desc);

alter table public.audit_ledger enable row level security;

-- Dashboards may read; only the server (service role) may insert. No update/delete policies: append-only.
create policy "audit ledger is readable"
  on public.audit_ledger for select
  to anon, authenticated
  using (true);
