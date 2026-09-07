-- ============================================================
-- MONEYTRACK
-- 009 - Edición y eliminación offline de transacciones
-- ============================================================


-- ============================================================
-- 1. ACTUALIZAR UNA TRANSACCIÓN SINCRONIZADA DESDE OFFLINE
-- ============================================================

create or replace function
public.sync_offline_transaction_update(
  p_transaction_id uuid,
  p_type text,
  p_description text,
  p_amount numeric,
  p_category_id uuid default null,
  p_category_name text default 'General',
  p_date date default null,
  p_expected_updated_at timestamptz default null
)
returns public.transactions
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid;

  v_existing_transaction
    public.transactions;

  v_updated_transaction
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
        message =
          'AUTHENTICATION_REQUIRED';
  end if;


  -- ----------------------------------------------------------
  -- Fecha actual de Argentina
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

  if p_transaction_id is null then
    raise exception
      using
        errcode = '22023',
        message =
          'TRANSACTION_ID_REQUIRED';
  end if;


  if p_type not in (
    'income',
    'expense'
  ) then
    raise exception
      using
        errcode = '22023',
        message =
          'INVALID_TRANSACTION_TYPE';
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
  -- OBTENER Y BLOQUEAR LA VERSIÓN ACTUAL
  -- ----------------------------------------------------------

  select *
  into v_existing_transaction
  from public.transactions
  where
    id = p_transaction_id
    and user_id = v_user_id
  for update;


  if not found then
    raise exception
      using
        errcode = 'P0001',
        message =
          'TRANSACTION_NOT_FOUND';
  end if;


  -- ----------------------------------------------------------
  -- CONTROL DE CONFLICTOS
  --
  -- Si el movimiento fue modificado desde
  -- otro dispositivo después de que quedó
  -- guardado en el caché offline, NO lo
  -- sobrescribimos silenciosamente.
  -- ----------------------------------------------------------

  if
    p_expected_updated_at
      is not null
    and
    v_existing_transaction.updated_at
      is distinct from
      p_expected_updated_at
  then
    raise exception
      using
        errcode = 'P0001',
        message =
          'OFFLINE_TRANSACTION_CONFLICT',
        detail =
          'La transacción fue modificada en el servidor después de la última copia local.';
  end if;


  -- ----------------------------------------------------------
  -- ACTUALIZAR
  -- ----------------------------------------------------------

  update public.transactions
  set
    type = p_type,

    description =
      trim(p_description),

    amount =
      p_amount,

    category_id =
      p_category_id,

    category_name =
      coalesce(
        nullif(
          trim(
            p_category_name
          ),
          ''
        ),
        'General'
      ),

    date =
      p_date

  where
    id = p_transaction_id
    and user_id = v_user_id

  returning *
  into v_updated_transaction;


  return v_updated_transaction;

end;
$$;


-- ============================================================
-- 2. ELIMINAR UNA TRANSACCIÓN DESDE OFFLINE
-- ============================================================

create or replace function
public.sync_offline_transaction_delete(
  p_transaction_id uuid,
  p_expected_updated_at timestamptz default null
)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid;

  v_existing_transaction
    public.transactions;
begin

  v_user_id := auth.uid();


  if v_user_id is null then
    raise exception
      using
        errcode = '42501',
        message =
          'AUTHENTICATION_REQUIRED';
  end if;


  if p_transaction_id is null then
    raise exception
      using
        errcode = '22023',
        message =
          'TRANSACTION_ID_REQUIRED';
  end if;


  -- ----------------------------------------------------------
  -- Buscar la transacción del usuario.
  -- ----------------------------------------------------------

  select *
  into v_existing_transaction
  from public.transactions
  where
    id = p_transaction_id
    and user_id = v_user_id
  for update;


  /*
   * Si ya no existe, consideramos la
   * eliminación como exitosa.
   *
   * Esto vuelve el DELETE idempotente:
   * reintentarlo nunca provoca problemas.
   */

  if not found then
    return true;
  end if;


  -- ----------------------------------------------------------
  -- CONTROL DE CONFLICTOS
  -- ----------------------------------------------------------

  if
    p_expected_updated_at
      is not null
    and
    v_existing_transaction.updated_at
      is distinct from
      p_expected_updated_at
  then
    raise exception
      using
        errcode = 'P0001',
        message =
          'OFFLINE_TRANSACTION_CONFLICT',
        detail =
          'La transacción fue modificada en el servidor después de la última copia local.';
  end if;


  -- ----------------------------------------------------------
  -- ELIMINAR
  -- ----------------------------------------------------------

  delete from public.transactions
  where
    id = p_transaction_id
    and user_id = v_user_id;


  return true;

end;
$$;


-- ============================================================
-- 3. PERMISOS
-- ============================================================

revoke all
on function
public.sync_offline_transaction_update(
  uuid,
  text,
  text,
  numeric,
  uuid,
  text,
  date,
  timestamptz
)
from public;


grant execute
on function
public.sync_offline_transaction_update(
  uuid,
  text,
  text,
  numeric,
  uuid,
  text,
  date,
  timestamptz
)
to authenticated;


revoke all
on function
public.sync_offline_transaction_delete(
  uuid,
  timestamptz
)
from public;


grant execute
on function
public.sync_offline_transaction_delete(
  uuid,
  timestamptz
)
to authenticated;