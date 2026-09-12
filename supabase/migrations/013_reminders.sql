begin;

-- ============================================================
-- MONEYTRACK
-- 013 - Recordatorios y centro de notificaciones
-- ============================================================

-- ============================================================
-- 1. TABLA DE RECORDATORIOS
-- ============================================================

create table if not exists public.reminders (
  id uuid primary key
    default gen_random_uuid(),

  user_id uuid not null
    default auth.uid()
    references public.profiles(id)
    on delete cascade,

  title text not null
    check (
      char_length(trim(title))
      between 1 and 120
    ),

  description text
    check (
      description is null
      or char_length(trim(description)) <= 1000
    ),

  type text not null
    default 'general'
    check (
      type in (
        'general',
        'payment',
        'goal',
        'custom'
      )
    ),

  reminder_date date not null,

  reminder_time time without time zone
    not null
    default time '09:00',

  timezone text not null
    default 'America/Argentina/Buenos_Aires'
    check (
      char_length(trim(timezone))
      between 1 and 100
    ),

  recurrence text not null
    default 'none'
    check (
      recurrence in (
        'none',
        'daily',
        'weekly',
        'monthly',
        'yearly'
      )
    ),

  recurrence_end_date date,

  related_goal_id uuid
    references public.goals(id)
    on delete set null,

  status text not null
    default 'pending'
    check (
      status in (
        'pending',
        'completed',
        'cancelled'
      )
    ),

  is_read boolean not null
    default false,

  notified_at timestamptz,

  completed_at timestamptz,

  created_at timestamptz not null
    default now(),

  updated_at timestamptz not null
    default now(),

  constraint reminders_recurrence_end_date_check
    check (
      recurrence_end_date is null
      or recurrence_end_date >= reminder_date
    ),

  constraint reminders_completed_at_check
    check (
      (
        status = 'completed'
        and completed_at is not null
      )
      or
      (
        status <> 'completed'
      )
    )
);

-- ============================================================
-- 2. ÍNDICES
-- ============================================================

create index if not exists
  reminders_user_id_idx
on public.reminders(user_id);

create index if not exists
  reminders_user_status_idx
on public.reminders(
  user_id,
  status
);

create index if not exists
  reminders_user_date_time_idx
on public.reminders(
  user_id,
  reminder_date,
  reminder_time
);

create index if not exists
  reminders_user_unread_idx
on public.reminders(
  user_id,
  is_read
)
where is_read = false;

create index if not exists
  reminders_related_goal_id_idx
on public.reminders(
  related_goal_id
)
where related_goal_id is not null;

-- ============================================================
-- 3. UPDATED_AT AUTOMÁTICO
-- ============================================================

drop trigger if exists
  reminders_set_updated_at
on public.reminders;

create trigger
  reminders_set_updated_at
before update
on public.reminders
for each row
execute function public.set_updated_at();

-- ============================================================
-- 4. VALIDAR QUE EL OBJETIVO PERTENEZCA AL USUARIO
-- ============================================================

create or replace function
  public.validate_reminder_goal_ownership()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.related_goal_id is null then
    return new;
  end if;

  if not exists (
    select 1
    from public.goals
    where id = new.related_goal_id
      and user_id = new.user_id
  ) then
    raise exception
      using
        errcode = '42501',
        message =
          'REMINDER_GOAL_NOT_OWNED_BY_USER';
  end if;

  return new;
end;
$$;

drop trigger if exists
  reminders_validate_goal
on public.reminders;

create trigger
  reminders_validate_goal
before insert
or update of related_goal_id, user_id
on public.reminders
for each row
execute function
  public.validate_reminder_goal_ownership();

-- ============================================================
-- 5. COMPLETED_AT CONSISTENTE CON EL ESTADO
-- ============================================================

create or replace function
  public.set_reminder_completed_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.status = 'completed' then
    new.completed_at :=
      coalesce(
        new.completed_at,
        now()
      );
  else
    new.completed_at := null;
  end if;

  return new;
end;
$$;

drop trigger if exists
  reminders_set_completed_at
on public.reminders;

create trigger
  reminders_set_completed_at
before insert
or update of status
on public.reminders
for each row
execute function
  public.set_reminder_completed_at();

-- ============================================================
-- 6. ROW LEVEL SECURITY
-- ============================================================

alter table public.reminders
enable row level security;

drop policy if exists
  "Users can read own reminders"
on public.reminders;

create policy
  "Users can read own reminders"
on public.reminders
for select
to authenticated
using (
  auth.uid() = user_id
);

drop policy if exists
  "Users can insert own reminders"
on public.reminders;

create policy
  "Users can insert own reminders"
on public.reminders
for insert
to authenticated
with check (
  auth.uid() = user_id
  and public.is_active_user()
);

drop policy if exists
  "Users can update own reminders"
on public.reminders;

create policy
  "Users can update own reminders"
on public.reminders
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
  "Users can delete own reminders"
on public.reminders;

create policy
  "Users can delete own reminders"
on public.reminders
for delete
to authenticated
using (
  auth.uid() = user_id
  and public.is_active_user()
);

-- ============================================================
-- 7. PERMISOS DE FUNCIONES AUXILIARES
-- ============================================================

revoke all
on function
  public.validate_reminder_goal_ownership()
from public;

revoke all
on function
  public.set_reminder_completed_at()
from public;

-- Son funciones de trigger.
-- No necesitan EXECUTE directo desde el frontend.

commit;
