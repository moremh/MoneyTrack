-- Planificación alternativa para objetivos: fecha O aporte mensual.
-- No altera los objetivos existentes ni modifica los importes ahorrados.
alter table public.goals
  add column if not exists monthly_contribution numeric(14, 2);

alter table public.goals
  drop constraint if exists goals_monthly_contribution_positive;
alter table public.goals
  add constraint goals_monthly_contribution_positive
  check (monthly_contribution is null or monthly_contribution > 0);

alter table public.goals
  drop constraint if exists goals_only_one_planning_method;
alter table public.goals
  add constraint goals_only_one_planning_method
  check (deadline is null or monthly_contribution is null);

comment on column public.goals.monthly_contribution is
  'Aporte mensual planificado. Si se define, la fecha límite debe ser nula.';
