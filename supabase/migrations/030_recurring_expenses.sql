-- MoneyTrack 030 - Suscripciones de servicios recurrentes (no confundir con
-- public.subscriptions, que administra el Premium de MoneyTrack).
-- Aplicar DESPUES de las migraciones 028 y 029, en una base de pruebas.
BEGIN;

CREATE TABLE IF NOT EXISTS public.recurring_expenses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  name text NOT NULL CHECK (length(btrim(name)) BETWEEN 1 AND 100),
  amount numeric(14,2) NOT NULL CHECK (amount > 0),
  recurrence text NOT NULL DEFAULT 'monthly' CHECK (recurrence IN ('weekly','monthly','annual','custom')),
  interval_days integer CHECK (interval_days BETWEEN 1 AND 3650),
  reminder_days_before smallint CHECK (reminder_days_before BETWEEN 0 AND 30),
  reminder_id uuid REFERENCES public.reminders(id) ON DELETE SET NULL,
  next_due_on date, -- OPCIONAL: no se exige recordar la fecha de vencimiento
  category_name text NOT NULL DEFAULT 'General' CHECK (length(btrim(category_name)) BETWEEN 1 AND 60),
  default_account_id uuid REFERENCES public.accounts(id) ON DELETE SET NULL,
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active','paused','cancelled')),
  notes text NOT NULL DEFAULT '' CHECK (length(notes) <= 2000),
  tags text[] NOT NULL DEFAULT '{}' CHECK (cardinality(tags) <= 12),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT recurring_custom_interval_check CHECK ((recurrence='custom' AND interval_days IS NOT NULL) OR (recurrence<>'custom' AND interval_days IS NULL))
);
CREATE INDEX IF NOT EXISTS recurring_expenses_owner_idx ON public.recurring_expenses(user_id,status);
DROP TRIGGER IF EXISTS recurring_expenses_updated_at ON public.recurring_expenses;
CREATE TRIGGER recurring_expenses_updated_at BEFORE UPDATE ON public.recurring_expenses
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Un pago de una suscripción es UN gasto, con referencia única.
CREATE TABLE IF NOT EXISTS public.recurring_expense_payments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  recurring_expense_id uuid NOT NULL REFERENCES public.recurring_expenses(id) ON DELETE CASCADE,
  transaction_id uuid NOT NULL UNIQUE REFERENCES public.transactions(id) ON DELETE CASCADE,
  period_key text NOT NULL CHECK (length(period_key) BETWEEN 4 AND 10),
  amount numeric(14,2) NOT NULL CHECK (amount > 0),
  paid_on date, -- FECHA REAL opcional; si se desconoce, la transacción usa la fecha de registro
  source text NOT NULL DEFAULT 'created' CHECK (source IN ('created','linked')),
  request_id uuid UNIQUE,
  notes text NOT NULL DEFAULT '' CHECK (length(notes) <= 1000),
  due_on_before date,
  due_on_after date,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT recurring_expense_period_unique UNIQUE(recurring_expense_id,period_key)
);
CREATE INDEX IF NOT EXISTS recurring_expense_payments_owner_idx ON public.recurring_expense_payments(user_id,created_at DESC);

ALTER TABLE public.recurring_expenses ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.recurring_expense_payments ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS recurring_expenses_select ON public.recurring_expenses;
DROP POLICY IF EXISTS recurring_expenses_insert ON public.recurring_expenses;
DROP POLICY IF EXISTS recurring_expenses_update ON public.recurring_expenses;
DROP POLICY IF EXISTS recurring_expenses_delete ON public.recurring_expenses;
CREATE POLICY recurring_expenses_select ON public.recurring_expenses FOR SELECT TO authenticated USING (user_id=(SELECT auth.uid()));
CREATE POLICY recurring_expenses_insert ON public.recurring_expenses FOR INSERT TO authenticated WITH CHECK (user_id=(SELECT auth.uid()) AND (default_account_id IS NULL OR EXISTS(SELECT 1 FROM public.accounts WHERE id=default_account_id AND user_id=(SELECT auth.uid()))));
CREATE POLICY recurring_expenses_update ON public.recurring_expenses FOR UPDATE TO authenticated USING (user_id=(SELECT auth.uid())) WITH CHECK (user_id=(SELECT auth.uid()) AND (default_account_id IS NULL OR EXISTS(SELECT 1 FROM public.accounts WHERE id=default_account_id AND user_id=(SELECT auth.uid()))));
CREATE POLICY recurring_expenses_delete ON public.recurring_expenses FOR DELETE TO authenticated USING (user_id=(SELECT auth.uid()));
DROP POLICY IF EXISTS recurring_payments_select ON public.recurring_expense_payments;
CREATE POLICY recurring_payments_select ON public.recurring_expense_payments FOR SELECT TO authenticated USING (user_id=(SELECT auth.uid()));
-- Pagos: solo se escriben mediante RPC, para garantizar atomicidad y evitar duplicados.
REVOKE ALL ON public.recurring_expenses, public.recurring_expense_payments FROM PUBLIC, anon, authenticated;
GRANT SELECT,DELETE ON public.recurring_expenses TO authenticated;
GRANT INSERT (user_id,name,amount,recurrence,interval_days,next_due_on,category_name,default_account_id,status,notes,tags,reminder_days_before) ON public.recurring_expenses TO authenticated;
GRANT UPDATE (name,amount,recurrence,interval_days,next_due_on,category_name,default_account_id,status,notes,tags,reminder_days_before) ON public.recurring_expenses TO authenticated;
GRANT SELECT ON public.recurring_expense_payments TO authenticated;

-- Recordatorios ligados al vencimiento opcional, sin duplicar notificaciones.
-- El trigger se ejecuta solamente cuando cambian campos relevantes.
CREATE OR REPLACE FUNCTION public.sync_recurring_expense_reminder()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE v_reminder uuid; v_notice_date date;
BEGIN
 IF TG_OP='DELETE' THEN
  IF OLD.reminder_id IS NOT NULL THEN
   DELETE FROM public.reminders WHERE id=OLD.reminder_id AND user_id=OLD.user_id;
  END IF;
  RETURN OLD;
 END IF;
 IF NEW.status<>'active' OR NEW.next_due_on IS NULL OR NEW.reminder_days_before IS NULL THEN
  IF NEW.reminder_id IS NOT NULL THEN
   DELETE FROM public.reminders WHERE id=NEW.reminder_id AND user_id=NEW.user_id;
   UPDATE public.recurring_expenses SET reminder_id=NULL WHERE id=NEW.id;
  END IF;
  RETURN NEW;
 END IF;
 v_notice_date := NEW.next_due_on - NEW.reminder_days_before::integer;
 IF NEW.reminder_id IS NOT NULL THEN
  UPDATE public.reminders SET
   title=left('Pagar '||NEW.name,120),
   description='Suscripción de MoneyTrack. Importe estimado: '||NEW.amount::text,
   type='payment',reminder_date=v_notice_date,reminder_time='09:00',
   recurrence='none',recurrence_end_date=NULL,status='pending',is_read=true,
   notified_at=NULL,completed_at=NULL
   WHERE id=NEW.reminder_id AND user_id=NEW.user_id;
 ELSE
  INSERT INTO public.reminders(user_id,title,description,type,reminder_date,reminder_time,timezone,recurrence,status,is_read)
  VALUES(NEW.user_id,left('Pagar '||NEW.name,120),'Suscripción de MoneyTrack. Importe estimado: '||NEW.amount::text,
    'payment',v_notice_date,'09:00','America/Argentina/Buenos_Aires','none','pending',true)
  RETURNING id INTO v_reminder;
  UPDATE public.recurring_expenses SET reminder_id=v_reminder WHERE id=NEW.id;
 END IF;
 RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS recurring_expense_sync_reminder ON public.recurring_expenses;
CREATE TRIGGER recurring_expense_sync_reminder AFTER INSERT OR UPDATE OF name,amount,status,next_due_on,reminder_days_before ON public.recurring_expenses
FOR EACH ROW EXECUTE FUNCTION public.sync_recurring_expense_reminder();
DROP TRIGGER IF EXISTS recurring_expense_delete_reminder ON public.recurring_expenses;
CREATE TRIGGER recurring_expense_delete_reminder AFTER DELETE ON public.recurring_expenses
FOR EACH ROW EXECUTE FUNCTION public.sync_recurring_expense_reminder();
REVOKE ALL ON FUNCTION public.sync_recurring_expense_reminder() FROM PUBLIC,anon,authenticated;

-- La función crea gasto y pago juntos. Si falla, NO queda ninguno guardado.
CREATE OR REPLACE FUNCTION public.register_recurring_expense_payment(
 p_recurring_expense_id uuid, p_period_key text, p_amount numeric,
 p_account_id uuid, p_paid_on date, p_notes text, p_request_id uuid
) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  v_user uuid := auth.uid();
  v_rec public.recurring_expenses%ROWTYPE;
  v_prev public.recurring_expense_payments%ROWTYPE;
  v_txn uuid;
  v_pay uuid;
  v_category uuid;
  v_date date := (now() AT TIME ZONE 'America/Argentina/Buenos_Aires')::date;
  v_next date;
  v_cycles integer := 0;
BEGIN
  IF v_user IS NULL OR NOT public.is_active_user() THEN
    RAISE EXCEPTION USING ERRCODE='42501', MESSAGE='NOT_AUTHENTICATED_OR_BLOCKED';
  END IF;
  IF p_request_id IS NULL OR p_period_key IS NULL OR p_period_key !~ '^[0-9]{4}(-[0-9]{2}(-[0-9]{2})?)?$'
    OR p_amount IS NULL OR p_amount<=0 OR p_amount<>round(p_amount,2)
    OR length(coalesce(p_notes,''))>1000 THEN
    RAISE EXCEPTION USING ERRCODE='22023', MESSAGE='INVALID_SUBSCRIPTION_PAYMENT';
  END IF;

  SELECT * INTO v_rec FROM public.recurring_expenses
    WHERE id=p_recurring_expense_id AND user_id=v_user FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION USING ERRCODE='42501', MESSAGE='SUBSCRIPTION_NOT_FOUND'; END IF;
  IF v_rec.status<>'active' THEN RAISE EXCEPTION USING ERRCODE='23514', MESSAGE='SUBSCRIPTION_NOT_ACTIVE'; END IF;

  SELECT * INTO v_prev FROM public.recurring_expense_payments
  WHERE user_id=v_user AND (request_id=p_request_id OR (recurring_expense_id=v_rec.id AND period_key=p_period_key))
  ORDER BY created_at LIMIT 1;
  IF FOUND THEN
    IF v_prev.recurring_expense_id<>v_rec.id OR v_prev.period_key<>p_period_key THEN
      RAISE EXCEPTION USING ERRCODE='23505', MESSAGE='REQUEST_ID_ALREADY_USED';
    END IF;
    RETURN jsonb_build_object('payment_id',v_prev.id,'transaction_id',v_prev.transaction_id,'already_paid',true);
  END IF;
  IF p_account_id IS NOT NULL AND NOT EXISTS(
    SELECT 1 FROM public.accounts WHERE id=p_account_id AND user_id=v_user AND is_active=true
  ) THEN RAISE EXCEPTION USING ERRCODE='42501', MESSAGE='ACCOUNT_NOT_AVAILABLE'; END IF;

  SELECT id INTO v_category FROM public.categories
    WHERE user_id=v_user AND type='expense' AND lower(name)=lower(v_rec.category_name) LIMIT 1;
  IF p_paid_on IS NOT NULL THEN v_date := p_paid_on; END IF;
  IF v_date > (now() AT TIME ZONE 'America/Argentina/Buenos_Aires')::date THEN
    RAISE EXCEPTION USING ERRCODE='22023', MESSAGE='FUTURE_PAYMENT_DATE';
  END IF;

  INSERT INTO public.transactions(user_id,type,description,amount,category_id,category_name,account_id,date)
  VALUES(v_user,'expense',left('Suscripción: '||v_rec.name,200),p_amount,v_category,v_rec.category_name,p_account_id,v_date)
  RETURNING id INTO v_txn;

  INSERT INTO public.recurring_expense_payments(user_id,recurring_expense_id,transaction_id,period_key,amount,paid_on,source,request_id,notes)
  VALUES(v_user,v_rec.id,v_txn,p_period_key,p_amount,p_paid_on,'created',p_request_id,coalesce(p_notes,''))
  RETURNING id INTO v_pay;

  -- Las etiquetas de Suscripciones también aparecen al filtrar movimientos.
  IF cardinality(v_rec.tags)>0 OR v_rec.notes<>'' THEN
    INSERT INTO public.transaction_annotations(transaction_id,user_id,notes,tags)
    VALUES(v_txn,v_user,v_rec.notes,v_rec.tags);
  END IF;

  -- Sin próxima fecha no se inventa una. Si existe, avanzar al próximo período.
  IF v_rec.next_due_on IS NOT NULL THEN
    v_next := v_rec.next_due_on;
    WHILE (v_next <= v_date OR (v_rec.recurrence='monthly' AND to_char(v_next,'YYYY-MM')=p_period_key) OR (v_rec.recurrence='annual' AND to_char(v_next,'YYYY')=p_period_key)) AND v_cycles < 240 LOOP
      IF v_rec.recurrence='monthly' THEN
        v_next := (v_next + INTERVAL '1 month')::date;
      ELSIF v_rec.recurrence='annual' THEN
        v_next := (v_next + INTERVAL '1 year')::date;
      ELSIF v_rec.recurrence='weekly' THEN
        v_next := v_next + 7;
      ELSE
        v_next := v_next + v_rec.interval_days;
      END IF;
      v_cycles := v_cycles+1;
    END LOOP;
    IF v_next IS DISTINCT FROM v_rec.next_due_on THEN
      UPDATE public.recurring_expenses SET next_due_on=v_next WHERE id=v_rec.id;
      UPDATE public.recurring_expense_payments SET due_on_before=v_rec.next_due_on,due_on_after=v_next WHERE id=v_pay;
    END IF;
  END IF;
  RETURN jsonb_build_object('payment_id',v_pay,'transaction_id',v_txn,'already_paid',false);
END;
$$;

-- Asociar un gasto existente, SIN crear ni descontar un segundo gasto.
CREATE OR REPLACE FUNCTION public.link_recurring_expense_transaction(
 p_recurring_expense_id uuid, p_transaction_id uuid, p_period_key text,
 p_paid_on date DEFAULT NULL
) RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE v_user uuid := auth.uid(); v_rec public.recurring_expenses%ROWTYPE; v_txn public.transactions%ROWTYPE; v_id uuid; v_next date; v_cycles integer := 0;
BEGIN
 IF v_user IS NULL OR NOT public.is_active_user() THEN RAISE EXCEPTION USING ERRCODE='42501',MESSAGE='NOT_AUTHENTICATED'; END IF;
 IF p_period_key IS NULL OR p_period_key !~ '^[0-9]{4}(-[0-9]{2}(-[0-9]{2})?)?$' THEN RAISE EXCEPTION USING ERRCODE='22023',MESSAGE='INVALID_PERIOD'; END IF;
 SELECT * INTO v_rec FROM public.recurring_expenses WHERE id=p_recurring_expense_id AND user_id=v_user FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION USING ERRCODE='42501',MESSAGE='SUBSCRIPTION_NOT_FOUND'; END IF;
 SELECT * INTO v_txn FROM public.transactions WHERE id=p_transaction_id AND user_id=v_user AND type='expense' FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION USING ERRCODE='42501',MESSAGE='EXPENSE_NOT_FOUND'; END IF;
 IF p_paid_on IS NOT NULL AND p_paid_on<>v_txn.date THEN RAISE EXCEPTION USING ERRCODE='22023',MESSAGE='PAYMENT_DATE_MUST_MATCH_EXPENSE_DATE'; END IF;
 INSERT INTO public.recurring_expense_payments(user_id,recurring_expense_id,transaction_id,period_key,amount,paid_on,source)
 VALUES(v_user,v_rec.id,v_txn.id,p_period_key,v_txn.amount,p_paid_on,'linked') RETURNING id INTO v_id;
 IF v_rec.next_due_on IS NOT NULL THEN
  v_next := v_rec.next_due_on;
  WHILE (v_next <= v_txn.date OR (v_rec.recurrence='monthly' AND to_char(v_next,'YYYY-MM')=p_period_key) OR (v_rec.recurrence='annual' AND to_char(v_next,'YYYY')=p_period_key)) AND v_cycles < 240 LOOP
    IF v_rec.recurrence='monthly' THEN v_next := (v_next + INTERVAL '1 month')::date;
    ELSIF v_rec.recurrence='annual' THEN v_next := (v_next + INTERVAL '1 year')::date;
    ELSIF v_rec.recurrence='weekly' THEN v_next := v_next+7;
    ELSE v_next := v_next + v_rec.interval_days; END IF;
    v_cycles := v_cycles+1;
  END LOOP;
  IF v_next IS DISTINCT FROM v_rec.next_due_on THEN
    UPDATE public.recurring_expenses SET next_due_on=v_next WHERE id=v_rec.id;
    UPDATE public.recurring_expense_payments SET due_on_before=v_rec.next_due_on,due_on_after=v_next WHERE id=v_id;
  END IF;
 END IF;
 RETURN v_id;
END;
$$;

-- Completar/corregir la fecha real sin alterar otros datos financieros.
CREATE OR REPLACE FUNCTION public.update_recurring_payment_date(p_payment_id uuid,p_paid_on date DEFAULT NULL)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE v_user uuid := auth.uid(); v_row public.recurring_expense_payments%ROWTYPE;
BEGIN
 IF v_user IS NULL OR NOT public.is_active_user() THEN RAISE EXCEPTION USING ERRCODE='42501',MESSAGE='NOT_AUTHENTICATED'; END IF;
 SELECT * INTO v_row FROM public.recurring_expense_payments WHERE id=p_payment_id AND user_id=v_user FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION USING ERRCODE='42501',MESSAGE='PAYMENT_NOT_FOUND'; END IF;
 IF p_paid_on IS NOT NULL THEN
   IF p_paid_on>(now() AT TIME ZONE 'America/Argentina/Buenos_Aires')::date THEN RAISE EXCEPTION USING ERRCODE='22023',MESSAGE='FUTURE_PAYMENT_DATE'; END IF;
   UPDATE public.transactions SET date=p_paid_on WHERE id=v_row.transaction_id AND user_id=v_user;
 END IF;
 UPDATE public.recurring_expense_payments SET paid_on=p_paid_on WHERE id=v_row.id;
END;
$$;

-- Deshacer un pago: si Suscripciones creó el gasto, eliminar ambos;
-- si fue vinculado manualmente, conservar el gasto original.
CREATE OR REPLACE FUNCTION public.undo_recurring_expense_payment(p_payment_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE v_user uuid := auth.uid(); v_row public.recurring_expense_payments%ROWTYPE; v_rec public.recurring_expenses%ROWTYPE;
BEGIN
 IF v_user IS NULL OR NOT public.is_active_user() THEN RAISE EXCEPTION USING ERRCODE='42501',MESSAGE='NOT_AUTHENTICATED'; END IF;
 SELECT * INTO v_row FROM public.recurring_expense_payments WHERE id=p_payment_id AND user_id=v_user FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION USING ERRCODE='42501',MESSAGE='PAYMENT_NOT_FOUND'; END IF;
 SELECT * INTO v_rec FROM public.recurring_expenses WHERE id=v_row.recurring_expense_id AND user_id=v_user FOR UPDATE;
 DELETE FROM public.recurring_expense_payments WHERE id=v_row.id;
 IF v_row.source='created' THEN
  DELETE FROM public.transactions WHERE id=v_row.transaction_id AND user_id=v_user;
 END IF;
 IF v_row.due_on_after IS NOT NULL AND v_rec.next_due_on IS NOT DISTINCT FROM v_row.due_on_after THEN
   UPDATE public.recurring_expenses SET next_due_on=v_row.due_on_before WHERE id=v_rec.id;
 END IF;
END;
$$;

REVOKE ALL ON FUNCTION public.register_recurring_expense_payment(uuid,text,numeric,uuid,date,text,uuid) FROM PUBLIC,anon;
REVOKE ALL ON FUNCTION public.link_recurring_expense_transaction(uuid,uuid,text,date) FROM PUBLIC,anon;
REVOKE ALL ON FUNCTION public.update_recurring_payment_date(uuid,date) FROM PUBLIC,anon;
REVOKE ALL ON FUNCTION public.undo_recurring_expense_payment(uuid) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.register_recurring_expense_payment(uuid,text,numeric,uuid,date,text,uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.link_recurring_expense_transaction(uuid,uuid,text,date) TO authenticated;
GRANT EXECUTE ON FUNCTION public.update_recurring_payment_date(uuid,date) TO authenticated;
GRANT EXECUTE ON FUNCTION public.undo_recurring_expense_payment(uuid) TO authenticated;

COMMIT;
