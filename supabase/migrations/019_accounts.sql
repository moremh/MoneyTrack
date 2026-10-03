begin;

-- ============================================================
-- MONEYTRACK
-- 019 - Cuentas financieras
-- ============================================================

create table if not exists public.accounts (
  id uuid primary key default gen_random_uuid(),

  user_id uuid not null
    default auth.uid()
    references public.profiles(id)
    on delete cascade,

  name text not null
    check (
      char_length(trim(name))
      between 1 and 80
    ),

  type text not null
    default 'wallet'
    check (
      type in (
        'wallet',
        'bank',
        'cash',
        'other'
      )
    ),

  opening_balance numeric(14, 2) not null
    default 0
    check (opening_balance >= 0),

  notes text,

  is_active boolean not null
    default true,

  created_at timestamptz not null
    default now(),

  updated_at timestamptz not null
    default now()
);

create unique index if not exists
  accounts_user_lower_name_unique
on public.accounts (
  user_id,
  lower(trim(name))
);

create index if not exists
  accounts_user_active_idx
on public.accounts (
  user_id,
  is_active
);

create or replace function
public.normalize_account_record()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.name :=
    trim(new.name);

  new.notes :=
    nullif(
      trim(
        coalesce(
          new.notes,
          ''
        )
      ),
      ''
    );

  return new;
end;
$$;

drop trigger if exists
  accounts_normalize_record
on public.accounts;

create trigger
  accounts_normalize_record
before insert or update
on public.accounts
for each row
execute function
  public.normalize_account_record();

drop trigger if exists
  accounts_set_updated_at
on public.accounts;

create trigger
  accounts_set_updated_at
before update
on public.accounts
for each row
execute function
  public.set_updated_at();


-- ============================================================
-- CUENTA OPCIONAL EN INGRESOS / GASTOS
-- ============================================================

alter table public.transactions
  add column if not exists
    account_id uuid;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname =
      'transactions_account_id_fkey'
  ) then
    alter table public.transactions
      add constraint
        transactions_account_id_fkey
      foreign key (account_id)
      references public.accounts(id)
      on delete restrict;
  end if;
end;
$$;

create index if not exists
  transactions_user_account_date_idx
on public.transactions (
  user_id,
  account_id,
  date
)
where account_id is not null;


-- ============================================================
-- VALIDAR QUE LA CUENTA PERTENEZCA AL MISMO USUARIO
-- ============================================================

create or replace function
public.validate_transaction_account()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.account_id is null then
    return new;
  end if;

  if not exists (
    select 1
    from public.accounts
    where
      id = new.account_id
      and user_id = new.user_id
  ) then
    raise exception
      using
        errcode = '42501',
        message =
          'ACCOUNT_NOT_FOUND_OR_NOT_OWNED';
  end if;

  return new;
end;
$$;

drop trigger if exists
  transactions_validate_account
on public.transactions;

create trigger
  transactions_validate_account
before insert or update of
  account_id,
  user_id
on public.transactions
for each row
execute function
  public.validate_transaction_account();


-- ============================================================
-- RPC PARA COMPLETAR LA ASIGNACIÓN DE CUENTA
-- EN LA SINCRONIZACIÓN OFFLINE
-- ============================================================

create or replace function
public.set_transaction_account(
  p_transaction_id uuid,
  p_account_id uuid default null
)
returns public.transactions
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid;
  v_transaction
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

  select *
  into v_transaction
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

  if
    p_account_id is not null
    and not exists (
      select 1
      from public.accounts
      where
        id = p_account_id
        and user_id = v_user_id
    )
  then
    raise exception
      using
        errcode = '42501',
        message =
          'ACCOUNT_NOT_FOUND_OR_NOT_OWNED';
  end if;

  update public.transactions
  set
    account_id = p_account_id
  where
    id = p_transaction_id
    and user_id = v_user_id
  returning *
  into v_transaction;

  return v_transaction;
end;
$$;


-- ============================================================
-- RLS
-- ============================================================

alter table public.accounts
  enable row level security;

drop policy if exists
  accounts_select_own
on public.accounts;

create policy
  accounts_select_own
on public.accounts
for select
to authenticated
using (
  auth.uid() = user_id
);

drop policy if exists
  accounts_insert_own
on public.accounts;

create policy
  accounts_insert_own
on public.accounts
for insert
to authenticated
with check (
  auth.uid() = user_id
  and public.is_active_user()
);

drop policy if exists
  accounts_update_own
on public.accounts;

create policy
  accounts_update_own
on public.accounts
for update
to authenticated
using (
  auth.uid() = user_id
  and public.is_active_user()
)
with check (
  auth.uid() = user_id
  and public.is_active_user()
);

drop policy if exists
  accounts_delete_own
on public.accounts;

create policy
  accounts_delete_own
on public.accounts
for delete
to authenticated
using (
  auth.uid() = user_id
  and public.is_active_user()
);


-- ============================================================
-- PERMISOS
-- ============================================================

grant
  select,
  insert,
  update,
  delete
on public.accounts
to authenticated;

revoke all
on function
public.set_transaction_account(
  uuid,
  uuid
)
from public;

grant execute
on function
public.set_transaction_account(
  uuid,
  uuid
)
to authenticated;

commit;
