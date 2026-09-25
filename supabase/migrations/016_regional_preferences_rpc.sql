begin;

-- =========================================================
-- MONEYTRACK - ACTUALIZACIÓN SEGURA DE PREFERENCIAS REGIONALES
-- =========================================================

create or replace function public.update_my_regional_preferences(
  p_language text,
  p_region text,
  p_currency text,
  p_timezone text,
  p_time_format text
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid;
  v_language text;
  v_region text;
  v_currency text;
  v_timezone text;
  v_time_format text;
begin
  v_user_id := auth.uid();

  if v_user_id is null then
    raise exception 'NOT_AUTHENTICATED';
  end if;

  v_language := lower(trim(coalesce(p_language, '')));
  v_region := upper(trim(coalesce(p_region, '')));
  v_currency := upper(trim(coalesce(p_currency, '')));
  v_timezone := trim(coalesce(p_timezone, ''));
  v_time_format := lower(trim(coalesce(p_time_format, '')));

  if v_language not in ('es', 'en', 'it') then
    raise exception 'INVALID_LANGUAGE';
  end if;

  if v_region !~ '^[A-Z]{2}$' then
    raise exception 'INVALID_REGION';
  end if;

  if v_currency !~ '^[A-Z]{3}$' then
    raise exception 'INVALID_CURRENCY';
  end if;

  if v_time_format not in ('12h', '24h') then
    raise exception 'INVALID_TIME_FORMAT';
  end if;

  if not exists (
    select 1
    from pg_catalog.pg_timezone_names
    where name = v_timezone
  ) then
    raise exception 'INVALID_TIMEZONE';
  end if;

  update public.profiles
  set
    language = v_language,
    region = v_region,
    currency = v_currency,
    timezone = v_timezone,
    time_format = v_time_format,
    updated_at = now()
  where id = v_user_id
    and account_status = 'active';

  if not found then
    raise exception 'ACCOUNT_NOT_ACTIVE';
  end if;

  return jsonb_build_object(
    'language', v_language,
    'region', v_region,
    'currency', v_currency,
    'timezone', v_timezone,
    'timeFormat', v_time_format
  );
end;
$$;

revoke all
on function public.update_my_regional_preferences(
  text,
  text,
  text,
  text,
  text
)
from public;

revoke all
on function public.update_my_regional_preferences(
  text,
  text,
  text,
  text,
  text
)
from anon;

grant execute
on function public.update_my_regional_preferences(
  text,
  text,
  text,
  text,
  text
)
to authenticated;

notify pgrst, 'reload schema';

commit;
