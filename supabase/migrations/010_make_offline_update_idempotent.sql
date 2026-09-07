-- ============================================================
-- MONEYTRACK
-- 010 - UPDATE offline idempotente
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

  v_category_name text;
begin

  -- ==========================================================
  -- USUARIO
  -- ==========================================================

  v_user_id := auth.uid();

  if v_user_id is null then
    raise exception
      using
        errcode = '42501',
        message =
          'AUTHENTICATION_REQUIRED';
  end if;


  -- ==========================================================
  -- FECHA LOCAL ARGENTINA
  -- ==========================================================

  v_local_today :=
    (
      now()
      at time zone
      'America/Argentina/Buenos_Aires'
    )::date;


  -- ==========================================================
  -- NORMALIZAR CATEGORÍA
  -- ==========================================================

  v_category_name :=
    coalesce(
      nullif(
        trim(
          p_category_name
        ),
        ''
      ),
      'General'
    );


  -- ==========================================================
  -- VALIDACIONES
  -- ==========================================================

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


  -- ==========================================================
  -- OBTENER TRANSACCIÓN ACTUAL
  -- ==========================================================

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


  -- ==========================================================
  -- CONTROL DE CONFLICTOS + IDEMPOTENCIA
  -- ==========================================================

  if
    p_expected_updated_at
      is not null
    and
    v_existing_transaction.updated_at
      is distinct from
      p_expected_updated_at
  then

    /*
     * El updated_at cambió.
     *
     * Antes de considerarlo conflicto comprobamos
     * si el servidor YA contiene exactamente los
     * datos que intentábamos sincronizar.
     *
     * Esto puede pasar así:
     *
     * 1. MoneyTrack manda el UPDATE.
     * 2. Supabase lo guarda.
     * 3. Se corta internet antes de recibir respuesta.
     * 4. MoneyTrack vuelve a intentarlo.
     *
     * En ese caso no hay conflicto real.
     */

    if
      v_existing_transaction.type =
        p_type

      and
      v_existing_transaction.description =
        trim(
          p_description
        )

      and
      v_existing_transaction.amount =
        p_amount

      and
      v_existing_transaction.category_id
        is not distinct from
        p_category_id

      and
      v_existing_transaction.category_name =
        v_category_name

      and
      v_existing_transaction.date =
        p_date

    then

      return
        v_existing_transaction;

    end if;


    /*
     * Si los datos NO coinciden,
     * otro dispositivo o sesión modificó
     * realmente la transacción.
     */

    raise exception
      using
        errcode = 'P0001',
        message =
          'OFFLINE_TRANSACTION_CONFLICT',
        detail =
          'La transacción fue modificada en el servidor después de la última copia local.';

  end if;


  -- ==========================================================
  -- ACTUALIZAR
  -- ==========================================================

  update public.transactions
  set
    type =
      p_type,

    description =
      trim(
        p_description
      ),

    amount =
      p_amount,

    category_id =
      p_category_id,

    category_name =
      v_category_name,

    date =
      p_date

  where
    id =
      p_transaction_id

    and user_id =
      v_user_id

  returning *
  into v_updated_transaction;


  return
    v_updated_transaction;

end;
$$;


-- ============================================================
-- PERMISOS
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