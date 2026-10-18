begin;

alter table public.goals
  add column if not exists
    account_id uuid;

alter table public.goals
  drop constraint if exists
    goals_account_id_fkey;

alter table public.goals
  add constraint
    goals_account_id_fkey
  foreign key (account_id)
  references public.accounts(id)
  on delete set null;

create index if not exists
  goals_account_id_idx
on public.goals (account_id);

create or replace function
  public.validate_goal_account()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  selected_account
    public.accounts%rowtype;
begin
  if new.account_id is null then
    return new;
  end if;

  select *
  into selected_account
  from public.accounts
  where id = new.account_id;

  if not found then
    raise exception
      using
        errcode = '23503',
        message =
          'GOAL_ACCOUNT_NOT_FOUND';
  end if;

  if
    selected_account.user_id <>
    new.user_id
  then
    raise exception
      using
        errcode = '42501',
        message =
          'GOAL_ACCOUNT_NOT_OWNED_BY_USER';
  end if;

  return new;
end;
$$;

drop trigger if exists
  goals_validate_account
on public.goals;

create trigger
  goals_validate_account
before insert
or update of account_id, user_id
on public.goals
for each row
execute function
  public.validate_goal_account();

grant select (account_id)
on public.goals
to authenticated;

grant insert (account_id)
on public.goals
to authenticated;

grant update (account_id)
on public.goals
to authenticated;

commit;
