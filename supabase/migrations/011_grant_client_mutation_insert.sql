-- ============================================================
-- MONEYTRACK
-- 011 - Permitir client_mutation_id en INSERT de transactions
-- ============================================================

grant insert (
  client_mutation_id
)
on public.transactions
to authenticated;