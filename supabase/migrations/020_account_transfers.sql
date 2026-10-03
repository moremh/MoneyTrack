begin;

-- ============================================================
-- MONEYTRACK
-- 020 - Transferencias entre cuentas
-- ============================================================

create table if not exists public.account_transfers (
  id uuid primary key
    default gen_random_uuid(),

  user_id uuid not null
    default auth.uid()
    references public.profiles(id)
    on delete cascade,

  from_account_id uuid not null
    references public.accounts(id)
    on delete restrict,

  to_account_id uuid not null
    references public.accounts(id)
    on delete restrict,

  amount numeric(14, 2) not null
    check (amount > 0),

  transfer_date date not null
    default current_date,

  notes text,

  created_at timestamptz not null
    default now(),

  updated_at timestamptz not null
    default now(),

  constraint account_transfers_distinct_accounts
    check (
      from_account_id <>
      to_account_id
    )
);

create index if not exists
  account_transfers_user_date_idx
on public.account_transfers (
  user_id,
  transfer_date desc
);

create index if not exists
  account_transfers_from_idx
on public.account_transfers (
  user_id,
  from_account_id
);

create index if not exists
  account_transfers_to_idx
on public.account_transfers (
  user_id,
  to_account_id
);


-- ============================================================
-- NORMALIZACIÓN + VALIDACIÓN
-- ============================================================

create or replace function
public.prepare_account_transfer()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  v_today date;
begin
  if new.user_id is null then
    new.user_id :=
      auth.uid();
  end if;

  if new.from_account_id =
     new.to_account_id
  then
    raise exception
      using
        errcode = '23514',
        message =
          'TRANSFER_SAME_ACCOUNT';
  end if;

  if
    new.amount is null
    or new.amount <= 0
  then
    raise exception
      using
        errcode = '23514',
        message =
          'INVALID_TRANSFER_AMOUNT';
  end if;

  v_today :=
    (
      now()
      at time zone
      'America/Argentina/Buenos_Aires'
    )::date;

  if new.transfer_date is null then
    new.transfer_date :=
      v_today;
  end if;

  if new.transfer_date > v_today then
    raise exception
      using
        errcode = '23514',
        message =
          'FUTURE_TRANSFER_DATE';
  end if;

  if not exists (
    select 1
    from public.accounts
    where
      id = new.from_account_id
      and user_id = new.user_id
  ) then
    raise exception
      using
        errcode = '42501',
        message =
          'TRANSFER_FROM_ACCOUNT_NOT_OWNED';
  end if;

  if not exists (
    select 1
    from public.accounts
    where
      id = new.to_account_id
      and user_id = new.user_id
  ) then
    raise exception
      using
        errcode = '42501',
        message =
          'TRANSFER_TO_ACCOUNT_NOT_OWNED';
  end if;

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
  account_transfers_prepare
on public.account_transfers;

create trigger
  account_transfers_prepare
before insert or update
on public.account_transfers
for each row
execute function
  public.prepare_account_transfer();

drop trigger if exists
  account_transfers_set_updated_at
on public.account_transfers;

create trigger
  account_transfers_set_updated_at
before update
on public.account_transfers
for each row
execute function
  public.set_updated_at();


-- ============================================================
-- RLS
-- ============================================================

alter table public.account_transfers
  enable row level security;

drop policy if exists
  account_transfers_select_own
on public.account_transfers;

create policy
  account_transfers_select_own
on public.account_transfers
for select
to authenticated
using (
  auth.uid() = user_id
);

drop policy if exists
  account_transfers_insert_own
on public.account_transfers;

create policy
  account_transfers_insert_own
on public.account_transfers
for insert
to authenticated
with check (
  auth.uid() = user_id
  and public.is_active_user()
);

drop policy if exists
  account_transfers_update_own
on public.account_transfers;

create policy
  account_transfers_update_own
on public.account_transfers
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
  account_transfers_delete_own
on public.account_transfers;

create policy
  account_transfers_delete_own
on public.account_transfers
for delete
to authenticated
using (
  auth.uid() = user_id
  and public.is_active_user()
);

grant
  select,
  insert,
  update,
  delete
on public.account_transfers
to authenticated;

commit;
