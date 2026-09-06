-- ============================================================
-- MONEYTRACK
-- Diferenciar saldos iniciales de movimientos reales de ahorro
-- ============================================================

alter table public.goal_movements
add column if not exists
  is_opening_balance boolean
  not null
  default false;

-- Los movimientos creados por la migración inicial
-- representan dinero que ya estaba ahorrado.
-- No deben afectar el flujo financiero del período.
update public.goal_movements
set is_opening_balance = true
where
  description = 'Saldo inicial del objetivo';