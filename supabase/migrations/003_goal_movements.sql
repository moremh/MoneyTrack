-- ============================================================
-- MONEYTRACK
-- Historial de movimientos de ahorro
-- ============================================================

create table if not exists public.goal_movements (
  id uuid primary key default gen_random_uuid(),

  user_id uuid not null
    references auth.users(id)
    on delete cascade,

  goal_id uuid not null
    references public.goals(id)
    on delete cascade,

  type text not null
    check (
      type in (
        'deposit',
        'withdrawal'
      )
    ),

  amount numeric(14, 2) not null
    check (amount > 0),

  description text,

  date date not null,

  created_at timestamptz not null
    default now()
);

create index if not exists
  goal_movements_user_id_idx
on public.goal_movements(user_id);

create index if not exists
  goal_movements_goal_id_idx
on public.goal_movements(goal_id);

create index if not exists
  goal_movements_date_idx
on public.goal_movements(date desc);

-- ============================================================
-- RLS
-- ============================================================

alter table public.goal_movements
enable row level security;

drop policy if exists
  "Users can read own goal movements"
on public.goal_movements;

create policy
  "Users can read own goal movements"
on public.goal_movements
for select
to authenticated
using (
  auth.uid() = user_id
);

-- No damos INSERT/UPDATE/DELETE directo.
-- Los movimientos se crean mediante una función RPC para que
-- actualizar el objetivo y guardar el historial sea atómico.

-- ============================================================
-- FUNCIÓN PARA REGISTRAR UN MOVIMIENTO DE AHORRO
-- ============================================================

create or replace function public.record_goal_movement(
  p_goal_id uuid,
  p_type text,
  p_amount numeric,
  p_description text default null,
  p_date date default current_date
)
returns public.goal_movements
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid;
  v_goal public.goals;
  v_new_amount numeric;
  v_movement public.goal_movements;
begin
  v_user_id := auth.uid();

  if v_user_id is null then
    raise exception 'NOT_AUTHENTICATED';
  end if;

  if p_type not in (
    'deposit',
    'withdrawal'
  ) then
    raise exception 'INVALID_GOAL_MOVEMENT_TYPE';
  end if;

  if p_amount is null
    or p_amount <= 0 then
    raise exception 'INVALID_GOAL_MOVEMENT_AMOUNT';
  end if;

  if p_date is null then
    raise exception 'INVALID_GOAL_MOVEMENT_DATE';
  end if;

  select *
  into v_goal
  from public.goals
  where id = p_goal_id
    and user_id = v_user_id
  for update;

  if not found then
    raise exception 'GOAL_NOT_FOUND';
  end if;

  if p_type = 'deposit' then
    v_new_amount :=
      coalesce(
        v_goal.current_amount,
        0
      )
      + p_amount;
  else
    if p_amount >
      coalesce(
        v_goal.current_amount,
        0
      )
    then
      raise exception
        'INSUFFICIENT_GOAL_BALANCE';
    end if;

    v_new_amount :=
      coalesce(
        v_goal.current_amount,
        0
      )
      - p_amount;
  end if;

  update public.goals
  set
    current_amount =
      v_new_amount,

    status =
      case
        when
          v_new_amount >=
          v_goal.target_amount
        then 'completed'
        else 'active'
      end,

    updated_at = now()
  where id = v_goal.id;

  insert into public.goal_movements (
    user_id,
    goal_id,
    type,
    amount,
    description,
    date
  )
  values (
    v_user_id,
    v_goal.id,
    p_type,
    p_amount,
    nullif(
      trim(
        coalesce(
          p_description,
          ''
        )
      ),
      ''
    ),
    p_date
  )
  returning *
  into v_movement;

  return v_movement;
end;
$$;

revoke all
on function public.record_goal_movement(
  uuid,
  text,
  numeric,
  text,
  date
)
from public;

grant execute
on function public.record_goal_movement(
  uuid,
  text,
  numeric,
  text,
  date
)
to authenticated;

-- ============================================================
-- MIGRAR LOS AHORROS QUE YA EXISTEN
-- ============================================================

insert into public.goal_movements (
  user_id,
  goal_id,
  type,
  amount,
  description,
  date,
  created_at
)
select
  g.user_id,
  g.id,
  'deposit',
  g.current_amount,
  'Saldo inicial del objetivo',
  coalesce(
    g.created_at::date,
    current_date
  ),
  coalesce(
    g.created_at,
    now()
  )
from public.goals g
where
  coalesce(
    g.current_amount,
    0
  ) > 0
  and not exists (
    select 1
    from public.goal_movements gm
    where gm.goal_id = g.id
  );