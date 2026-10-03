begin;

grant insert (account_id)
on public.transactions
to authenticated;

grant update (account_id)
on public.transactions
to authenticated;

commit;
