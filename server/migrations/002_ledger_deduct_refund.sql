-- Phase 3: atomic credit ledger (deduct + refund) for /api/audio/synthesize.
-- Assumes users/credit_transactions may already exist (task premise); IF NOT
-- EXISTS clauses below are purely defensive. Safe to run repeatedly.

create extension if not exists pgcrypto;

create table if not exists public.users (
  id uuid primary key,
  email text unique,
  credits integer not null default 500
);

create table if not exists public.credit_transactions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid,
  amount integer,
  reason text,
  ref_id uuid,
  created_at timestamptz not null default now()
);

-- Seed the mock user referenced by the stub auth middleware so the atomic
-- ledger works end-to-end until real JWT auth lands.
insert into public.users (id, email, credits)
values ('00000000-0000-0000-0000-000000000001', 'mock@ekithab.local', 500)
on conflict (id) do nothing;

-- Atomic deduction + ledger row. Raises INSUFFICIENT_CREDITS (SQLSTATE P0001)
-- when the UPDATE matches zero rows (missing user OR credits < cost).
create or replace function public.deduct_credits(
  p_user_id uuid,
  p_cost integer,
  p_ref_id uuid
) returns integer
language plpgsql
as $$
declare
  v_balance integer;
begin
  update public.users
     set credits = credits - p_cost
   where id = p_user_id
     and credits >= p_cost
  returning credits into v_balance;

  if not found then
    raise exception 'INSUFFICIENT_CREDITS' using errcode = 'P0001';
  end if;

  insert into public.credit_transactions (user_id, amount, reason, ref_id)
  values (p_user_id, -p_cost, 'synthesis', p_ref_id);

  return v_balance;
end;
$$;

-- Atomic refund: adds credits back and logs a positive ledger row with
-- reason='refund'. Guarded: cost must be positive, a matching 'synthesis'
-- deduction for this ref_id must already exist, and it must not have been
-- refunded yet. This makes a refund only ever able to reverse a real,
-- previously-charged synthesis for the same generation.
create or replace function public.refund_credits(
  p_user_id uuid,
  p_cost integer,
  p_ref_id uuid
) returns integer
language plpgsql
as $$
declare
  v_balance integer;
  v_prior integer;
begin
  if p_cost <= 0 then
    raise exception 'INVALID_REFUND_COST' using errcode = 'P0001';
  end if;

  -- Only refund a deduction that actually happened for this generation,
  -- and only once. The synthesis row is the single source of truth here.
  select count(*)
    into v_prior
    from public.credit_transactions
   where user_id = p_user_id
     and ref_id = p_ref_id
     and amount = -p_cost
     and reason = 'synthesis';

  if v_prior = 0 then
    raise exception 'NO_MATCHING_DEDUCTION' using errcode = 'P0001';
  end if;

  if exists (
    select 1
      from public.credit_transactions
     where user_id = p_user_id
       and ref_id = p_ref_id
       and reason = 'refund'
  ) then
    raise exception 'ALREADY_REFUNDED' using errcode = 'P0001';
  end if;

  update public.users
     set credits = credits + p_cost
   where id = p_user_id
  returning credits into v_balance;

  insert into public.credit_transactions (user_id, amount, reason, ref_id)
  values (p_user_id, p_cost, 'refund', p_ref_id);

  return v_balance;
end;
$$;

-- Lock down the ledger RPCs. By default Postgres grants EXECUTE TO PUBLIC, so
-- PostgREST exposes them at /rest/v1/rpc/ to the anon/authenticated roles
-- using only the public URL + anon key -- anyone could mint credits. Revoke
-- from every role and grant only to service_role, which is what the server
-- actually uses (server/src/config/supabase.js uses SUPABASE_SERVICE_ROLE_KEY).
revoke execute on function public.deduct_credits(uuid, integer, uuid)
  from public, anon, authenticated;
revoke execute on function public.refund_credits(uuid, integer, uuid)
  from public, anon, authenticated;

grant execute on function public.deduct_credits(uuid, integer, uuid) to service_role;
grant execute on function public.refund_credits(uuid, integer, uuid) to service_role;
