-- MoneyTrack · Cobros y pagos integrados con movimientos de Ingresos/Gastos.
-- Ejecutar SOLO en el proyecto MoneyTrack, luego de verificar y respaldar.
-- No duplica cálculos ni modifica Dashboard / AccountContext.
begin;

-- No combinar esta modalidad con el paquete anterior de flujos separados.
do $$
begin
  if to_regclass('public.debt_account_flows') is not null then
    raise exception using errcode = '23514',
      message = 'OLD_LOAN_FLOWS_PRESENT_DO_NOT_APPLY_BOTH_MODELS';
  end if;
end $$;

alter table public.debts
  add column if not exists initial_transaction_id uuid;

alter table public.debts
  add column if not exists initial_account_id uuid;

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conrelid = 'public.debts'::regclass
      and conname = 'debts_initial_transaction_id_fkey'
  ) then
    alter table public.debts
      add constraint debts_initial_transaction_id_fkey
      foreign key (initial_transaction_id) references public.transactions(id)
      on delete set null;
  end if;
  if not exists (
    select 1 from pg_constraint
    where conrelid = 'public.debts'::regclass
      and conname = 'debts_initial_account_id_fkey'
  ) then
    alter table public.debts
      add constraint debts_initial_account_id_fkey
      foreign key (initial_account_id) references public.accounts(id)
      on delete set null;
  end if;
end $$;

create unique index if not exists debts_initial_transaction_unique
on public.debts(initial_transaction_id)
where initial_transaction_id is not null;

-- El enlace entre deuda y transacción inicial solo se administra desde el RPC.
-- Las ediciones de datos de la deuda sí se permiten, y actualizan su transacción.
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
    if new.initial_account_id is null and old.initial_account_id is not null
       and exists (select 1 from public.accounts a where a.id = old.initial_account_id) then
      raise exception using errcode = '23514', message = 'LOAN_ACCOUNT_REQUIRED';
    end if;
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

drop trigger if exists debts_guard_initial_link on public.debts;
create trigger debts_guard_initial_link
before update of initial_transaction_id, initial_account_id, user_id
on public.debts for each row
execute function public.guard_debt_initial_link();

-- Evita modificar o borrar a mano movimientos iniciales Y de pagos/cobros.
-- Los cobros y pagos parciales se gestionan con register_debt_payment / undo_debt_payment.
create or replace function public.guard_debt_linked_transaction()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  if (
    exists (select 1 from public.debts d where d.initial_transaction_id = old.id)
    or exists (select 1 from public.debt_payments p where p.transaction_id = old.id)
  ) and coalesce(current_setting('moneytrack.loan_transaction_sync', true), '') <> 'allowed' then
    -- Permitir ON DELETE SET NULL del account_id tras borrar una cuenta (028).
    -- No evaluar NEW en operaciones DELETE.
    if tg_op = 'UPDATE' then
      if old.account_id is not null and new.account_id is null
         and new.type is not distinct from old.type
         and new.amount is not distinct from old.amount
         and new.description is not distinct from old.description
         and new.date is not distinct from old.date
         and not exists (select 1 from public.accounts a where a.id = old.account_id)
      then
        return new;
      end if;
    end if;
    raise exception using errcode = '23514', message = 'DEBT_TRANSACTION_MANAGED_FROM_DEBTS';
  end if;
  if tg_op = 'DELETE' then
    return old;
  end if;
  return new;
end;
$$;

drop trigger if exists transactions_guard_debt_linked on public.transactions;
create trigger transactions_guard_debt_linked
before update or delete on public.transactions
for each row execute function public.guard_debt_linked_transaction();

-- Cambios de importe, fecha, concepto, persona, cuenta o sentido de la deuda
-- se reflejan en el movimiento inicial EN LA MISMA transacción de PostgreSQL.
create or replace function public.sync_initial_debt_transaction()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_type text;
  v_category text;
  v_category_id uuid;
begin
  if new.initial_transaction_id is null then return new; end if;
  if old.initial_transaction_id is distinct from new.initial_transaction_id then
    return new;
  end if;
  if old.original_amount is not distinct from new.original_amount
     and old.debt_date is not distinct from new.debt_date
     and old.person_name is not distinct from new.person_name
     and old.concept is not distinct from new.concept
     and old.direction is not distinct from new.direction
     and old.initial_account_id is not distinct from new.initial_account_id then
    return new;
  end if;
  v_type := case when new.direction = 'payable' then 'income' else 'expense' end;
  v_category := case when new.direction = 'payable' then 'Préstamo recibido' else 'Préstamo otorgado' end;
  select c.id into v_category_id from public.categories c
  where c.user_id = new.user_id and c.type = v_type
    and lower(c.name) = lower(v_category) limit 1;
  perform set_config('moneytrack.loan_transaction_sync', 'allowed', true);
  update public.transactions
  set type = v_type,
      description = left(v_category || ': ' || new.concept || ' - ' || new.person_name, 200),
      amount = new.original_amount,
      category_id = v_category_id,
      category_name = v_category,
      account_id = new.initial_account_id,
      date = new.debt_date
  where id = new.initial_transaction_id and user_id = new.user_id;
  if not found then
    raise exception using errcode = '23514', message = 'LOAN_TRANSACTION_MISSING';
  end if;
  perform set_config('moneytrack.loan_transaction_sync', '', true);
  return new;
end;
$$;

drop trigger if exists debts_sync_initial_transaction on public.debts;
create trigger debts_sync_initial_transaction
after update on public.debts
for each row execute function public.sync_initial_debt_transaction();

-- Al borrar una deuda, su movimiento inicial se elimina. El RPC actual
-- delete_debt_with_transactions ya elimina los movimientos de pagos parciales.
create or replace function public.delete_initial_debt_transaction()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if old.initial_transaction_id is not null then
    delete from public.transactions
    where id = old.initial_transaction_id and user_id = old.user_id;
  end if;
  return old;
end;
$$;

drop trigger if exists debts_delete_initial_transaction on public.debts;
create trigger debts_delete_initial_transaction
after delete on public.debts
for each row execute function public.delete_initial_debt_transaction();

-- Una sola función crea deuda + ingreso/gasto, o deshace todo si falla algo.
-- p_request_id se utiliza como ID de deuda para evitar duplicados al reintentar.
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
  if p_request_id is null or p_payload is null or p_account_id is null then
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
  if not exists (
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

revoke all on function public.create_debt_with_initial_transaction(uuid,jsonb,uuid)
from public, anon;
grant execute on function public.create_debt_with_initial_transaction(uuid,jsonb,uuid)
to authenticated;

-- Las funciones auxiliares de trigger no son API pública.
revoke all on function public.guard_debt_initial_link() from public, anon, authenticated;
revoke all on function public.guard_debt_linked_transaction() from public, anon, authenticated;
revoke all on function public.sync_initial_debt_transaction() from public, anon, authenticated;
revoke all on function public.delete_initial_debt_transaction() from public, anon, authenticated;

-- No se modifican las funciones register_debt_payment ni undo_debt_payment.
commit;
