-- ============================================================
-- MONEYTRACK
-- Editar y eliminar movimientos de ahorro
-- ============================================================

-- ============================================================
-- EDITAR MOVIMIENTO
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

  -- ==========================================================
  -- MISMO OBJETIVO
  -- ==========================================================

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

  -- ==========================================================
  -- CAMBIO DE OBJETIVO
  -- ==========================================================

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

    date = p_date
  where id = v_old_movement.id
    and user_id = v_user_id

  returning *
  into v_result;

  return v_result;
end;
$$;


-- ============================================================
-- ELIMINAR MOVIMIENTO
-- ============================================================

create or replace function public.delete_goal_movement(
  p_movement_id uuid
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

  if not found then
    raise exception
      'GOAL_MOVEMENT_NOT_FOUND';
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
-- PERMISOS
-- ============================================================

revoke all
on function public.update_goal_movement(
  uuid,
  uuid,
  text,
  numeric,
  text,
  date
)
from public;

grant execute
on function public.update_goal_movement(
  uuid,
  uuid,
  text,
  numeric,
  text,
  date
)
to authenticated;


revoke all
on function public.delete_goal_movement(
  uuid
)
from public;

grant execute
on function public.delete_goal_movement(
  uuid
)
to authenticated;