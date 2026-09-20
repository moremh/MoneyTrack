begin;

alter table public.profiles
  add column if not exists language text
    not null default 'es',
  add column if not exists region text
    not null default 'AR',
  add column if not exists timezone text
    not null default 'America/Argentina/Buenos_Aires',
  add column if not exists time_format text
    not null default '24h';

alter table public.profiles
  drop constraint if exists profiles_language_check,
  drop constraint if exists profiles_region_check,
  drop constraint if exists profiles_timezone_check,
  drop constraint if exists profiles_time_format_check;

alter table public.profiles
  add constraint profiles_language_check
    check (language in ('es', 'en', 'it')),
  add constraint profiles_region_check
    check (region ~ '^[A-Z]{2}$'),
  add constraint profiles_timezone_check
    check (char_length(trim(timezone)) between 1 and 100),
  add constraint profiles_time_format_check
    check (time_format in ('12h', '24h'));

commit;