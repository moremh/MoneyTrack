BEGIN;

-- 028: Retirar una cuenta conserva todas las transacciones; pasan a "Sin cuenta".
-- Los saldos iniciales se incorporan a un registro contable independiente
-- para que borrar una cuenta no elimine dinero del saldo general.
CREATE TABLE IF NOT EXISTS public.archived_account_openings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  original_account_id uuid NOT NULL UNIQUE,
  original_account_name text NOT NULL,
  amount numeric(14,2) NOT NULL,
  original_created_at timestamptz NOT NULL,
  archived_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS archived_account_openings_user_idx
  ON public.archived_account_openings(user_id);
ALTER TABLE public.archived_account_openings ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS archived_account_openings_read_own ON public.archived_account_openings;
CREATE POLICY archived_account_openings_read_own
  ON public.archived_account_openings FOR SELECT TO authenticated
  USING (user_id = (select auth.uid()));
GRANT SELECT ON public.archived_account_openings TO authenticated;

-- Ojo: la migración 023 anterior era CASCADE.
ALTER TABLE public.transactions DROP CONSTRAINT IF EXISTS transactions_account_id_fkey;
ALTER TABLE public.transactions ADD CONSTRAINT transactions_account_id_fkey
  FOREIGN KEY(account_id) REFERENCES public.accounts(id) ON DELETE SET NULL;

-- Conservar también las transferencias históricas, aunque una cuenta desaparezca.
ALTER TABLE public.account_transfers ALTER COLUMN from_account_id DROP NOT NULL;
ALTER TABLE public.account_transfers ALTER COLUMN to_account_id DROP NOT NULL;
ALTER TABLE public.account_transfers DROP CONSTRAINT IF EXISTS account_transfers_from_account_id_fkey;
ALTER TABLE public.account_transfers ADD CONSTRAINT account_transfers_from_account_id_fkey
  FOREIGN KEY(from_account_id) REFERENCES public.accounts(id) ON DELETE SET NULL;
ALTER TABLE public.account_transfers DROP CONSTRAINT IF EXISTS account_transfers_to_account_id_fkey;
ALTER TABLE public.account_transfers ADD CONSTRAINT account_transfers_to_account_id_fkey
  FOREIGN KEY(to_account_id) REFERENCES public.accounts(id) ON DELETE SET NULL;
ALTER TABLE public.account_transfers ADD COLUMN IF NOT EXISTS from_account_name text;
ALTER TABLE public.account_transfers ADD COLUMN IF NOT EXISTS to_account_name text;
-- IDs históricos sin FK: se conservan cuando ON DELETE SET NULL desvincula
-- la cuenta; permiten reconstruir transferencias y el balance cronológico.
ALTER TABLE public.account_transfers ADD COLUMN IF NOT EXISTS from_account_original_id uuid;
ALTER TABLE public.account_transfers ADD COLUMN IF NOT EXISTS to_account_original_id uuid;
UPDATE public.account_transfers SET
  from_account_original_id = coalesce(from_account_original_id,from_account_id),
  to_account_original_id = coalesce(to_account_original_id,to_account_id);
GRANT SELECT (from_account_original_id,to_account_original_id,
  from_account_name,to_account_name) ON public.account_transfers TO authenticated;
UPDATE public.account_transfers t SET
  from_account_name = a.name
FROM public.accounts a
WHERE t.from_account_id = a.id AND t.from_account_name IS NULL;
UPDATE public.account_transfers t SET
  to_account_name = a.name
FROM public.accounts a
WHERE t.to_account_id = a.id AND t.to_account_name IS NULL;

-- Aceptar SET NULL sobre transferencias antiguas, sin permitir orígenes/destinos
-- inexistentes para nuevas transferencias.
CREATE OR REPLACE FUNCTION public.prepare_account_transfer()
RETURNS trigger LANGUAGE plpgsql SET search_path = '' AS $$
DECLARE v_today date := (now() AT TIME ZONE 'America/Argentina/Buenos_Aires')::date;
BEGIN
  IF new.user_id IS NULL THEN new.user_id := auth.uid(); END IF;
  IF TG_OP = 'INSERT' AND (new.from_account_id IS NULL OR new.to_account_id IS NULL) THEN
    RAISE EXCEPTION USING errcode='23514',message='TRANSFER_ACCOUNT_REQUIRED';
  END IF;
  IF new.from_account_id IS NOT NULL AND new.to_account_id IS NOT NULL
    AND new.from_account_id = new.to_account_id THEN
    RAISE EXCEPTION USING errcode='23514',message='TRANSFER_SAME_ACCOUNT';
  END IF;
  IF new.amount IS NULL OR new.amount <= 0 THEN
    RAISE EXCEPTION USING errcode='23514',message='INVALID_TRANSFER_AMOUNT';
  END IF;
  IF new.transfer_date IS NULL THEN new.transfer_date := v_today; END IF;
  IF new.transfer_date > v_today THEN
    RAISE EXCEPTION USING errcode='23514',message='FUTURE_TRANSFER_DATE';
  END IF;
  IF new.from_account_id IS NOT NULL THEN
    new.from_account_original_id := new.from_account_id;
    SELECT name INTO new.from_account_name FROM public.accounts
      WHERE id=new.from_account_id AND user_id=new.user_id;
    IF NOT FOUND THEN
      RAISE EXCEPTION USING errcode='42501',message='TRANSFER_FROM_ACCOUNT_NOT_OWNED';
    END IF;
  END IF;
  IF new.to_account_id IS NOT NULL THEN
    new.to_account_original_id := new.to_account_id;
    SELECT name INTO new.to_account_name FROM public.accounts
      WHERE id=new.to_account_id AND user_id=new.user_id;
    IF NOT FOUND THEN
      RAISE EXCEPTION USING errcode='42501',message='TRANSFER_TO_ACCOUNT_NOT_OWNED';
    END IF;
  END IF;
  new.notes := nullif(trim(coalesce(new.notes,'')),'');
  RETURN new;
END; $$;

-- Registrar apertura y congelar el saldo de objetivos vinculados antes del borrado.
CREATE OR REPLACE FUNCTION public.preserve_deleted_account_balance()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE v_balance numeric(14,2);
BEGIN
  v_balance := old.opening_balance
    + coalesce((SELECT sum(CASE WHEN type='income' THEN amount ELSE -amount END)
        FROM public.transactions WHERE user_id=old.user_id AND account_id=old.id),0)
    + coalesce((SELECT sum(CASE WHEN to_account_id=old.id THEN amount ELSE -amount END)
        FROM public.account_transfers WHERE user_id=old.user_id
          AND (from_account_id=old.id OR to_account_id=old.id)),0);
  UPDATE public.goals SET current_amount=greatest(0,v_balance), account_id=NULL
    WHERE user_id=old.user_id AND account_id=old.id;
  INSERT INTO public.archived_account_openings
    (user_id,original_account_id,original_account_name,amount,original_created_at)
  VALUES (old.user_id,old.id,old.name,
    old.opening_balance, old.created_at);
  RETURN old;
END; $$;
DROP TRIGGER IF EXISTS accounts_preserve_on_delete ON public.accounts;
CREATE TRIGGER accounts_preserve_on_delete BEFORE DELETE ON public.accounts
  FOR EACH ROW EXECUTE FUNCTION public.preserve_deleted_account_balance();

COMMIT;
