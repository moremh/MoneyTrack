-- ============================================================
-- MONEYTRACK
-- 008 - Sincronización segura de transacciones offline
-- ============================================================


-- ============================================================
-- 1. IDENTIFICADOR ÚNICO DEL MOVIMIENTO CREADO EN EL DISPOSITIVO
-- ============================================================

alter table public.transactions
add column if not exists
  client_mutation_id uuid;


-- Un mismo movimiento offline no puede sincronizarse
-- dos veces para el mismo usuario.

create unique index if not exists
  transactions_user_client_mutation_unique
on public.transactions (
  user_id,
  client_mutation_id
)
where client_mutation_id is not null;


-- ============================================================
-- 2. FUNCIÓN PARA CREAR / SINCRONIZAR UN MOVIMIENTO OFFLINE
-- ============================================================

create or replace function
public.sync_offline_transaction_create(
  p_client_mutation_id uuid,
  p_type text,
  p_description text,
  p_amount numeric,
  p_category_id uuid default null,
  p_category_name text default 'General',
  p_date date default null
)
returns public.transactions
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid;

  v_existing_transaction
    public.transactions;

  v_new_transaction
    public.transactions;

  v_local_today date;
begin

  -- ----------------------------------------------------------
  -- Usuario autenticado
  -- ----------------------------------------------------------

  v_user_id := auth.uid();

  if v_user_id is null then
    raise exception
      using
        errcode = '42501',
        message = 'AUTHENTICATION_REQUIRED';
  end if;


  -- ----------------------------------------------------------
  -- Fecha local de Argentina
  -- ----------------------------------------------------------

  v_local_today :=
    (
      now()
      at time zone
      'America/Argentina/Buenos_Aires'
    )::date;


  -- ----------------------------------------------------------
  -- Validaciones
  -- ----------------------------------------------------------

  if p_client_mutation_id is null then
    raise exception
      using
        errcode = '22023',
        message = 'CLIENT_MUTATION_ID_REQUIRED';
  end if;


  if p_type not in (
    'income',
    'expense'
  ) then
    raise exception
      using
        errcode = '22023',
        message = 'INVALID_TRANSACTION_TYPE';
  end if;


  if
    p_description is null
    or trim(p_description) = ''
  then
    raise exception
      using
        errcode = '22023',
        message =
          'INVALID_TRANSACTION_DESCRIPTION';
  end if;


  if
    p_amount is null
    or p_amount <= 0
  then
    raise exception
      using
        errcode = '22023',
        message =
          'INVALID_TRANSACTION_AMOUNT';
  end if;


  if p_date is null then
    raise exception
      using
        errcode = '22023',
        message =
          'INVALID_TRANSACTION_DATE';
  end if;


  if p_date > v_local_today then
    raise exception
      using
        errcode = '22023',
        message =
          'FUTURE_TRANSACTION_DATE';
  end if;


  -- ----------------------------------------------------------
  -- IDEMPOTENCIA
  --
  -- Si MoneyTrack ya sincronizó este movimiento antes,
  -- simplemente devolvemos el registro existente.
  --
  -- Esto evita duplicados si:
  --
  -- 1. Supabase recibe el INSERT.
  -- 2. Se corta internet antes de recibir la respuesta.
  -- 3. La app vuelve a intentar sincronizarlo.
  -- ----------------------------------------------------------

  select *
  into v_existing_transaction
  from public.transactions
  where
    user_id = v_user_id
    and client_mutation_id =
      p_client_mutation_id;

  if found then
    return v_existing_transaction;
  end if;


  -- ----------------------------------------------------------
  -- CREAR EL MOVIMIENTO
  -- ----------------------------------------------------------

  begin

    insert into public.transactions (
      user_id,
      type,
      description,
      amount,
      category_id,
      category_name,
      date,
      client_mutation_id
    )
    values (
      v_user_id,

      p_type,

      trim(
        p_description
      ),

      p_amount,

      p_category_id,

      coalesce(
        nullif(
          trim(
            p_category_name
          ),
          ''
        ),
        'General'
      ),

      p_date,

      p_client_mutation_id
    )
    returning *
    into v_new_transaction;


    return v_new_transaction;


  exception

    when unique_violation then

      /*
       * Si dos intentos llegan prácticamente
       * al mismo tiempo, el índice UNIQUE
       * evita crear dos registros.
       *
       * Recuperamos el que ya existe.
       */

      select *
      into v_existing_transaction
      from public.transactions
      where
        user_id = v_user_id
        and client_mutation_id =
          p_client_mutation_id;

      if found then
        return v_existing_transaction;
      end if;


      raise;

  end;

end;
$$;


-- ============================================================
-- 3. PERMISOS
-- ============================================================

revoke all
on function
public.sync_offline_transaction_create(
  uuid,
  text,
  text,
  numeric,
  uuid,
  text,
  date
)
from public;


grant execute
on function
public.sync_offline_transaction_create(
  uuid,
  text,
  text,
  numeric,
  uuid,
  text,
  date
)
to authenticated;