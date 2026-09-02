-- ============================================================
-- MONEYTRACK
-- 006 - Corregir límite mensual para usar horario de Argentina
-- ============================================================

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
  month_start timestamptz;
  month_end timestamptz;
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

  month_start :=
    (
      date_trunc(
        'month',
        now() at time zone
          'America/Argentina/Buenos_Aires'
      )
      at time zone
        'America/Argentina/Buenos_Aires'
    );

  month_end :=
    (
      (
        date_trunc(
          'month',
          now() at time zone
            'America/Argentina/Buenos_Aires'
        )
        + interval '1 month'
      )
      at time zone
        'America/Argentina/Buenos_Aires'
    );

  select count(*)
  into current_month_usage
  from public.transactions
  where user_id = new.user_id
    and created_at >= month_start
    and created_at < month_end;

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
  with month_bounds as (
    select
      (
        date_trunc(
          'month',
          now() at time zone
            'America/Argentina/Buenos_Aires'
        )
        at time zone
          'America/Argentina/Buenos_Aires'
      ) as month_start,

      (
        (
          date_trunc(
            'month',
            now() at time zone
              'America/Argentina/Buenos_Aires'
          )
          + interval '1 month'
        )
        at time zone
          'America/Argentina/Buenos_Aires'
      ) as month_end
  ),

  account_data as (
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
    select
      count(*)::bigint as movement_count
    from public.transactions
    cross join month_bounds
    where user_id = auth.uid()
      and created_at >= month_bounds.month_start
      and created_at < month_bounds.month_end
  )

  select
    usage_data.movement_count as used,

    account_data.monthly_limit as movement_limit,

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

    account_data.has_premium as is_premium,

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
