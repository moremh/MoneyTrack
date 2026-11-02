begin;

-- MoneyTrack · Cobros/Pagos (v2)
-- Los recargos son importes ya cobrados/pagados. NO amortizan capital
-- ni alteran el valor de las cuotas siguientes.
alter table public.debt_payments
  add column if not exists fee_amount numeric(14,2) not null default 0;

alter table public.debt_payments
  add column if not exists client_request_id uuid;

alter table public.debt_payments
  drop constraint if exists debt_payments_fee_amount_nonnegative;

alter table public.debt_payments
  add constraint debt_payments_fee_amount_nonnegative
  check (fee_amount >= 0);

create unique index if not exists debt_payments_request_unique
on public.debt_payments(user_id,client_request_id)
where client_request_id is not null;

-- Registrar el pago y el ingreso/gasto en la MISMA transacción de PostgreSQL.
-- Si falla cualquiera de los dos, ninguno queda grabado.
-- p_request_id permite repetir la misma solicitud sin pagos duplicados.
create or replace function public.register_debt_payment(
  p_debt_id uuid,
  p_installment_id uuid,
  p_amount numeric,
  p_fee_amount numeric,
  p_payment_date date,
  p_notes text,
  p_record_transaction boolean,
  p_category_name text,
  p_account_id uuid,
  p_request_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
  v_debt public.debts%rowtype;
  v_installment public.debt_installments%rowtype;
  v_old public.debt_payments%rowtype;
  v_payment_id uuid;
  v_transaction_id uuid;
  v_type text;
  v_category_name text;
  v_category_id uuid;
  v_amount numeric(14,2);
  v_fee numeric(14,2);
  v_total numeric(14,2);
begin
  if v_user_id is null or not public.is_active_user() then
    raise exception using errcode='42501', message='NOT_AUTHENTICATED';
  end if;

  if p_debt_id is null or p_request_id is null then
    raise exception using errcode='22023', message='INVALID_PAYMENT_REQUEST';
  end if;

  if p_amount is null or p_amount <= 0 or p_amount <> round(p_amount,2)
     or p_fee_amount is null or p_fee_amount < 0
     or p_fee_amount <> round(p_fee_amount,2) then
    raise exception using errcode='22023', message='INVALID_PAYMENT_AMOUNT';
  end if;

  if p_payment_date is null or p_payment_date > (now() at time zone 'America/Argentina/Buenos_Aires')::date then
    raise exception using errcode='22023', message='INVALID_PAYMENT_DATE';
  end if;

  if length(coalesce(p_notes,'')) > 1000 then
    raise exception using errcode='22023', message='NOTES_TOO_LONG';
  end if;

  v_amount := p_amount;
  v_fee := p_fee_amount;
  v_total := v_amount + v_fee;

  -- Un único bloqueo por deuda serializa pagos concurrentes, también de cuotas distintas.
  select * into v_debt
  from public.debts
  where id=p_debt_id and user_id=v_user_id
  for update;

  if not found then
    raise exception using errcode='42501', message='DEBT_NOT_FOUND_OR_NOT_OWNED';
  end if;

  select * into v_old
  from public.debt_payments
  where user_id=v_user_id and client_request_id=p_request_id;

  if found then
    if v_old.debt_id <> p_debt_id
       or v_old.installment_id is distinct from p_installment_id
       or v_old.amount <> v_amount
       or v_old.fee_amount <> v_fee
       or v_old.payment_date <> p_payment_date
       or ((v_old.transaction_id is not null) is distinct from coalesce(p_record_transaction,false))
       or coalesce(v_old.notes,'') <> trim(coalesce(p_notes,''))
    then
      raise exception using errcode='23505', message='PAYMENT_REQUEST_ALREADY_USED';
    end if;
    return jsonb_build_object(
      'payment_id',v_old.id,'transaction_id',v_old.transaction_id,
      'amount',v_old.amount,'fee_amount',v_old.fee_amount,
      'total',v_old.amount+v_old.fee_amount,'replayed',true
    );
  end if;

  if v_debt.status = 'cancelled' or v_debt.status = 'paid' then
    raise exception using errcode='23514', message='DEBT_NOT_PAYABLE';
  end if;

  if v_debt.payment_mode='installments' then
    if p_installment_id is null then
      raise exception using errcode='23514', message='INSTALLMENT_REQUIRED';
    end if;
    select * into v_installment
    from public.debt_installments
    where id=p_installment_id and debt_id=v_debt.id and user_id=v_user_id;
    if not found or v_installment.status='paid' then
      raise exception using errcode='23514', message='INSTALLMENT_NOT_AVAILABLE';
    end if;
    if v_amount > v_installment.amount_due - v_installment.paid_amount then
      raise exception using errcode='23514', message='DEBT_PAYMENT_EXCEEDS_INSTALLMENT_BALANCE';
    end if;
  elsif p_installment_id is not null then
    raise exception using errcode='22023', message='INSTALLMENT_NOT_ALLOWED';
  end if;

  if v_amount > v_debt.original_amount - v_debt.paid_amount then
    raise exception using errcode='23514', message='DEBT_PAYMENT_EXCEEDS_BALANCE';
  end if;

  if coalesce(p_record_transaction,false) and p_account_id is not null then
    if not exists(
      select 1 from public.accounts
      where id=p_account_id and user_id=v_user_id and is_active=true
    ) then
      raise exception using errcode='42501', message='ACCOUNT_NOT_AVAILABLE';
    end if;
  end if;

  insert into public.debt_payments(
    user_id, debt_id, installment_id, amount, fee_amount,
    payment_date, notes, client_request_id
  ) values (
    v_user_id, p_debt_id, p_installment_id, v_amount, v_fee,
    p_payment_date, nullif(trim(coalesce(p_notes,'')),''), p_request_id
  ) returning id into v_payment_id;

  if coalesce(p_record_transaction,false) then
    v_type := case when v_debt.direction='receivable' then 'income' else 'expense' end;
    v_category_name := coalesce(nullif(trim(coalesce(p_category_name,'')),''),'General');
    if length(v_category_name)>60 then
      raise exception using errcode='22023', message='INVALID_CATEGORY';
    end if;

    select id into v_category_id
    from public.categories
    where user_id=v_user_id and type=v_type and lower(name)=lower(v_category_name)
    limit 1;

    insert into public.transactions(
      user_id, type, description, amount, category_id, category_name,
      account_id, date
    ) values (
      v_user_id, v_type,
      left((case when v_type='income' then 'Cobro: ' else 'Pago: ' end)
        ||v_debt.concept||' - '||v_debt.person_name, 200),
      v_total, v_category_id, v_category_name, p_account_id, p_payment_date
    ) returning id into v_transaction_id;

    update public.debt_payments
    set transaction_id=v_transaction_id
    where id=v_payment_id and user_id=v_user_id;
  end if;

  return jsonb_build_object(
    'payment_id',v_payment_id,'transaction_id',v_transaction_id,
    'amount',v_amount,'fee_amount',v_fee,'total',v_total,'replayed',false
  );
end;
$$;

-- Deshacer un pago/cobro junto con su movimiento vinculado.
create or replace function public.undo_debt_payment(p_payment_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
  v_payment public.debt_payments%rowtype;
  v_debt_id uuid;
begin
  if v_user_id is null or not public.is_active_user() then
    raise exception using errcode='42501', message='NOT_AUTHENTICATED';
  end if;
  select debt_id into v_debt_id from public.debt_payments
  where id=p_payment_id and user_id=v_user_id;
  if not found then
    raise exception using errcode='42501', message='PAYMENT_NOT_FOUND';
  end if;
  perform 1 from public.debts
    where id=v_debt_id and user_id=v_user_id for update;
  if not found then
    raise exception using errcode='42501', message='DEBT_NOT_FOUND';
  end if;
  select * into v_payment from public.debt_payments
  where id=p_payment_id and user_id=v_user_id for update;
  if not found then
    raise exception using errcode='42501', message='PAYMENT_NOT_FOUND';
  end if;

  delete from public.debt_payments
  where id=v_payment.id and user_id=v_user_id;

  if v_payment.transaction_id is not null then
    delete from public.transactions
    where id=v_payment.transaction_id and user_id=v_user_id;
  end if;

  perform public.refresh_debt_reminders(v_debt_id);
end;
$$;

-- Borrar una cuenta por cobrar/pagar no debe dejar ingresos/gastos huérfanos.
create or replace function public.delete_debt_with_transactions(p_debt_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
  v_transaction_ids uuid[];
begin
  if v_user_id is null or not public.is_active_user() then
    raise exception using errcode='42501', message='NOT_AUTHENTICATED';
  end if;
  perform 1 from public.debts
    where id=p_debt_id and user_id=v_user_id for update;
  if not found then
    raise exception using errcode='42501', message='DEBT_NOT_FOUND';
  end if;

  select array_agg(distinct transaction_id) into v_transaction_ids
  from public.debt_payments
  where debt_id=p_debt_id and user_id=v_user_id and transaction_id is not null;

  delete from public.debt_payments where debt_id=p_debt_id and user_id=v_user_id;
  delete from public.debts where id=p_debt_id and user_id=v_user_id;

  if v_transaction_ids is not null then
    delete from public.transactions
    where user_id=v_user_id and id = any(v_transaction_ids);
  end if;
end;
$$;

-- Evitar que los navegadores llamen a funciones administrativas sin autenticación.
revoke all on function public.register_debt_payment(
  uuid,uuid,numeric,numeric,date,text,boolean,text,uuid,uuid
) from public, anon;
revoke all on function public.undo_debt_payment(uuid) from public, anon;
revoke all on function public.delete_debt_with_transactions(uuid) from public, anon;
grant execute on function public.register_debt_payment(
  uuid,uuid,numeric,numeric,date,text,boolean,text,uuid,uuid
) to authenticated;
grant execute on function public.undo_debt_payment(uuid) to authenticated;
grant execute on function public.delete_debt_with_transactions(uuid) to authenticated;

commit;
