begin;

-- ============================================================
-- MONEYTRACK
-- 014 - Suscripciones para notificaciones Push
-- ============================================================
--
-- Esta tabla NO contiene recordatorios.
-- Guarda únicamente la suscripción Web Push de cada navegador
-- o dispositivo para poder enviar avisos aunque MoneyTrack
-- no esté abierto.
--
-- IMPORTANTE:
-- El endpoint es UNIQUE de forma global.
-- Si el mismo navegador inicia sesión con otra cuenta,
-- save_my_push_subscription() transfiere esa suscripción
-- a la cuenta actualmente autenticada. Esto evita que un
-- dispositivo termine recibiendo avisos de dos usuarios.
-- ============================================================

-- ============================================================
-- 1. TABLA DE SUSCRIPCIONES PUSH
-- ============================================================

create table if not exists public.push_subscriptions (
  id uuid primary key
    default gen_random_uuid(),

  user_id uuid not null
    references public.profiles(id)
    on delete cascade,

  endpoint text not null,

  p256dh text not null
    check (
      char_length(trim(p256dh)) > 0
    ),

  auth text not null
    check (
      char_length(trim(auth)) > 0
    ),

  user_agent text,

  platform text,

  is_active boolean not null
    default true,

  last_seen_at timestamptz not null
    default now(),

  created_at timestamptz not null
    default now(),

  updated_at timestamptz not null
    default now(),

  constraint push_subscriptions_endpoint_not_blank
    check (
      char_length(trim(endpoint)) > 0
    )
);

-- Un endpoint Web Push debe pertenecer a una sola cuenta.
create unique index if not exists
  push_subscriptions_endpoint_unique
on public.push_subscriptions(endpoint);

create index if not exists
  push_subscriptions_user_id_idx
on public.push_subscriptions(user_id);

create index if not exists
  push_subscriptions_user_active_idx
on public.push_subscriptions(
  user_id,
  is_active
);

-- ============================================================
-- 2. UPDATED_AT AUTOMÁTICO
-- ============================================================

drop trigger if exists
  push_subscriptions_set_updated_at
on public.push_subscriptions;

create trigger
  push_subscriptions_set_updated_at
before update
on public.push_subscriptions
for each row
execute function public.set_updated_at();

-- ============================================================
-- 3. ROW LEVEL SECURITY
-- ============================================================

alter table public.push_subscriptions
enable row level security;

drop policy if exists
  "Users can read own push subscriptions"
on public.push_subscriptions;

create policy
  "Users can read own push subscriptions"
on public.push_subscriptions
for select
to authenticated
using (
  auth.uid() = user_id
);

drop policy if exists
  "Users can delete own push subscriptions"
on public.push_subscriptions;

create policy
  "Users can delete own push subscriptions"
on public.push_subscriptions
for delete
to authenticated
using (
  auth.uid() = user_id
);

-- No damos INSERT/UPDATE directo desde el frontend.
-- Las altas y actualizaciones pasan por la función segura
-- save_my_push_subscription() definida más abajo.

-- ============================================================
-- 4. GUARDAR / ACTUALIZAR LA SUSCRIPCIÓN DEL DISPOSITIVO
-- ============================================================

create or replace function
  public.save_my_push_subscription(
    p_endpoint text,
    p_p256dh text,
    p_auth text,
    p_user_agent text default null,
    p_platform text default null
  )
returns public.push_subscriptions
language plpgsql
security definer
set search_path = ''
as $$
declare
  current_user_id uuid;
  saved_subscription public.push_subscriptions%rowtype;
begin
  current_user_id := auth.uid();

  if current_user_id is null then
    raise exception
      using
        errcode = '42501',
        message = 'NOT_AUTHENTICATED';
  end if;

  if not public.is_active_user() then
    raise exception
      using
        errcode = '42501',
        message = 'ACCOUNT_BLOCKED';
  end if;

  if nullif(trim(p_endpoint), '') is null then
    raise exception
      using
        errcode = '22023',
        message = 'INVALID_PUSH_ENDPOINT';
  end if;

  if nullif(trim(p_p256dh), '') is null then
    raise exception
      using
        errcode = '22023',
        message = 'INVALID_PUSH_P256DH';
  end if;

  if nullif(trim(p_auth), '') is null then
    raise exception
      using
        errcode = '22023',
        message = 'INVALID_PUSH_AUTH';
  end if;

  insert into public.push_subscriptions (
    user_id,
    endpoint,
    p256dh,
    auth,
    user_agent,
    platform,
    is_active,
    last_seen_at
  )
  values (
    current_user_id,
    trim(p_endpoint),
    trim(p_p256dh),
    trim(p_auth),
    nullif(trim(p_user_agent), ''),
    nullif(trim(p_platform), ''),
    true,
    now()
  )
  on conflict (endpoint)
  do update
  set
    user_id = excluded.user_id,
    p256dh = excluded.p256dh,
    auth = excluded.auth,
    user_agent = excluded.user_agent,
    platform = excluded.platform,
    is_active = true,
    last_seen_at = now()
  returning *
  into saved_subscription;

  return saved_subscription;
end;
$$;

-- ============================================================
-- 5. ELIMINAR LA SUSCRIPCIÓN DEL DISPOSITIVO ACTUAL
-- ============================================================

create or replace function
  public.remove_my_push_subscription(
    p_endpoint text
  )
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  deleted_count integer;
begin
  if auth.uid() is null then
    raise exception
      using
        errcode = '42501',
        message = 'NOT_AUTHENTICATED';
  end if;

  if nullif(trim(p_endpoint), '') is null then
    return true;
  end if;

  delete from public.push_subscriptions
  where user_id = auth.uid()
    and endpoint = trim(p_endpoint);

  get diagnostics
    deleted_count = row_count;

  -- Lo tratamos como idempotente:
  -- si ya no existía, el resultado deseado igualmente se cumple.
  return true;
end;
$$;

-- ============================================================
-- 6. PERMISOS
-- ============================================================

revoke all
on function public.save_my_push_subscription(
  text,
  text,
  text,
  text,
  text
)
from public;

grant execute
on function public.save_my_push_subscription(
  text,
  text,
  text,
  text,
  text
)
to authenticated;

revoke all
on function public.remove_my_push_subscription(text)
from public;

grant execute
on function public.remove_my_push_subscription(text)
to authenticated;

commit;
