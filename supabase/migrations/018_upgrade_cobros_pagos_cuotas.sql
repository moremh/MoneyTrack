begin;

-- ============================================================
-- MONEYTRACK
-- 018 - Upgrade de Deudas y préstamos -> Cobros y pagos
--
-- Esta migración parte de la 017 anterior ya aplicada.
-- Conserva cuentas y pagos existentes y agrega:
-- - modo flexible / cuotas
-- - cuotas mensuales
-- - vínculo pago-transacción
-- - recordatorios por cuota
-- ============================================================

-- 1) Evolucionar la tabla principal sin borrar datos existentes.

alter table public.debts
  add column if not exists payment_mode text
    not null
    default 'flexible'
    check (payment_mode in ('flexible', 'installments'));

alter table public.debts
  add column if not exists installment_count integer
    check (
      installment_count is null
      or installment_count between 1 and 120
    );

alter table public.debts
  add column if not exists first_installment_date date;

alter table public.debts
  add column if not exists installment_end_date date;

alter table public.debts
  add column if not exists timezone text
    not null
    default 'America/Argentina/Buenos_Aires'
    check (
      char_length(trim(timezone))
      between 1 and 100
    );

alter table public.debts
  alter column reminder_offsets
  set default array[0]::smallint[];

alter table public.debts
  drop constraint if exists debts_due_date_check;

alter table public.debts
  drop constraint if exists debts_plan_check;

alter table public.debts
  add constraint debts_plan_check
  check (
    (
      payment_mode = 'flexible'
      and (
        due_date is null
        or due_date >= debt_date
      )
      and installment_count is null
      and first_installment_date is null
      and installment_end_date is null
    )
    or
    (
      payment_mode = 'installments'
      and installment_count is not null
      and first_installment_date is not null
      and installment_end_date is not null
      and first_installment_date >= debt_date
      and installment_end_date >= first_installment_date
      and due_date = installment_end_date
    )
  );

create index if not exists debts_user_due_date_idx
on public.debts(user_id, due_date)
where due_date is not null;


-- 2) Tabla de cuotas.

create table if not exists public.debt_installments (
  id uuid primary key default gen_random_uuid(),

  debt_id uuid not null
    references public.debts(id)
    on delete cascade,

  user_id uuid not null
    default auth.uid()
    references public.profiles(id)
    on delete cascade,

  installment_number integer not null
    check (installment_number > 0),

  amount_due numeric(14, 2) not null
    check (amount_due > 0),

  paid_amount numeric(14, 2) not null
    default 0
    check (
      paid_amount >= 0
      and paid_amount <= amount_due
    ),

  due_date date not null,

  status text not null
    default 'pending'
    check (
      status in (
        'pending',
        'partial',
        'paid'
      )
    ),

  created_at timestamptz not null
    default now(),

  updated_at timestamptz not null
    default now(),

  unique (
    debt_id,
    installment_number
  )
);

create index if not exists debt_installments_debt_idx
on public.debt_installments(debt_id, installment_number);

create index if not exists debt_installments_user_due_idx
on public.debt_installments(user_id, due_date);

drop trigger if exists debt_installments_set_updated_at
on public.debt_installments;

create trigger debt_installments_set_updated_at
before update on public.debt_installments
for each row
execute function public.set_updated_at();


-- 3) Evolucionar pagos existentes.

alter table public.debt_payments
  add column if not exists installment_id uuid;

alter table public.debt_payments
  add column if not exists transaction_id uuid;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'debt_payments_installment_id_fkey'
  ) then
    alter table public.debt_payments
      add constraint debt_payments_installment_id_fkey
      foreign key (installment_id)
      references public.debt_installments(id)
      on delete cascade;
  end if;

  if not exists (
    select 1
    from pg_constraint
    where conname = 'debt_payments_transaction_id_fkey'
  ) then
    alter table public.debt_payments
      add constraint debt_payments_transaction_id_fkey
      foreign key (transaction_id)
      references public.transactions(id)
      on delete set null;
  end if;
end;
$$;

create index if not exists debt_payments_installment_idx
on public.debt_payments(installment_id)
where installment_id is not null;

create index if not exists debt_payments_user_idx
on public.debt_payments(user_id);


-- 4) Retirar triggers de la 017 anterior para que no dupliquen lógica.

drop trigger if exists debts_set_status
on public.debts;

drop trigger if exists debt_payments_sync_total
on public.debt_payments;

create or replace function public.add_months_clamped(
  p_date date,
  p_months integer
)
returns date
language plpgsql
immutable
set search_path = ''
as $$
declare
  target_month date;
  last_day integer;
  desired_day integer;
begin
  target_month :=
    (
      date_trunc('month', p_date)
      + make_interval(months => p_months)
    )::date;

  last_day :=
    extract(
      day
      from (
        target_month
        + interval '1 month'
        - interval '1 day'
      )
    )::integer;

  desired_day :=
    least(
      extract(day from p_date)::integer,
      last_day
    );

  return target_month + (desired_day - 1);
end;
$$;


create or replace function public.generate_debt_installments(
  p_debt_id uuid
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  debt_record public.debts%rowtype;
  regular_amount numeric(14, 2);
  installment_amount numeric(14, 2);
  number_index integer;
  due_value date;
begin
  select *
  into debt_record
  from public.debts
  where id = p_debt_id;

  if debt_record.id is null
     or debt_record.payment_mode <> 'installments'
  then
    return;
  end if;

  delete from public.debt_installments
  where debt_id = p_debt_id;

  regular_amount :=
    trunc(
      (debt_record.original_amount / debt_record.installment_count)::numeric,
      2
    );

  for number_index in 1..debt_record.installment_count
  loop
    if number_index = debt_record.installment_count then
      installment_amount :=
        debt_record.original_amount
        - regular_amount * (debt_record.installment_count - 1);

      due_value := debt_record.installment_end_date;
    else
      installment_amount := regular_amount;

      due_value :=
        public.add_months_clamped(
          debt_record.first_installment_date,
          number_index - 1
        );
    end if;

    insert into public.debt_installments (
      debt_id,
      user_id,
      installment_number,
      amount_due,
      paid_amount,
      due_date,
      status
    )
    values (
      debt_record.id,
      debt_record.user_id,
      number_index,
      installment_amount,
      0,
      due_value,
      'pending'
    );
  end loop;
end;
$$;


alter table public.reminders
  add column if not exists related_debt_id uuid;

alter table public.reminders
  add column if not exists related_installment_id uuid;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'reminders_related_debt_id_fkey'
  ) then
    alter table public.reminders
      add constraint reminders_related_debt_id_fkey
      foreign key (related_debt_id)
      references public.debts(id)
      on delete cascade;
  end if;

  if not exists (
    select 1
    from pg_constraint
    where conname = 'reminders_related_installment_id_fkey'
  ) then
    alter table public.reminders
      add constraint reminders_related_installment_id_fkey
      foreign key (related_installment_id)
      references public.debt_installments(id)
      on delete cascade;
  end if;
end;
$$;

create index if not exists reminders_related_debt_idx
on public.reminders(related_debt_id)
where related_debt_id is not null;

create index if not exists reminders_related_installment_idx
on public.reminders(related_installment_id)
where related_installment_id is not null;

alter table public.reminders
  drop constraint if exists reminders_type_check;

alter table public.reminders
  add constraint reminders_type_check
  check (
    type in (
      'general',
      'payment',
      'goal',
      'debt',
      'custom'
    )
  );


create or replace function public.refresh_debt_reminders(
  p_debt_id uuid
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  debt_record public.debts%rowtype;
  installment_record public.debt_installments%rowtype;
  offset_value smallint;
  notification_date date;
  reminder_title text;
  reminder_description text;
begin
  select *
  into debt_record
  from public.debts
  where id = p_debt_id;

  if debt_record.id is null then
    return;
  end if;

  delete from public.reminders
  where related_debt_id = debt_record.id
    and status = 'pending';

  if debt_record.status in ('paid', 'cancelled')
     or cardinality(debt_record.reminder_offsets) = 0
  then
    return;
  end if;

  reminder_title :=
    case
      when debt_record.direction = 'receivable'
        then 'Cobrar a ' || debt_record.person_name
      else 'Pagar a ' || debt_record.person_name
    end;

  if debt_record.payment_mode = 'flexible' then
    if debt_record.due_date is null then
      return;
    end if;

    foreach offset_value in array debt_record.reminder_offsets
    loop
      notification_date :=
        greatest(
          debt_record.due_date - offset_value,
          current_date
        );

      reminder_description :=
        debt_record.concept
        || '. Saldo pendiente: '
        || debt_record.currency
        || ' '
        || (
          debt_record.original_amount
          - debt_record.paid_amount
        )::text
        || '.';

      insert into public.reminders (
        user_id,
        title,
        description,
        type,
        reminder_date,
        reminder_time,
        timezone,
        recurrence,
        related_debt_id,
        status,
        is_read
      )
      values (
        debt_record.user_id,
        reminder_title,
        reminder_description,
        'debt',
        notification_date,
        debt_record.reminder_time,
        debt_record.timezone,
        'none',
        debt_record.id,
        'pending',
        true
      );
    end loop;

    return;
  end if;

  for installment_record in
    select *
    from public.debt_installments
    where debt_id = debt_record.id
      and status <> 'paid'
    order by installment_number
  loop
    foreach offset_value in array debt_record.reminder_offsets
    loop
      notification_date :=
        greatest(
          installment_record.due_date - offset_value,
          current_date
        );

      reminder_description :=
        'Cuota '
        || installment_record.installment_number
        || ' de '
        || debt_record.installment_count
        || ' · '
        || debt_record.concept
        || ' · vence '
        || installment_record.due_date::text
        || '.';

      insert into public.reminders (
        user_id,
        title,
        description,
        type,
        reminder_date,
        reminder_time,
        timezone,
        recurrence,
        related_debt_id,
        related_installment_id,
        status,
        is_read
      )
      values (
        debt_record.user_id,
        reminder_title,
        reminder_description,
        'debt',
        notification_date,
        debt_record.reminder_time,
        debt_record.timezone,
        'none',
        debt_record.id,
        installment_record.id,
        'pending',
        true
      );
    end loop;
  end loop;
end;
$$;


create or replace function public.prepare_debt_before_write()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.payment_mode = 'flexible' then
    new.installment_count := null;
    new.first_installment_date := null;
    new.installment_end_date := null;
  else
    if new.installment_count is null
       or new.first_installment_date is null
       or new.installment_end_date is null
    then
      raise exception
        using
          errcode = '23514',
          message = 'INVALID_INSTALLMENT_PLAN';
    end if;

    new.due_date := new.installment_end_date;
  end if;

  if new.status = 'cancelled' then
    new.paid_at := null;
    return new;
  end if;

  if new.paid_amount >= new.original_amount then
    new.paid_amount := new.original_amount;
    new.status := 'paid';
    new.paid_at := coalesce(new.paid_at, now());
  elsif new.paid_amount > 0 then
    new.status := 'partial';
    new.paid_at := null;
  else
    new.status := 'pending';
    new.paid_at := null;
  end if;

  return new;
end;
$$;

drop trigger if exists debts_prepare_before_write
on public.debts;

create trigger debts_prepare_before_write
before insert or update
on public.debts
for each row
execute function public.prepare_debt_before_write();

drop trigger if exists debts_set_updated_at
on public.debts;

create trigger debts_set_updated_at
before update
on public.debts
for each row
execute function public.set_updated_at();


create or replace function public.after_debt_insert()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.payment_mode = 'installments' then
    perform public.generate_debt_installments(new.id);
  end if;

  perform public.refresh_debt_reminders(new.id);

  return new;
end;
$$;

drop trigger if exists debts_after_insert
on public.debts;

create trigger debts_after_insert
after insert
on public.debts
for each row
execute function public.after_debt_insert();


create or replace function public.before_debt_plan_update()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if (
    old.payment_mode is distinct from new.payment_mode
    or old.original_amount is distinct from new.original_amount
    or old.installment_count is distinct from new.installment_count
    or old.first_installment_date is distinct from new.first_installment_date
    or old.installment_end_date is distinct from new.installment_end_date
  ) then
    if exists (
      select 1
      from public.debt_payments
      where debt_id = old.id
    ) then
      raise exception
        using
          errcode = '23514',
          message = 'DEBT_PLAN_HAS_PAYMENTS';
    end if;
  end if;

  return new;
end;
$$;

drop trigger if exists debts_before_plan_update
on public.debts;

create trigger debts_before_plan_update
before update
on public.debts
for each row
execute function public.before_debt_plan_update();


create or replace function public.after_debt_update()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if (
    old.payment_mode is distinct from new.payment_mode
    or old.original_amount is distinct from new.original_amount
    or old.installment_count is distinct from new.installment_count
    or old.first_installment_date is distinct from new.first_installment_date
    or old.installment_end_date is distinct from new.installment_end_date
  ) then
    delete from public.debt_installments
    where debt_id = new.id;

    if new.payment_mode = 'installments' then
      perform public.generate_debt_installments(new.id);
    end if;
  end if;

  if new.status = 'cancelled' then
    update public.reminders
    set
      status = 'cancelled',
      is_read = true
    where related_debt_id = new.id
      and status = 'pending';
  elsif (
    old.status = 'cancelled'
    or old.due_date is distinct from new.due_date
    or old.reminder_offsets is distinct from new.reminder_offsets
    or old.reminder_time is distinct from new.reminder_time
    or old.timezone is distinct from new.timezone
    or old.person_name is distinct from new.person_name
    or old.concept is distinct from new.concept
    or old.payment_mode is distinct from new.payment_mode
    or old.installment_count is distinct from new.installment_count
    or old.first_installment_date is distinct from new.first_installment_date
    or old.installment_end_date is distinct from new.installment_end_date
  ) then
    perform public.refresh_debt_reminders(new.id);
  end if;

  return new;
end;
$$;

drop trigger if exists debts_after_update
on public.debts;

create trigger debts_after_update
after update
on public.debts
for each row
execute function public.after_debt_update();


create or replace function public.validate_debt_payment()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  debt_record public.debts%rowtype;
  installment_record public.debt_installments%rowtype;
  current_debt_total numeric(14, 2);
  current_installment_total numeric(14, 2);
begin
  select *
  into debt_record
  from public.debts
  where id = new.debt_id;

  if debt_record.id is null then
    raise exception
      using errcode = '23503', message = 'DEBT_NOT_FOUND';
  end if;

  if debt_record.user_id <> new.user_id
     or new.user_id <> auth.uid()
  then
    raise exception
      using errcode = '42501', message = 'DEBT_PAYMENT_NOT_OWNED_BY_USER';
  end if;

  if debt_record.status = 'cancelled' then
    raise exception
      using errcode = '23514', message = 'DEBT_CANCELLED';
  end if;

  if debt_record.payment_mode = 'installments'
     and new.installment_id is null
  then
    raise exception
      using errcode = '23514', message = 'INSTALLMENT_REQUIRED';
  end if;

  if debt_record.payment_mode = 'flexible' then
    new.installment_id := null;
  end if;

  if new.installment_id is not null then
    select *
    into installment_record
    from public.debt_installments
    where id = new.installment_id;

    if installment_record.id is null
       or installment_record.debt_id <> new.debt_id
       or installment_record.user_id <> new.user_id
    then
      raise exception
        using errcode = '42501', message = 'INSTALLMENT_NOT_OWNED_BY_DEBT';
    end if;
  end if;

  select coalesce(sum(amount), 0)
  into current_debt_total
  from public.debt_payments
  where debt_id = new.debt_id
    and (
      tg_op = 'INSERT'
      or id <> new.id
    );

  if current_debt_total + new.amount > debt_record.original_amount then
    raise exception
      using errcode = '23514', message = 'DEBT_PAYMENT_EXCEEDS_BALANCE';
  end if;

  if new.installment_id is not null then
    select coalesce(sum(amount), 0)
    into current_installment_total
    from public.debt_payments
    where installment_id = new.installment_id
      and (
        tg_op = 'INSERT'
        or id <> new.id
      );

    if current_installment_total + new.amount > installment_record.amount_due then
      raise exception
        using errcode = '23514', message = 'DEBT_PAYMENT_EXCEEDS_INSTALLMENT_BALANCE';
    end if;
  end if;

  return new;
end;
$$;

drop trigger if exists debt_payments_validate
on public.debt_payments;

create trigger debt_payments_validate
before insert or update
on public.debt_payments
for each row
execute function public.validate_debt_payment();


create or replace function public.sync_debt_balances()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  target_debt_id uuid;
  target_installment_id uuid;
  debt_total numeric(14, 2);
  installment_total numeric(14, 2);
  debt_record public.debts%rowtype;
begin
  target_debt_id := coalesce(new.debt_id, old.debt_id);
  target_installment_id := coalesce(new.installment_id, old.installment_id);

  if target_installment_id is not null then
    select coalesce(sum(amount), 0)
    into installment_total
    from public.debt_payments
    where installment_id = target_installment_id;

    update public.debt_installments
    set
      paid_amount = installment_total,
      status =
        case
          when installment_total >= amount_due then 'paid'
          when installment_total > 0 then 'partial'
          else 'pending'
        end
    where id = target_installment_id;

    if exists (
      select 1
      from public.debt_installments
      where id = target_installment_id
        and status = 'paid'
    ) then
      update public.reminders
      set
        status = 'completed',
        is_read = true,
        completed_at = coalesce(completed_at, now())
      where related_installment_id = target_installment_id
        and status = 'pending';
    end if;
  end if;

  select coalesce(sum(amount), 0)
  into debt_total
  from public.debt_payments
  where debt_id = target_debt_id;

  update public.debts
  set paid_amount = debt_total
  where id = target_debt_id;

  select *
  into debt_record
  from public.debts
  where id = target_debt_id;

  if debt_record.status = 'paid' then
    update public.reminders
    set
      status = 'completed',
      is_read = true,
      completed_at = coalesce(completed_at, now())
    where related_debt_id = target_debt_id
      and status = 'pending';
  end if;

  return null;
end;
$$;

drop trigger if exists debt_payments_sync_balances
on public.debt_payments;

create trigger debt_payments_sync_balances
after insert or update or delete
on public.debt_payments
for each row
execute function public.sync_debt_balances();


create or replace function public.validate_reminder_debt_ownership()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.related_debt_id is not null then
    if not exists (
      select 1
      from public.debts
      where id = new.related_debt_id
        and user_id = new.user_id
    ) then
      raise exception
        using errcode = '42501', message = 'REMINDER_DEBT_NOT_OWNED_BY_USER';
    end if;
  end if;

  if new.related_installment_id is not null then
    if not exists (
      select 1
      from public.debt_installments
      where id = new.related_installment_id
        and debt_id = new.related_debt_id
        and user_id = new.user_id
    ) then
      raise exception
        using errcode = '42501', message = 'REMINDER_INSTALLMENT_NOT_OWNED_BY_USER';
    end if;
  end if;

  return new;
end;
$$;

drop trigger if exists reminders_validate_debt
on public.reminders;

create trigger reminders_validate_debt
before insert
or update of related_debt_id, related_installment_id, user_id
on public.reminders
for each row
execute function public.validate_reminder_debt_ownership();


alter table public.debts enable row level security;
alter table public.debt_installments enable row level security;
alter table public.debt_payments enable row level security;

drop policy if exists "Users can read own debts" on public.debts;
create policy "Users can read own debts"
on public.debts for select to authenticated
using (auth.uid() = user_id);

drop policy if exists "Users can insert own debts" on public.debts;
create policy "Users can insert own debts"
on public.debts for insert to authenticated
with check (
  auth.uid() = user_id
  and public.is_active_user()
);

drop policy if exists "Users can update own debts" on public.debts;
create policy "Users can update own debts"
on public.debts for update to authenticated
using (auth.uid() = user_id)
with check (
  auth.uid() = user_id
  and public.is_active_user()
);

drop policy if exists "Users can delete own debts" on public.debts;
create policy "Users can delete own debts"
on public.debts for delete to authenticated
using (
  auth.uid() = user_id
  and public.is_active_user()
);

drop policy if exists "Users can read own debt installments" on public.debt_installments;
create policy "Users can read own debt installments"
on public.debt_installments for select to authenticated
using (auth.uid() = user_id);

drop policy if exists "Users can read own debt payments" on public.debt_payments;
create policy "Users can read own debt payments"
on public.debt_payments for select to authenticated
using (auth.uid() = user_id);

drop policy if exists "Users can insert own debt payments" on public.debt_payments;
create policy "Users can insert own debt payments"
on public.debt_payments for insert to authenticated
with check (
  auth.uid() = user_id
  and public.is_active_user()
  and exists (
    select 1
    from public.debts
    where id = debt_id
      and user_id = auth.uid()
  )
);

drop policy if exists "Users can update own debt payments" on public.debt_payments;
create policy "Users can update own debt payments"
on public.debt_payments for update to authenticated
using (auth.uid() = user_id)
with check (
  auth.uid() = user_id
  and public.is_active_user()
);

drop policy if exists "Users can delete own debt payments" on public.debt_payments;
create policy "Users can delete own debt payments"
on public.debt_payments for delete to authenticated
using (
  auth.uid() = user_id
  and public.is_active_user()
);

revoke insert, update, delete
on public.debt_installments
from authenticated;

revoke all on function public.generate_debt_installments(uuid) from public;
revoke all on function public.refresh_debt_reminders(uuid) from public;
revoke all on function public.validate_debt_payment() from public;
revoke all on function public.sync_debt_balances() from public;
revoke all on function public.validate_reminder_debt_ownership() from public;

-- 5) Refrescar recordatorios de cuentas existentes.
-- Las cuentas anteriores siguen siendo "flexible", por lo que no se pierde
-- ningún pago ni se inventan cuotas sobre registros ya existentes.

do $$
declare
  debt_row record;
begin
  for debt_row in
    select id
    from public.debts
  loop
    perform public.refresh_debt_reminders(debt_row.id);
  end loop;
end;
$$;

commit;
