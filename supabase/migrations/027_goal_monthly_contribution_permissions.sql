-- Permite que los usuarios autenticados guarden y editen su aporte mensual.
-- Conserva la política RLS existente: cada usuario solo puede modificar
-- sus propios objetivos. No modifica ni elimina ahorros o datos existentes.
-- La migración 026 debe haberse aplicado antes de ejecutar esta.

BEGIN;

GRANT INSERT (monthly_contribution)
ON TABLE public.goals
TO authenticated;

GRANT UPDATE (monthly_contribution)
ON TABLE public.goals
TO authenticated;

COMMIT;
