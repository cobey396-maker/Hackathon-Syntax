-- Audit ledger for ShieldOps. Run once in the Supabase SQL editor.
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

-- The only write path: validates input, stamps its own timestamp, appends one row.
-- Lets the server log decisions with the publishable key; nobody can edit or delete rows.
create or replace function public.record_audit_decision(
  p_analyst text,
  p_action text,
  p_packet_id text,
  p_rule_id text,
  p_severity smallint,
  p_confidence smallint,
  p_src_ip inet,
  p_changes smallint
) returns bigint
language plpgsql
security definer
set search_path = ''
as $$
declare
  new_id bigint;
begin
  if p_analyst is null or length(p_analyst) not between 1 and 80 then raise exception 'bad analyst'; end if;
  if p_packet_id !~ '^SBX-[0-9]{4,}$' or p_rule_id !~ '^VP-[0-9]{4,}$' then raise exception 'bad ids'; end if;
  insert into public.audit_ledger (ts, analyst, action, packet_id, rule_id, severity, confidence, src_ip, changes)
  values (now(), p_analyst, p_action, p_packet_id, p_rule_id, p_severity, p_confidence, p_src_ip, coalesce(p_changes, 0))
  returning id into new_id;
  return new_id;
end;
$$;

revoke all on function public.record_audit_decision(text, text, text, text, smallint, smallint, inet, smallint) from public;
grant execute on function public.record_audit_decision(text, text, text, text, smallint, smallint, inet, smallint) to anon, authenticated, service_role;
