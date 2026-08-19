-- Dev-only demonstration data — NOT operational seed data (that's
-- 20260819080700_operational_seed_data.sql, which seeds real categories and
-- payment methods and is a migration, always applied). This file exists so
-- `supabase db reset` (local Postgres, not the linked remote project) gives
-- you something to look at immediately instead of an empty dashboard.
--
-- This file is intentionally NOT the source of truth for demo data on the
-- linked remote project — raw SQL can't call the confirm/reserve RPCs as a
-- real user session, so it can't reproduce buyer/point/audit_log invariants
-- correctly. For the actual linked Supabase project, run instead:
--
--   node scripts/seed-demo-data.mjs
--
-- which goes through the same rpc_reserve_points/rpc_confirm_sale calls the
-- app itself uses (idempotent — safe to run more than once).
--
-- What's below is a lighter-weight raw-SQL equivalent for local dev only,
-- kept intentionally simple: one raffle, a few pre-sold points inserted
-- directly (fine here because there's no concurrent traffic to race against
-- on a local throwaway database), a few financial transactions.

do $$
declare
  v_admin_id uuid;
  v_raffle_id uuid;
  v_buyer_id uuid;
  v_pix_id uuid;
  v_dinheiro_id uuid;
begin
  select id into v_admin_id from public.profiles where role = 'ADMIN' limit 1;
  select id into v_pix_id from public.payment_methods where name = 'PIX';
  select id into v_dinheiro_id from public.payment_methods where name = 'Dinheiro';

  insert into public.raffles (
    slug, title, description, total_points, unit_price_cents, starts_at, ends_at, created_by
  )
  values (
    'rifa-formatura-tads-2026',
    'Rifa da Formatura — Técnico em ADS 2026',
    'Ajude a turma a custear a festa de formatura! Prêmio: cesta de eletrônicos + vale-presente.',
    50,
    1000,
    now() - interval '10 days',
    now() + interval '30 days',
    v_admin_id
  )
  on conflict (slug) do nothing
  returning id into v_raffle_id;

  if v_raffle_id is null then
    select id into v_raffle_id from public.raffles where slug = 'rifa-formatura-tads-2026';
  end if;

  insert into public.buyers (full_name, phone, whatsapp)
  values ('Mariana Alves Costa', '(86) 99911-2233', '(86) 99911-2233')
  returning id into v_buyer_id;

  insert into public.raffle_sales (raffle_id, buyer_id, payment_method_id, amount_cents, idempotency_key)
  values (v_raffle_id, v_buyer_id, v_pix_id, 3000, gen_random_uuid())
  returning id into v_buyer_id; -- reusing var for sale id below

  update public.raffle_points
  set status = 'SOLD'
  where raffle_id = v_raffle_id and point_number in (3, 7, 12);

  insert into public.raffle_sale_points (sale_id, point_id)
  select v_buyer_id, id from public.raffle_points
  where raffle_id = v_raffle_id and point_number in (3, 7, 12);

  insert into public.financial_transactions (
    type, description, category_id, amount_cents, occurred_on, responsible_id, payment_method_id, created_by, origin
  )
  select
    'INCOME', 'Patrocínio — Ótica Visão Clara',
    (select id from public.financial_categories where kind = 'INCOME' and name = 'Patrocínio'),
    50000, current_date - 40, v_admin_id, v_pix_id, v_admin_id, 'Dados de demonstração (seed)'
  union all
  select
    'EXPENSE', 'Sinal do buffet para a formatura',
    (select id from public.financial_categories where kind = 'EXPENSE' and name = 'Buffet'),
    80000, current_date - 20, v_admin_id, v_pix_id, v_admin_id, 'Dados de demonstração (seed)';
end $$;
