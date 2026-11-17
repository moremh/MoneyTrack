-- MoneyTrack: mantener opcional la cuenta de préstamos y devoluciones.
-- Complemento de 031_debt_initial_transactions.sql, ya ejecutada.
-- No modifica datos ni recalcula movimientos existentes.
-- Requiere el esquema 031 en la base de datos correcta y respaldo previo.
BEGIN;

DO $$
BEGIN
  IF to_regprocedure('public.create_debt_with_initial_transaction(uuid,jsonb,uuid)') IS NULL
     OR to_regclass('public.debts') IS NULL THEN
    RAISE EXCEPTION 'MIGRATION_031_REQUIRED';
  END IF;
END $$;

-- Permitir pasar de una cuenta asignada a "Sin cuenta" en un préstamo vinculado.
create or replace function public.guard_debt_initial_link()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  if old.initial_transaction_id is distinct from new.initial_transaction_id then
    if coalesce(current_setting('moneytrack.loan_link_write', true), '') <> 'allowed' then
      raise exception using errcode = '23514', message = 'LOAN_LINK_PROTECTED';
    end if;
  end if;

  if new.initial_transaction_id is not null then
    -- Una cuenta borrada por la migración 028 deja movimientos sin cuenta.
    -- No impedir esa eliminación ni el mantenimiento de la deuda histórica.
    if new.initial_account_id is not null and not exists (
      select 1 from public.accounts a
      where a.id = new.initial_account_id and a.user_id = new.user_id
    ) then
      raise exception using errcode = '42501', message = 'LOAN_ACCOUNT_NOT_OWNED';
    end if;
    if not exists (
      select 1 from public.transactions t
      where t.id = new.initial_transaction_id and t.user_id = new.user_id
    ) then
      raise exception using errcode = '42501', message = 'LOAN_TRANSACTION_NOT_OWNED';
    end if;
  end if;
  return new;
end;
$$;

-- Permitir crear ingreso/gasto vinculado SIN cuenta, sin perder idempotencia.
create or replace function public.create_debt_with_initial_transaction(
  p_request_id uuid,
  p_payload jsonb,
  p_account_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_existing public.debts%rowtype;
  v_transaction_id uuid;
  v_direction text;
  v_type text;
  v_category text;
  v_category_id uuid;
  v_amount numeric(14,2);
  v_person text;
  v_concept text;
  v_date date;
begin
  if v_uid is null or not public.is_active_user() then
    raise exception using errcode = '42501', message = 'NOT_AUTHENTICATED';
  end if;
  if p_request_id is null or p_payload is null then
    raise exception using errcode = '22023', message = 'INVALID_LOAN_REQUEST';
  end if;

  v_direction := p_payload->>'direction';
  v_amount := (p_payload->>'original_amount')::numeric;
  v_person := nullif(trim(p_payload->>'person_name'), '');
  v_concept := nullif(trim(p_payload->>'concept'), '');
  v_date := (p_payload->>'debt_date')::date;
  if v_direction not in ('receivable', 'payable')
     or v_amount is null or v_amount <= 0 or v_amount <> round(v_amount, 2)
     or v_person is null or v_concept is null or v_date is null then
    raise exception using errcode = '22023', message = 'INVALID_LOAN_REQUEST';
  end if;
  if p_account_id is not null and not exists (
    select 1 from public.accounts a
    where a.id = p_account_id and a.user_id = v_uid and a.is_active = true
  ) then
    raise exception using errcode = '42501', message = 'LOAN_ACCOUNT_NOT_AVAILABLE';
  end if;

  -- Idempotencia segura: el mismo identificador no puede reutilizarse con otros datos.
  select * into v_existing from public.debts
  where id = p_request_id for update;
  if found then
    if v_existing.user_id = v_uid
       and v_existing.initial_transaction_id is not null
       and v_existing.initial_account_id = p_account_id
       and v_existing.direction = v_direction
       and v_existing.original_amount = v_amount
       and v_existing.debt_date = v_date
       and v_existing.person_name = v_person
       and v_existing.concept = v_concept then
      return jsonb_build_object('id', v_existing.id, 'replayed', true);
    end if;
    raise exception using errcode = '23505', message = 'LOAN_REQUEST_ALREADY_USED';
  end if;

  insert into public.debts (
    id, user_id, direction, payment_mode, person_name, concept, original_amount,
    currency, debt_date, due_date, installment_count, first_installment_date,
    installment_end_date, notes, reminder_offsets, reminder_time, timezone,
    initial_account_id
  ) values (
    p_request_id, v_uid, v_direction,
    coalesce(nullif(p_payload->>'payment_mode',''),'flexible'),
    v_person, v_concept, v_amount,
    coalesce(nullif(p_payload->>'currency',''),'ARS'), v_date,
    nullif(p_payload->>'due_date','')::date,
    nullif(p_payload->>'installment_count','')::integer,
    nullif(p_payload->>'first_installment_date','')::date,
    nullif(p_payload->>'installment_end_date','')::date,
    nullif(p_payload->>'notes',''),
    array(select val::smallint from jsonb_array_elements_text(
      coalesce(p_payload->'reminder_offsets','[0]'::jsonb)) as t(val)),
    coalesce(nullif(p_payload->>'reminder_time','')::time, time '09:00'),
    coalesce(nullif(p_payload->>'timezone',''),'America/Argentina/Buenos_Aires'),
    p_account_id
  );

  v_type := case when v_direction = 'payable' then 'income' else 'expense' end;
  v_category := case when v_direction = 'payable' then 'Préstamo recibido' else 'Préstamo otorgado' end;
  select c.id into v_category_id from public.categories c
  where c.user_id = v_uid and c.type = v_type
    and lower(c.name) = lower(v_category) limit 1;

  insert into public.transactions (
    user_id, type, description, amount, category_id, category_name, account_id, date
  ) values (
    v_uid, v_type,
    left(v_category || ': ' || v_concept || ' - ' || v_person, 200),
    v_amount, v_category_id, v_category, p_account_id, v_date
  ) returning id into v_transaction_id;

  perform set_config('moneytrack.loan_link_write', 'allowed', true);
  update public.debts set initial_transaction_id = v_transaction_id
  where id = p_request_id and user_id = v_uid;
  perform set_config('moneytrack.loan_link_write', '', true);

  return jsonb_build_object(
    'id', p_request_id, 'transaction_id', v_transaction_id, 'replayed', false
  );
end;
$$;

-- Conserva los permisos previos de la función RPC.
REVOKE ALL ON FUNCTION public.create_debt_with_initial_transaction(uuid,jsonb,uuid)
  FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.create_debt_with_initial_transaction(uuid,jsonb,uuid)
  TO authenticated;

COMMIT;
