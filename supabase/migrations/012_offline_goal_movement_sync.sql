-- ============================================================
-- MONEYTRACK
-- 012 - Sincronización offline de movimientos de ahorro
-- ============================================================

-- ============================================================
-- 1. CAMPOS DE SINCRONIZACIÓN
-- ============================================================

alter table public.goal_movements
  add column if not exists client_mutation_id uuid;

alter table public.goal_movements
  add column if not exists updated_at timestamptz;

update public.goal_movements
set updated_at = coalesce(updated_at, created_at, now())
where updated_at is null;

alter table public.goal_movements
  alter column updated_at set default now();

alter table public.goal_movements
  alter column updated_at set not null;

create unique index if not exists
  goal_movements_user_client_mutation_id_uidx
on public.goal_movements (
  user_id,
  client_mutation_id
)
where client_mutation_id is not null;


-- ============================================================
-- 2. ASEGURAR updated_at EN EDICIONES ONLINE
-- ============================================================

create or replace function public.update_goal_movement(
  p_movement_id uuid,
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
  v_old_movement public.goal_movements;
  v_old_goal public.goals;
  v_new_goal public.goals;

  v_old_effect numeric;
  v_new_effect numeric;

  v_old_goal_amount numeric;
  v_new_goal_amount numeric;

  v_result public.goal_movements;
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
  into v_old_movement
  from public.goal_movements
  where id = p_movement_id
    and user_id = v_user_id
  for update;

  if not found then
    raise exception 'GOAL_MOVEMENT_NOT_FOUND';
  end if;

  select *
  into v_old_goal
  from public.goals
  where id = v_old_movement.goal_id
    and user_id = v_user_id
  for update;

  if not found then
    raise exception 'GOAL_NOT_FOUND';
  end if;

  if p_goal_id = v_old_movement.goal_id then
    v_new_goal := v_old_goal;
  else
    select *
    into v_new_goal
    from public.goals
    where id = p_goal_id
      and user_id = v_user_id
    for update;

    if not found then
      raise exception 'GOAL_NOT_FOUND';
    end if;
  end if;

  v_old_effect :=
    case
      when v_old_movement.type = 'deposit'
        then v_old_movement.amount
      else -v_old_movement.amount
    end;

  v_new_effect :=
    case
      when p_type = 'deposit'
        then p_amount
      else -p_amount
    end;

  if p_goal_id = v_old_movement.goal_id then
    v_new_goal_amount :=
      coalesce(
        v_old_goal.current_amount,
        0
      )
      - v_old_effect
      + v_new_effect;

    if v_new_goal_amount < 0 then
      raise exception
        'INSUFFICIENT_GOAL_BALANCE';
    end if;

    update public.goals
    set
      current_amount =
        v_new_goal_amount,

      status =
        case
          when
            v_new_goal_amount >=
            target_amount
          then 'completed'
          else 'active'
        end,

      updated_at = now()
    where id = v_old_goal.id;

  else
    v_old_goal_amount :=
      coalesce(
        v_old_goal.current_amount,
        0
      )
      - v_old_effect;

    if v_old_goal_amount < 0 then
      raise exception
        'INSUFFICIENT_GOAL_BALANCE';
    end if;

    v_new_goal_amount :=
      coalesce(
        v_new_goal.current_amount,
        0
      )
      + v_new_effect;

    if v_new_goal_amount < 0 then
      raise exception
        'INSUFFICIENT_GOAL_BALANCE';
    end if;

    update public.goals
    set
      current_amount =
        v_old_goal_amount,

      status =
        case
          when
            v_old_goal_amount >=
            target_amount
          then 'completed'
          else 'active'
        end,

      updated_at = now()
    where id = v_old_goal.id;

    update public.goals
    set
      current_amount =
        v_new_goal_amount,

      status =
        case
          when
            v_new_goal_amount >=
            target_amount
          then 'completed'
          else 'active'
        end,

      updated_at = now()
    where id = v_new_goal.id;
  end if;

  update public.goal_movements
  set
    goal_id = p_goal_id,
    type = p_type,
    amount = p_amount,

    description =
      nullif(
        trim(
          coalesce(
            p_description,
            ''
          )
        ),
        ''
      ),

    date = p_date,
    updated_at = now()
  where id = v_old_movement.id
    and user_id = v_user_id

  returning *
  into v_result;

  return v_result;
end;
$$;


-- ============================================================
-- 3. CREATE OFFLINE IDEMPOTENTE
-- ============================================================

create or replace function public.sync_offline_goal_movement_create(
  p_client_mutation_id uuid,
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
  v_existing public.goal_movements;
  v_goal public.goals;
  v_new_amount numeric;
  v_movement public.goal_movements;
begin
  v_user_id := auth.uid();

  if v_user_id is null then
    raise exception 'NOT_AUTHENTICATED';
  end if;

  if p_client_mutation_id is null then
    raise exception 'INVALID_CLIENT_MUTATION_ID';
  end if;

  select *
  into v_existing
  from public.goal_movements
  where user_id = v_user_id
    and client_mutation_id =
      p_client_mutation_id
  limit 1;

  if found then
    return v_existing;
  end if;

  if p_type not in (
    'deposit',
    'withdrawal'
  ) then
    raise exception
      'INVALID_GOAL_MOVEMENT_TYPE';
  end if;

  if p_amount is null
    or p_amount <= 0 then
    raise exception
      'INVALID_GOAL_MOVEMENT_AMOUNT';
  end if;

  if p_date is null then
    raise exception
      'INVALID_GOAL_MOVEMENT_DATE';
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
    date,
    client_mutation_id,
    updated_at
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
    p_date,
    p_client_mutation_id,
    now()
  )
  returning *
  into v_movement;

  return v_movement;

exception
  when unique_violation then
    select *
    into v_existing
    from public.goal_movements
    where user_id = v_user_id
      and client_mutation_id =
        p_client_mutation_id
    limit 1;

    if found then
      return v_existing;
    end if;

    raise;
end;
$$;


-- ============================================================
-- 4. UPDATE OFFLINE CON CONTROL DE CONFLICTOS
-- ============================================================

create or replace function public.sync_offline_goal_movement_update(
  p_movement_id uuid,
  p_goal_id uuid,
  p_type text,
  p_amount numeric,
  p_description text default null,
  p_date date default current_date,
  p_expected_updated_at timestamptz default null
)
returns public.goal_movements
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid;
  v_old_movement public.goal_movements;
  v_old_goal public.goals;
  v_new_goal public.goals;

  v_old_effect numeric;
  v_new_effect numeric;

  v_old_goal_amount numeric;
  v_new_goal_amount numeric;

  v_normalized_description text;
  v_result public.goal_movements;
begin
  v_user_id := auth.uid();

  if v_user_id is null then
    raise exception 'NOT_AUTHENTICATED';
  end if;

  if p_type not in (
    'deposit',
    'withdrawal'
  ) then
    raise exception
      'INVALID_GOAL_MOVEMENT_TYPE';
  end if;

  if p_amount is null
    or p_amount <= 0 then
    raise exception
      'INVALID_GOAL_MOVEMENT_AMOUNT';
  end if;

  if p_date is null then
    raise exception
      'INVALID_GOAL_MOVEMENT_DATE';
  end if;

  v_normalized_description :=
    nullif(
      trim(
        coalesce(
          p_description,
          ''
        )
      ),
      ''
    );

  select *
  into v_old_movement
  from public.goal_movements
  where id = p_movement_id
    and user_id = v_user_id
  for update;

  if not found then
    raise exception
      'GOAL_MOVEMENT_NOT_FOUND';
  end if;

  if
    p_expected_updated_at is not null
    and
    v_old_movement.updated_at is distinct from
      p_expected_updated_at
  then
    -- Si el servidor ya contiene exactamente
    -- la versión que queríamos guardar, el
    -- reintento es idempotente.
    if
      v_old_movement.goal_id = p_goal_id
      and v_old_movement.type = p_type
      and v_old_movement.amount = p_amount
      and v_old_movement.description
        is not distinct from
        v_normalized_description
      and v_old_movement.date = p_date
    then
      return v_old_movement;
    end if;

    raise exception
      'OFFLINE_GOAL_MOVEMENT_CONFLICT';
  end if;

  select *
  into v_old_goal
  from public.goals
  where id = v_old_movement.goal_id
    and user_id = v_user_id
  for update;

  if not found then
    raise exception 'GOAL_NOT_FOUND';
  end if;

  if p_goal_id = v_old_movement.goal_id then
    v_new_goal := v_old_goal;
  else
    select *
    into v_new_goal
    from public.goals
    where id = p_goal_id
      and user_id = v_user_id
    for update;

    if not found then
      raise exception 'GOAL_NOT_FOUND';
    end if;
  end if;

  v_old_effect :=
    case
      when v_old_movement.type = 'deposit'
        then v_old_movement.amount
      else -v_old_movement.amount
    end;

  v_new_effect :=
    case
      when p_type = 'deposit'
        then p_amount
      else -p_amount
    end;

  if p_goal_id = v_old_movement.goal_id then
    v_new_goal_amount :=
      coalesce(
        v_old_goal.current_amount,
        0
      )
      - v_old_effect
      + v_new_effect;

    if v_new_goal_amount < 0 then
      raise exception
        'INSUFFICIENT_GOAL_BALANCE';
    end if;

    update public.goals
    set
      current_amount =
        v_new_goal_amount,

      status =
        case
          when
            v_new_goal_amount >=
            target_amount
          then 'completed'
          else 'active'
        end,

      updated_at = now()
    where id = v_old_goal.id;

  else
    v_old_goal_amount :=
      coalesce(
        v_old_goal.current_amount,
        0
      )
      - v_old_effect;

    if v_old_goal_amount < 0 then
      raise exception
        'INSUFFICIENT_GOAL_BALANCE';
    end if;

    v_new_goal_amount :=
      coalesce(
        v_new_goal.current_amount,
        0
      )
      + v_new_effect;

    if v_new_goal_amount < 0 then
      raise exception
        'INSUFFICIENT_GOAL_BALANCE';
    end if;

    update public.goals
    set
      current_amount =
        v_old_goal_amount,

      status =
        case
          when
            v_old_goal_amount >=
            target_amount
          then 'completed'
          else 'active'
        end,

      updated_at = now()
    where id = v_old_goal.id;

    update public.goals
    set
      current_amount =
        v_new_goal_amount,

      status =
        case
          when
            v_new_goal_amount >=
            target_amount
          then 'completed'
          else 'active'
        end,

      updated_at = now()
    where id = v_new_goal.id;
  end if;

  update public.goal_movements
  set
    goal_id = p_goal_id,
    type = p_type,
    amount = p_amount,
    description =
      v_normalized_description,
    date = p_date,
    updated_at = now()
  where id = v_old_movement.id
    and user_id = v_user_id

  returning *
  into v_result;

  return v_result;
end;
$$;


-- ============================================================
-- 5. DELETE OFFLINE IDEMPOTENTE + CONFLICTOS
-- ============================================================

create or replace function public.sync_offline_goal_movement_delete(
  p_movement_id uuid,
  p_expected_updated_at timestamptz default null
)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid;
  v_movement public.goal_movements;
  v_goal public.goals;
  v_effect numeric;
  v_new_amount numeric;
begin
  v_user_id := auth.uid();

  if v_user_id is null then
    raise exception 'NOT_AUTHENTICATED';
  end if;

  select *
  into v_movement
  from public.goal_movements
  where id = p_movement_id
    and user_id = v_user_id
  for update;

  -- DELETE idempotente:
  -- si ya desapareció, consideramos la
  -- operación completada.
  if not found then
    return true;
  end if;

  if
    p_expected_updated_at is not null
    and
    v_movement.updated_at is distinct from
      p_expected_updated_at
  then
    raise exception
      'OFFLINE_GOAL_MOVEMENT_CONFLICT';
  end if;

  select *
  into v_goal
  from public.goals
  where id = v_movement.goal_id
    and user_id = v_user_id
  for update;

  if not found then
    raise exception 'GOAL_NOT_FOUND';
  end if;

  v_effect :=
    case
      when v_movement.type = 'deposit'
        then v_movement.amount
      else -v_movement.amount
    end;

  v_new_amount :=
    coalesce(
      v_goal.current_amount,
      0
    )
    - v_effect;

  if v_new_amount < 0 then
    raise exception
      'INSUFFICIENT_GOAL_BALANCE';
  end if;

  update public.goals
  set
    current_amount =
      v_new_amount,

    status =
      case
        when
          v_new_amount >=
          target_amount
        then 'completed'
        else 'active'
      end,

    updated_at = now()
  where id = v_goal.id;

  delete from public.goal_movements
  where id = v_movement.id
    and user_id = v_user_id;

  return true;
end;
$$;


-- ============================================================
-- 6. PERMISOS
-- ============================================================

revoke all
on function public.sync_offline_goal_movement_create(
  uuid,
  uuid,
  text,
  numeric,
  text,
  date
)
from public;

grant execute
on function public.sync_offline_goal_movement_create(
  uuid,
  uuid,
  text,
  numeric,
  text,
  date
)
to authenticated;


revoke all
on function public.sync_offline_goal_movement_update(
  uuid,
  uuid,
  text,
  numeric,
  text,
  date,
  timestamptz
)
from public;

grant execute
on function public.sync_offline_goal_movement_update(
  uuid,
  uuid,
  text,
  numeric,
  text,
  date,
  timestamptz
)
to authenticated;


revoke all
on function public.sync_offline_goal_movement_delete(
  uuid,
  timestamptz
)
from public;

grant execute
on function public.sync_offline_goal_movement_delete(
  uuid,
  timestamptz
)
to authenticated;
