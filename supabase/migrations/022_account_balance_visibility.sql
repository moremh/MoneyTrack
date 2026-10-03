begin;

alter table public.accounts
  add column if not exists
    include_in_balance boolean not null
    default true;

commit;
