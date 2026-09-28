begin;

-- ============================================================
-- MONEYTRACK
-- 017 - Deudas, préstamos, pagos parciales y recordatorios
-- ============================================================

-- ============================================================
-- 1. TABLA PRINCIPAL
-- ============================================================

create table if not exists public.debts (
  id uuid primary key
    default gen_random_uuid(),

  user_id uuid not null
    default auth.uid()
    references public.profiles(id)
    on delete cascade,

  direction text not null
    check (
      direction in (
        'receivable',
        'payable'
      )
    ),

  person_name text not null
    check (
      char_length(trim(person_name))
      between 1 and 120
    ),

  concept text not null
    check (
      char_length(trim(concept))
      between 1 and 160
    ),

  original_amount numeric(14, 2)
    not null
    check (
      original_amount > 0
    ),

  paid_amount numeric(14, 2)
    not null
    default 0
    check (
      paid_amount >= 0
      and paid_amount <= original_amount
    ),

  currency text not null
    default 'ARS'
    check (
      currency ~ '^[A-Z]{3}$'
    ),

  debt_date date not null
    default current_date,

  due_date date,

  notes text
    check (
      notes is null
      or char_length(trim(notes)) <= 2000
    ),

  status text not null
    default 'pending'
    check (
      status in (
        'pending',
        'partial',
        'paid',
        'cancelled'
      )
    ),

  reminder_offsets smallint[]
    not null
    default '{}'::smallint[]
    check (
      reminder_offsets
      <@
      array[0, 1, 3, 7]::smallint[]
    ),

  reminder_time time without time zone
    not null
    default time '09:00',

  paid_at timestamptz,

  created_at timestamptz not null
    default now(),

  updated_at timestamptz not null
    default now(),

  constraint debts_due_date_check
    check (
      due_date is null
      or due_date >= debt_date
    )
);

create index if not exists
  debts_user_id_idx
on public.debts(user_id);

create index if not exists
  debts_user_direction_status_idx
on public.debts(
  user_id,
  direction,
  status
);

create index if not exists
  debts_user_due_date_idx
on public.debts(
  user_id,
  due_date
)
where due_date is not null;

-- ============================================================
-- 2. ESTADO AUTOMÁTICO DE LA DEUDA
-- ============================================================

create or replace function
  public.set_debt_status()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.status = 'cancelled' then
    new.paid_at := null;
    return new;
  end if;

  if new.paid_amount >= new.original_amount then
    new.status := 'paid';
    new.paid_amount := new.original_amount;
    new.paid_at :=
      coalesce(
        new.paid_at,
        now()
      );
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

drop trigger if exists
  debts_set_status
on public.debts;

create trigger
  debts_set_status
before insert
or update of
  original_amount,
  paid_amount,
  status
on public.debts
for each row
execute function
  public.set_debt_status();

drop trigger if exists
  debts_set_updated_at
on public.debts;

create trigger
  debts_set_updated_at
before update
on public.debts
for each row
execute function
  public.set_updated_at();

-- ============================================================
-- 3. HISTORIAL DE PAGOS
-- ============================================================

create table if not exists
  public.debt_payments (
    id uuid primary key
      default gen_random_uuid(),

    debt_id uuid not null
      references public.debts(id)
      on delete cascade,

    user_id uuid not null
      default auth.uid()
      references public.profiles(id)
      on delete cascade,

    amount numeric(14, 2)
      not null
      check (
        amount > 0
      ),

    payment_date date not null
      default current_date,

    notes text
      check (
        notes is null
        or char_length(trim(notes)) <= 1000
      ),

    created_at timestamptz not null
      default now()
  );

create index if not exists
  debt_payments_debt_id_idx
on public.debt_payments(debt_id);

create index if not exists
  debt_payments_user_id_idx
on public.debt_payments(user_id);

create index if not exists
  debt_payments_debt_date_idx
on public.debt_payments(
  debt_id,
  payment_date
);

-- ============================================================
-- 4. VALIDAR PAGO Y SINCRONIZAR SALDO
-- ============================================================

create or replace function
  public.validate_debt_payment()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  debt_record
    public.debts%rowtype;

  other_total
    numeric(14, 2);
begin
  select *
  into debt_record
  from public.debts
  where id = new.debt_id;

  if debt_record.id is null then
    raise exception
      using
        errcode = '23503',
        message =
          'DEBT_NOT_FOUND';
  end if;

  if
    debt_record.user_id <> new.user_id
    or new.user_id <> auth.uid()
  then
    raise exception
      using
        errcode = '42501',
        message =
          'DEBT_PAYMENT_NOT_OWNED_BY_USER';
  end if;

  if debt_record.status = 'cancelled' then
    raise exception
      using
        errcode = '23514',
        message =
          'DEBT_CANCELLED';
  end if;

  select
    coalesce(
      sum(amount),
      0
    )
  into other_total
  from public.debt_payments
  where debt_id = new.debt_id
    and (
      tg_op = 'INSERT'
      or id <> new.id
    );

  if
    other_total + new.amount
    >
    debt_record.original_amount
  then
    raise exception
      using
        errcode = '23514',
        message =
          'DEBT_PAYMENT_EXCEEDS_BALANCE';
  end if;

  return new;
end;
$$;

drop trigger if exists
  debt_payments_validate
on public.debt_payments;

create trigger
  debt_payments_validate
before insert
or update
on public.debt_payments
for each row
execute function
  public.validate_debt_payment();

create or replace function
  public.sync_debt_paid_amount()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  target_debt_id uuid;
  total_paid numeric(14, 2);
begin
  target_debt_id :=
    coalesce(
      new.debt_id,
      old.debt_id
    );

  select
    coalesce(
      sum(amount),
      0
    )
  into total_paid
  from public.debt_payments
  where debt_id =
    target_debt_id;

  update public.debts
  set paid_amount =
    total_paid
  where id =
    target_debt_id;

  return null;
end;
$$;

drop trigger if exists
  debt_payments_sync_total
on public.debt_payments;

create trigger
  debt_payments_sync_total
after insert
or update
or delete
on public.debt_payments
for each row
execute function
  public.sync_debt_paid_amount();

-- ============================================================
-- 5. RLS
-- ============================================================

alter table public.debts
enable row level security;

alter table public.debt_payments
enable row level security;

drop policy if exists
  "Users can read own debts"
on public.debts;

create policy
  "Users can read own debts"
on public.debts
for select
to authenticated
using (
  auth.uid() = user_id
);

drop policy if exists
  "Users can insert own debts"
on public.debts;

create policy
  "Users can insert own debts"
on public.debts
for insert
to authenticated
with check (
  auth.uid() = user_id
  and public.is_active_user()
);

drop policy if exists
  "Users can update own debts"
on public.debts;

create policy
  "Users can update own debts"
on public.debts
for update
to authenticated
using (
  auth.uid() = user_id
)
with check (
  auth.uid() = user_id
  and public.is_active_user()
);

drop policy if exists
  "Users can delete own debts"
on public.debts;

create policy
  "Users can delete own debts"
on public.debts
for delete
to authenticated
using (
  auth.uid() = user_id
  and public.is_active_user()
);

drop policy if exists
  "Users can read own debt payments"
on public.debt_payments;

create policy
  "Users can read own debt payments"
on public.debt_payments
for select
to authenticated
using (
  auth.uid() = user_id
);

drop policy if exists
  "Users can insert own debt payments"
on public.debt_payments;

create policy
  "Users can insert own debt payments"
on public.debt_payments
for insert
to authenticated
with check (
  auth.uid() = user_id
  and public.is_active_user()
  and exists (
    select 1
    from public.debts
    where id = debt_id
      and user_id =
        auth.uid()
  )
);

drop policy if exists
  "Users can update own debt payments"
on public.debt_payments;

create policy
  "Users can update own debt payments"
on public.debt_payments
for update
to authenticated
using (
  auth.uid() = user_id
)
with check (
  auth.uid() = user_id
  and public.is_active_user()
);

drop policy if exists
  "Users can delete own debt payments"
on public.debt_payments;

create policy
  "Users can delete own debt payments"
on public.debt_payments
for delete
to authenticated
using (
  auth.uid() = user_id
  and public.is_active_user()
);

-- ============================================================
-- 6. VINCULAR RECORDATORIOS CON DEUDAS
-- ============================================================

alter table public.reminders
  add column if not exists
    related_debt_id uuid;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname =
      'reminders_related_debt_id_fkey'
  ) then
    alter table public.reminders
      add constraint
        reminders_related_debt_id_fkey
      foreign key (
        related_debt_id
      )
      references public.debts(id)
      on delete cascade;
  end if;
end;
$$;

create index if not exists
  reminders_related_debt_id_idx
on public.reminders(
  related_debt_id
)
where related_debt_id is not null;

alter table public.reminders
  drop constraint if exists
    reminders_type_check;

alter table public.reminders
  add constraint
    reminders_type_check
  check (
    type in (
      'general',
      'payment',
      'goal',
      'debt',
      'custom'
    )
  );

create or replace function
  public.validate_reminder_debt_ownership()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.related_debt_id is null then
    return new;
  end if;

  if not exists (
    select 1
    from public.debts
    where id =
      new.related_debt_id
      and user_id =
        new.user_id
  ) then
    raise exception
      using
        errcode = '42501',
        message =
          'REMINDER_DEBT_NOT_OWNED_BY_USER';
  end if;

  return new;
end;
$$;

drop trigger if exists
  reminders_validate_debt
on public.reminders;

create trigger
  reminders_validate_debt
before insert
or update of
  related_debt_id,
  user_id
on public.reminders
for each row
execute function
  public.validate_reminder_debt_ownership();

revoke all
on function
  public.validate_debt_payment()
from public;

revoke all
on function
  public.sync_debt_paid_amount()
from public;

revoke all
on function
  public.validate_reminder_debt_ownership()
from public;

commit;
