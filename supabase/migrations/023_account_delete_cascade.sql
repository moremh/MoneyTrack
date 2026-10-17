begin;

alter table public.transactions
  drop constraint if exists transactions_account_id_fkey;

alter table public.transactions
  add constraint transactions_account_id_fkey
  foreign key (account_id)
  references public.accounts(id)
  on delete cascade;

alter table public.account_transfers
  drop constraint if exists account_transfers_from_account_id_fkey;

alter table public.account_transfers
  add constraint account_transfers_from_account_id_fkey
  foreign key (from_account_id)
  references public.accounts(id)
  on delete cascade;

alter table public.account_transfers
  drop constraint if exists account_transfers_to_account_id_fkey;

alter table public.account_transfers
  add constraint account_transfers_to_account_id_fkey
  foreign key (to_account_id)
  references public.accounts(id)
  on delete cascade;

commit;
