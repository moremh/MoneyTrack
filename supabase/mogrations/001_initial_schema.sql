begin;

-- =========================================================
-- MONEYTRACK - MIGRACIÓN INICIAL
-- =========================================================

create extension if not exists pgcrypto
with schema extensions;

-- =========================================================
-- 1. TABLA DE PERFILES
-- =========================================================

create table public.profiles (
  id uuid primary key
    references auth.users(id)
    on delete cascade,

  name text not null
    default 'Usuario'
    check (char_length(trim(name)) between 1 and 100),

  email text,

  role text not null
    default 'user'
    check (role in ('user', 'admin')),

  account_status text not null
    default 'active'
    check (account_status in ('active', 'blocked')),

  currency text not null
    default 'ARS'
    check (char_length(currency) = 3),

  theme text not null
    default 'system'
    check (theme in ('light', 'dark', 'system')),

  created_at timestamptz not null
    default now(),

  updated_at timestamptz not null
    default now()
);

create unique index profiles_email_unique
on public.profiles (lower(email))
where email is not null;

create index profiles_role_idx
on public.profiles (role);

create index profiles_account_status_idx
on public.profiles (account_status);

-- =========================================================
-- 2. SUSCRIPCIONES
-- =========================================================

create table public.subscriptions (
  id uuid primary key
    default gen_random_uuid(),

  user_id uuid not null unique
    references public.profiles(id)
    on delete cascade,

  plan text not null
    default 'free'
    check (plan in ('free', 'premium')),

  billing_cycle text
    check (
      billing_cycle is null
      or billing_cycle in ('monthly', 'annual')
    ),

  premium_status text not null
    default 'inactive'
    check (
      premium_status in (
        'inactive',
        'active',
        'expired'
      )
    ),

  monthly_limit integer not null
    default 100
    check (monthly_limit > 0),

  premium_activated_at timestamptz,

  premium_expires_at timestamptz,

  last_payment_amount numeric(14, 2) not null
    default 0
    check (last_payment_amount >= 0),

  last_payment_at timestamptz,

  created_at timestamptz not null
    default now(),

  updated_at timestamptz not null
    default now(),

  constraint subscriptions_plan_data_check
    check (
      (
        plan = 'free'
        and billing_cycle is null
      )
      or
      (
        plan = 'premium'
        and billing_cycle in ('monthly', 'annual')
      )
    )
);

create index subscriptions_plan_idx
on public.subscriptions (plan);

create index subscriptions_status_idx
on public.subscriptions (premium_status);

create index subscriptions_expiration_idx
on public.subscriptions (premium_expires_at);

-- =========================================================
-- 3. CATEGORÍAS
-- =========================================================

create table public.categories (
  id uuid primary key
    default gen_random_uuid(),

  user_id uuid not null
    default auth.uid()
    references public.profiles(id)
    on delete cascade,

  name text not null
    check (char_length(trim(name)) between 1 and 60),

  type text not null
    check (type in ('income', 'expense')),

  color text,

  icon text,

  is_default boolean not null
    default false,

  created_at timestamptz not null
    default now(),

  updated_at timestamptz not null
    default now()
);

create unique index categories_user_type_name_unique
on public.categories (
  user_id,
  type,
  lower(name)
);

create index categories_user_id_idx
on public.categories (user_id);

create index categories_type_idx
on public.categories (type);

-- =========================================================
-- 4. TRANSACCIONES
-- =========================================================

create table public.transactions (
  id uuid primary key
    default gen_random_uuid(),

  user_id uuid not null
    default auth.uid()
    references public.profiles(id)
    on delete cascade,

  type text not null
    check (type in ('income', 'expense')),

  description text not null
    check (
      char_length(trim(description))
      between 1 and 200
    ),

  amount numeric(14, 2) not null
    check (amount > 0),

  category_id uuid
    references public.categories(id)
    on delete set null,

  category_name text not null
    default 'General'
    check (
      char_length(trim(category_name))
      between 1 and 60
    ),

  date date not null
    default current_date,

  created_at timestamptz not null
    default now(),

  updated_at timestamptz not null
    default now()
);

create index transactions_user_id_idx
on public.transactions (user_id);

create index transactions_user_type_idx
on public.transactions (user_id, type);

create index transactions_user_date_idx
on public.transactions (user_id, date desc);

create index transactions_user_created_at_idx
on public.transactions (user_id, created_at desc);

create index transactions_category_id_idx
on public.transactions (category_id);

-- =========================================================
-- 5. OBJETIVOS
-- =========================================================

create table public.goals (
  id uuid primary key
    default gen_random_uuid(),

  user_id uuid not null
    default auth.uid()
    references public.profiles(id)
    on delete cascade,

  name text not null
    check (
      char_length(trim(name))
      between 1 and 120
    ),

  description text,

  target_amount numeric(14, 2) not null
    check (target_amount > 0),

  current_amount numeric(14, 2) not null
    default 0
    check (current_amount >= 0),

  deadline date,

  status text not null
    default 'active'
    check (
      status in (
        'active',
        'completed',
        'paused'
      )
    ),

  created_at timestamptz not null
    default now(),

  updated_at timestamptz not null
    default now()
);

create index goals_user_id_idx
on public.goals (user_id);

create index goals_user_status_idx
on public.goals (user_id, status);

create index goals_deadline_idx
on public.goals (deadline);

-- =========================================================
-- 6. PAGOS
-- =========================================================

create table public.payments (
  id uuid primary key
    default gen_random_uuid(),

  user_id uuid not null
    references public.profiles(id)
    on delete cascade,

  subscription_id uuid not null
    references public.subscriptions(id)
    on delete cascade,

  plan_type text not null
    check (plan_type in ('monthly', 'annual')),

  amount numeric(14, 2) not null
    check (amount >= 0),

  status text not null
    default 'approved'
    check (
      status in (
        'pending',
        'approved',
        'rejected',
        'refunded'
      )
    ),

  payment_date timestamptz not null
    default now(),

  period_start_at timestamptz not null,

  period_end_at timestamptz not null,

  note text,

  created_by uuid
    references public.profiles(id)
    on delete set null,

  created_at timestamptz not null
    default now()
);

create index payments_user_id_idx
on public.payments (user_id);

create index payments_subscription_id_idx
on public.payments (subscription_id);

create index payments_payment_date_idx
on public.payments (payment_date desc);

-- =========================================================
-- 7. NOTAS ADMINISTRATIVAS
-- =========================================================

create table public.admin_notes (
  id uuid primary key
    default gen_random_uuid(),

  user_id uuid not null
    references public.profiles(id)
    on delete cascade,

  note text not null
    check (
      char_length(trim(note))
      between 1 and 1000
    ),

  created_by uuid not null
    references public.profiles(id)
    on delete cascade,

  created_at timestamptz not null
    default now()
);

create index admin_notes_user_id_idx
on public.admin_notes (user_id);

create index admin_notes_created_at_idx
on public.admin_notes (created_at desc);

-- =========================================================
-- 8. FUNCIÓN GENERAL PARA UPDATED_AT
-- =========================================================

create or replace function public.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger profiles_set_updated_at
before update on public.profiles
for each row
execute function public.set_updated_at();

create trigger subscriptions_set_updated_at
before update on public.subscriptions
for each row
execute function public.set_updated_at();

create trigger categories_set_updated_at
before update on public.categories
for each row
execute function public.set_updated_at();

create trigger transactions_set_updated_at
before update on public.transactions
for each row
execute function public.set_updated_at();

create trigger goals_set_updated_at
before update on public.goals
for each row
execute function public.set_updated_at();

-- =========================================================
-- 9. FUNCIONES DE SEGURIDAD
-- =========================================================

create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.profiles
    where id = auth.uid()
      and role = 'admin'
      and account_status = 'active'
  );
$$;

create or replace function public.is_active_user()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.profiles
    where id = auth.uid()
      and account_status = 'active'
  );
$$;

revoke all
on function public.is_admin()
from public;

revoke all
on function public.is_active_user()
from public;

grant execute
on function public.is_admin()
to authenticated;

grant execute
on function public.is_active_user()
to authenticated;

-- =========================================================
-- 10. CREAR PERFIL AUTOMÁTICAMENTE AL REGISTRARSE
-- =========================================================

create or replace function public.handle_new_auth_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  generated_name text;
begin
  generated_name := coalesce(
    nullif(
      trim(new.raw_user_meta_data ->> 'name'),
      ''
    ),
    nullif(
      split_part(
        coalesce(new.email, ''),
        '@',
        1
      ),
      ''
    ),
    'Usuario'
  );

  insert into public.profiles (
    id,
    name,
    email,
    role,
    account_status,
    currency,
    theme
  )
  values (
    new.id,
    generated_name,
    new.email,
    'user',
    'active',
    'ARS',
    'system'
  )
  on conflict (id) do nothing;

  insert into public.subscriptions (
    user_id,
    plan,
    billing_cycle,
    premium_status,
    monthly_limit
  )
  values (
    new.id,
    'free',
    null,
    'inactive',
    100
  )
  on conflict (user_id) do nothing;

  insert into public.categories (
    user_id,
    name,
    type,
    color,
    icon,
    is_default
  )
  values
    (
      new.id,
      'Sueldo',
      'income',
      '#22c55e',
      'bi bi-cash-stack',
      true
    ),
    (
      new.id,
      'Freelance',
      'income',
      '#2563eb',
      'bi bi-laptop',
      true
    ),
    (
      new.id,
      'Inversiones',
      'income',
      '#8b5cf6',
      'bi bi-graph-up-arrow',
      true
    ),
    (
      new.id,
      'Otros ingresos',
      'income',
      '#64748b',
      'bi bi-plus-circle',
      true
    ),
    (
      new.id,
      'Alimentación',
      'expense',
      '#ef4444',
      'bi bi-basket',
      true
    ),
    (
      new.id,
      'Transporte',
      'expense',
      '#f59e0b',
      'bi bi-bus-front',
      true
    ),
    (
      new.id,
      'Servicios',
      'expense',
      '#06b6d4',
      'bi bi-receipt',
      true
    ),
    (
      new.id,
      'Entretenimiento',
      'expense',
      '#ec4899',
      'bi bi-controller',
      true
    ),
    (
      new.id,
      'Salud',
      'expense',
      '#14b8a6',
      'bi bi-heart-pulse',
      true
    ),
    (
      new.id,
      'Educación',
      'expense',
      '#6366f1',
      'bi bi-book',
      true
    ),
    (
      new.id,
      'Otros gastos',
      'expense',
      '#64748b',
      'bi bi-three-dots',
      true
    )
  on conflict do nothing;

  return new;
end;
$$;

drop trigger if exists
on_auth_user_created
on auth.users;

create trigger on_auth_user_created
after insert on auth.users
for each row
execute function public.handle_new_auth_user();

-- =========================================================
-- 11. SINCRONIZAR EL CORREO DEL PERFIL
-- =========================================================

create or replace function public.handle_auth_email_update()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.email is distinct from old.email then
    update public.profiles
    set email = new.email
    where id = new.id;
  end if;

  return new;
end;
$$;

drop trigger if exists
on_auth_user_email_updated
on auth.users;

create trigger on_auth_user_email_updated
after update of email
on auth.users
for each row
execute function public.handle_auth_email_update();

-- =========================================================
-- 12. VALIDAR CATEGORÍA DE TRANSACCIÓN
-- =========================================================

create or replace function public.set_transaction_category()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  selected_category public.categories%rowtype;
begin
  if new.category_id is null then
    new.category_name := coalesce(
      nullif(trim(new.category_name), ''),
      'General'
    );

    return new;
  end if;

  select *
  into selected_category
  from public.categories
  where id = new.category_id;

  if not found then
    raise exception
      using
        errcode = '23503',
        message = 'CATEGORY_NOT_FOUND';
  end if;

  if selected_category.user_id <> new.user_id then
    raise exception
      using
        errcode = '42501',
        message = 'CATEGORY_NOT_OWNED_BY_USER';
  end if;

  if selected_category.type <> new.type then
    raise exception
      using
        errcode = '23514',
        message = 'CATEGORY_TYPE_MISMATCH';
  end if;

  new.category_name := selected_category.name;

  return new;
end;
$$;

create trigger a_transactions_set_category
before insert or update of category_id, type
on public.transactions
for each row
execute function public.set_transaction_category();

-- =========================================================
-- 13. APLICAR LÍMITE MENSUAL DESDE LA BASE
-- =========================================================

create or replace function public.enforce_monthly_transaction_limit()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  account_record record;
  current_month_usage bigint;
  has_active_premium boolean;
begin
  if auth.uid() is null then
    raise exception
      using
        errcode = '42501',
        message = 'AUTHENTICATION_REQUIRED';
  end if;

  if (
    new.user_id <> auth.uid()
    and not public.is_admin()
  ) then
    raise exception
      using
        errcode = '42501',
        message = 'USER_ID_NOT_ALLOWED';
  end if;

  select
    profiles.role,
    profiles.account_status,
    subscriptions.plan,
    subscriptions.premium_status,
    subscriptions.monthly_limit,
    subscriptions.premium_expires_at
  into account_record
  from public.profiles
  inner join public.subscriptions
    on subscriptions.user_id = profiles.id
  where profiles.id = new.user_id;

  if not found then
    raise exception
      using
        errcode = 'P0001',
        message = 'ACCOUNT_NOT_FOUND';
  end if;

  if account_record.account_status <> 'active' then
    raise exception
      using
        errcode = '42501',
        message = 'ACCOUNT_BLOCKED';
  end if;

  if account_record.role = 'admin' then
    return new;
  end if;

  has_active_premium :=
    account_record.plan = 'premium'
    and account_record.premium_status = 'active'
    and account_record.premium_expires_at is not null
    and account_record.premium_expires_at > now();

  if has_active_premium then
    return new;
  end if;

  select count(*)
  into current_month_usage
  from public.transactions
  where user_id = new.user_id
    and created_at >= date_trunc('month', now())
    and created_at <
      date_trunc('month', now())
      + interval '1 month';

  if (
    current_month_usage
    >= account_record.monthly_limit
  ) then
    raise exception
      using
        errcode = 'P0001',
        message = 'FREE_LIMIT_REACHED',
        detail =
          'El usuario alcanzó el límite mensual de movimientos.';
  end if;

  return new;
end;
$$;

create trigger b_transactions_enforce_limit
before insert
on public.transactions
for each row
execute function public.enforce_monthly_transaction_limit();

-- =========================================================
-- 14. REFRESCAR PREMIUM VENCIDO DEL USUARIO ACTUAL
-- =========================================================

create or replace function public.refresh_my_subscription()
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if auth.uid() is null then
    raise exception
      using
        errcode = '42501',
        message = 'AUTHENTICATION_REQUIRED';
  end if;

  update public.subscriptions
  set
    plan = 'free',
    billing_cycle = null,
    premium_status = 'expired'
  where user_id = auth.uid()
    and plan = 'premium'
    and premium_expires_at is not null
    and premium_expires_at <= now();
end;
$$;

revoke all
on function public.refresh_my_subscription()
from public;

grant execute
on function public.refresh_my_subscription()
to authenticated;

-- =========================================================
-- 15. USO MENSUAL DEL USUARIO ACTUAL
-- =========================================================

create or replace function public.get_my_movement_usage()
returns table (
  used bigint,
  movement_limit integer,
  remaining bigint,
  percentage numeric,
  is_premium boolean,
  has_reached_limit boolean
)
language sql
stable
security definer
set search_path = ''
as $$
  with account_data as (
    select
      profiles.role,
      subscriptions.monthly_limit,
      (
        profiles.role = 'admin'
        or (
          subscriptions.plan = 'premium'
          and subscriptions.premium_status = 'active'
          and subscriptions.premium_expires_at is not null
          and subscriptions.premium_expires_at > now()
        )
      ) as has_premium
    from public.profiles
    inner join public.subscriptions
      on subscriptions.user_id = profiles.id
    where profiles.id = auth.uid()
  ),
  usage_data as (
    select count(*)::bigint as movement_count
    from public.transactions
    where user_id = auth.uid()
      and created_at >= date_trunc('month', now())
      and created_at <
        date_trunc('month', now())
        + interval '1 month'
  )
  select
    usage_data.movement_count as used,

    account_data.monthly_limit
      as movement_limit,

    case
      when account_data.has_premium then null
      else greatest(
        account_data.monthly_limit
          - usage_data.movement_count,
        0
      )
    end::bigint as remaining,

    case
      when account_data.has_premium then 0
      else least(
        round(
          (
            usage_data.movement_count::numeric
            / account_data.monthly_limit
          ) * 100,
          0
        ),
        100
      )
    end as percentage,

    account_data.has_premium
      as is_premium,

    case
      when account_data.has_premium then false
      else
        usage_data.movement_count
        >= account_data.monthly_limit
    end as has_reached_limit

  from account_data
  cross join usage_data;
$$;

revoke all
on function public.get_my_movement_usage()
from public;

grant execute
on function public.get_my_movement_usage()
to authenticated;

-- =========================================================
-- 16. FUNCIONES ADMINISTRATIVAS
-- =========================================================

create or replace function public.admin_activate_premium(
  target_user_id uuid,
  selected_billing_cycle text,
  payment_amount numeric,
  payment_note text default ''
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  selected_subscription public.subscriptions%rowtype;
  selected_profile public.profiles%rowtype;

  current_time timestamptz := now();
  period_start timestamptz;
  period_end timestamptz;
  subscription_interval interval;
begin
  if not public.is_admin() then
    raise exception
      using
        errcode = '42501',
        message = 'ADMIN_REQUIRED';
  end if;

  if selected_billing_cycle not in (
    'monthly',
    'annual'
  ) then
    raise exception
      using
        errcode = '22023',
        message = 'INVALID_BILLING_CYCLE';
  end if;

  if payment_amount is null or payment_amount < 0 then
    raise exception
      using
        errcode = '22023',
        message = 'INVALID_PAYMENT_AMOUNT';
  end if;

  select *
  into selected_profile
  from public.profiles
  where id = target_user_id;

  if not found then
    raise exception
      using
        errcode = 'P0001',
        message = 'USER_NOT_FOUND';
  end if;

  if selected_profile.role = 'admin' then
    raise exception
      using
        errcode = '42501',
        message = 'ADMIN_ACCOUNT_CANNOT_BE_MODIFIED';
  end if;

  select *
  into selected_subscription
  from public.subscriptions
  where user_id = target_user_id
  for update;

  if not found then
    raise exception
      using
        errcode = 'P0001',
        message = 'SUBSCRIPTION_NOT_FOUND';
  end if;

  subscription_interval :=
    case
      when selected_billing_cycle = 'annual'
        then interval '12 months'
      else interval '1 month'
    end;

  period_start :=
    case
      when
        selected_subscription.plan = 'premium'
        and selected_subscription.premium_status = 'active'
        and selected_subscription.premium_expires_at
          is not null
        and selected_subscription.premium_expires_at
          > current_time
      then
        selected_subscription.premium_expires_at
      else
        current_time
    end;

  period_end :=
    period_start + subscription_interval;

  update public.subscriptions
  set
    plan = 'premium',
    billing_cycle = selected_billing_cycle,
    premium_status = 'active',

    premium_activated_at =
      case
        when
          selected_subscription.plan = 'premium'
          and selected_subscription.premium_status = 'active'
          and selected_subscription.premium_expires_at
            > current_time
          and selected_subscription.premium_activated_at
            is not null
        then
          selected_subscription.premium_activated_at
        else
          current_time
      end,

    premium_expires_at = period_end,
    last_payment_amount = payment_amount,
    last_payment_at = current_time

  where user_id = target_user_id;

  insert into public.payments (
    user_id,
    subscription_id,
    plan_type,
    amount,
    status,
    payment_date,
    period_start_at,
    period_end_at,
    note,
    created_by
  )
  values (
    target_user_id,
    selected_subscription.id,
    selected_billing_cycle,
    payment_amount,
    'approved',
    current_time,
    period_start,
    period_end,
    nullif(trim(payment_note), ''),
    auth.uid()
  );

  if nullif(trim(payment_note), '') is not null then
    insert into public.admin_notes (
      user_id,
      note,
      created_by
    )
    values (
      target_user_id,
      trim(payment_note),
      auth.uid()
    );
  end if;

  return jsonb_build_object(
    'success', true,
    'message',
      case
        when selected_billing_cycle = 'annual'
          then 'Premium anual activado correctamente.'
        else 'Premium mensual activado correctamente.'
      end,
    'expiresAt', period_end
  );
end;
$$;

create or replace function public.admin_remove_premium(
  target_user_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not public.is_admin() then
    raise exception
      using
        errcode = '42501',
        message = 'ADMIN_REQUIRED';
  end if;

  if exists (
    select 1
    from public.profiles
    where id = target_user_id
      and role = 'admin'
  ) then
    raise exception
      using
        errcode = '42501',
        message = 'ADMIN_ACCOUNT_CANNOT_BE_MODIFIED';
  end if;

  update public.subscriptions
  set
    plan = 'free',
    billing_cycle = null,
    premium_status = 'inactive',
    premium_activated_at = null,
    premium_expires_at = null
  where user_id = target_user_id;

  if not found then
    raise exception
      using
        errcode = 'P0001',
        message = 'USER_NOT_FOUND';
  end if;

  return jsonb_build_object(
    'success', true,
    'message', 'El plan Premium fue retirado.'
  );
end;
$$;

create or replace function public.admin_toggle_account_status(
  target_user_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  new_status text;
begin
  if not public.is_admin() then
    raise exception
      using
        errcode = '42501',
        message = 'ADMIN_REQUIRED';
  end if;

  if exists (
    select 1
    from public.profiles
    where id = target_user_id
      and role = 'admin'
  ) then
    raise exception
      using
        errcode = '42501',
        message = 'ADMIN_ACCOUNT_CANNOT_BE_MODIFIED';
  end if;

  update public.profiles
  set
    account_status =
      case
        when account_status = 'blocked'
          then 'active'
        else 'blocked'
      end
  where id = target_user_id
  returning account_status
  into new_status;

  if not found then
    raise exception
      using
        errcode = 'P0001',
        message = 'USER_NOT_FOUND';
  end if;

  return jsonb_build_object(
    'success', true,
    'accountStatus', new_status,
    'message',
      case
        when new_status = 'blocked'
          then 'La cuenta fue bloqueada.'
        else 'La cuenta fue habilitada.'
      end
  );
end;
$$;

create or replace function public.admin_change_monthly_limit(
  target_user_id uuid,
  new_monthly_limit integer
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not public.is_admin() then
    raise exception
      using
        errcode = '42501',
        message = 'ADMIN_REQUIRED';
  end if;

  if new_monthly_limit is null
    or new_monthly_limit < 1
  then
    raise exception
      using
        errcode = '22023',
        message = 'INVALID_MONTHLY_LIMIT';
  end if;

  update public.subscriptions
  set monthly_limit = new_monthly_limit
  where user_id = target_user_id;

  if not found then
    raise exception
      using
        errcode = 'P0001',
        message = 'USER_NOT_FOUND';
  end if;

  return jsonb_build_object(
    'success', true,
    'message',
      'Límite mensual actualizado correctamente.',
    'monthlyLimit',
      new_monthly_limit
  );
end;
$$;

create or replace function public.admin_save_note(
  target_user_id uuid,
  note_text text
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not public.is_admin() then
    raise exception
      using
        errcode = '42501',
        message = 'ADMIN_REQUIRED';
  end if;

  if nullif(trim(note_text), '') is null then
    raise exception
      using
        errcode = '22023',
        message = 'EMPTY_ADMIN_NOTE';
  end if;

  if not exists (
    select 1
    from public.profiles
    where id = target_user_id
      and role <> 'admin'
  ) then
    raise exception
      using
        errcode = 'P0001',
        message = 'USER_NOT_FOUND';
  end if;

  insert into public.admin_notes (
    user_id,
    note,
    created_by
  )
  values (
    target_user_id,
    trim(note_text),
    auth.uid()
  );

  return jsonb_build_object(
    'success', true,
    'message', 'Nota administrativa guardada.'
  );
end;
$$;

revoke all
on function public.admin_activate_premium(
  uuid,
  text,
  numeric,
  text
)
from public;

revoke all
on function public.admin_remove_premium(uuid)
from public;

revoke all
on function public.admin_toggle_account_status(uuid)
from public;

revoke all
on function public.admin_change_monthly_limit(
  uuid,
  integer
)
from public;

revoke all
on function public.admin_save_note(
  uuid,
  text
)
from public;

grant execute
on function public.admin_activate_premium(
  uuid,
  text,
  numeric,
  text
)
to authenticated;

grant execute
on function public.admin_remove_premium(uuid)
to authenticated;

grant execute
on function public.admin_toggle_account_status(uuid)
to authenticated;

grant execute
on function public.admin_change_monthly_limit(
  uuid,
  integer
)
to authenticated;

grant execute
on function public.admin_save_note(
  uuid,
  text
)
to authenticated;

-- =========================================================
-- 17. ACTIVAR ROW LEVEL SECURITY
-- =========================================================

alter table public.profiles
enable row level security;

alter table public.subscriptions
enable row level security;

alter table public.categories
enable row level security;

alter table public.transactions
enable row level security;

alter table public.goals
enable row level security;

alter table public.payments
enable row level security;

alter table public.admin_notes
enable row level security;

-- =========================================================
-- 18. POLÍTICAS DE PROFILES
-- =========================================================

create policy profiles_select_own_or_admin
on public.profiles
for select
to authenticated
using (
  id = auth.uid()
  or public.is_admin()
);

create policy profiles_update_own
on public.profiles
for update
to authenticated
using (
  id = auth.uid()
  and public.is_active_user()
)
with check (
  id = auth.uid()
  and public.is_active_user()
);

-- =========================================================
-- 19. POLÍTICAS DE SUBSCRIPTIONS
-- =========================================================

create policy subscriptions_select_own_or_admin
on public.subscriptions
for select
to authenticated
using (
  user_id = auth.uid()
  or public.is_admin()
);

-- =========================================================
-- 20. POLÍTICAS DE CATEGORIES
-- =========================================================

create policy categories_select_own_or_admin
on public.categories
for select
to authenticated
using (
  user_id = auth.uid()
  or public.is_admin()
);

create policy categories_insert_own
on public.categories
for insert
to authenticated
with check (
  user_id = auth.uid()
  and public.is_active_user()
);

create policy categories_update_own
on public.categories
for update
to authenticated
using (
  user_id = auth.uid()
  and public.is_active_user()
)
with check (
  user_id = auth.uid()
  and public.is_active_user()
);

create policy categories_delete_own
on public.categories
for delete
to authenticated
using (
  user_id = auth.uid()
  and public.is_active_user()
);

-- =========================================================
-- 21. POLÍTICAS DE TRANSACTIONS
-- =========================================================

create policy transactions_select_own_or_admin
on public.transactions
for select
to authenticated
using (
  user_id = auth.uid()
  or public.is_admin()
);

create policy transactions_insert_own
on public.transactions
for insert
to authenticated
with check (
  user_id = auth.uid()
  and public.is_active_user()
);

create policy transactions_update_own
on public.transactions
for update
to authenticated
using (
  user_id = auth.uid()
  and public.is_active_user()
)
with check (
  user_id = auth.uid()
  and public.is_active_user()
);

create policy transactions_delete_own
on public.transactions
for delete
to authenticated
using (
  user_id = auth.uid()
  and public.is_active_user()
);

-- =========================================================
-- 22. POLÍTICAS DE GOALS
-- =========================================================

create policy goals_select_own_or_admin
on public.goals
for select
to authenticated
using (
  user_id = auth.uid()
  or public.is_admin()
);

create policy goals_insert_own
on public.goals
for insert
to authenticated
with check (
  user_id = auth.uid()
  and public.is_active_user()
);

create policy goals_update_own
on public.goals
for update
to authenticated
using (
  user_id = auth.uid()
  and public.is_active_user()
)
with check (
  user_id = auth.uid()
  and public.is_active_user()
);

create policy goals_delete_own
on public.goals
for delete
to authenticated
using (
  user_id = auth.uid()
  and public.is_active_user()
);

-- =========================================================
-- 23. POLÍTICAS DE PAYMENTS
-- =========================================================

create policy payments_select_own_or_admin
on public.payments
for select
to authenticated
using (
  user_id = auth.uid()
  or public.is_admin()
);

-- =========================================================
-- 24. POLÍTICAS DE ADMIN_NOTES
-- =========================================================

create policy admin_notes_select_admin
on public.admin_notes
for select
to authenticated
using (
  public.is_admin()
);

-- =========================================================
-- 25. PERMISOS DE TABLAS
-- =========================================================

revoke all
on table public.profiles
from anon, authenticated;

revoke all
on table public.subscriptions
from anon, authenticated;

revoke all
on table public.categories
from anon, authenticated;

revoke all
on table public.transactions
from anon, authenticated;

revoke all
on table public.goals
from anon, authenticated;

revoke all
on table public.payments
from anon, authenticated;

revoke all
on table public.admin_notes
from anon, authenticated;

grant select
on table public.profiles
to authenticated;

grant update (
  name,
  currency,
  theme
)
on public.profiles
to authenticated;

grant select
on table public.subscriptions
to authenticated;

grant select, delete
on table public.categories
to authenticated;

grant insert (
  user_id,
  name,
  type,
  color,
  icon,
  is_default
)
on public.categories
to authenticated;

grant update (
  name,
  color,
  icon
)
on public.categories
to authenticated;

grant select, delete
on table public.transactions
to authenticated;

grant insert (
  user_id,
  type,
  description,
  amount,
  category_id,
  category_name,
  date
)
on public.transactions
to authenticated;

grant update (
  type,
  description,
  amount,
  category_id,
  category_name,
  date
)
on public.transactions
to authenticated;

grant select, delete
on table public.goals
to authenticated;

grant insert (
  user_id,
  name,
  description,
  target_amount,
  current_amount,
  deadline,
  status
)
on public.goals
to authenticated;

grant update (
  name,
  description,
  target_amount,
  current_amount,
  deadline,
  status
)
on public.goals
to authenticated;

grant select
on table public.payments
to authenticated;

grant select
on table public.admin_notes
to authenticated;

-- Los triggers pueden ejecutarse sin permitir
-- que el usuario invoque directamente sus funciones.

revoke all
on function public.set_updated_at()
from public, anon, authenticated;

revoke all
on function public.handle_new_auth_user()
from public, anon, authenticated;

revoke all
on function public.handle_auth_email_update()
from public, anon, authenticated;

revoke all
on function public.set_transaction_category()
from public, anon, authenticated;

revoke all
on function public.enforce_monthly_transaction_limit()
from public, anon, authenticated;

-- Recargar el esquema de la API de Supabase.

notify pgrst, 'reload schema';

commit;