BEGIN;
-- Notas y etiquetas por movimiento; no modificamos la tabla transactions ni
-- su sincronización offline actual.
CREATE TABLE IF NOT EXISTS public.transaction_annotations (
 transaction_id uuid PRIMARY KEY REFERENCES public.transactions(id) ON DELETE CASCADE,
 user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
 notes text NOT NULL DEFAULT '' CHECK (char_length(notes) <= 2000),
 tags text[] NOT NULL DEFAULT '{}' CHECK (cardinality(tags) <= 12),
 updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS transaction_annotations_user_idx ON public.transaction_annotations(user_id);
ALTER TABLE public.transaction_annotations ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS transaction_annotations_select ON public.transaction_annotations;
DROP POLICY IF EXISTS transaction_annotations_insert ON public.transaction_annotations;
DROP POLICY IF EXISTS transaction_annotations_update ON public.transaction_annotations;
DROP POLICY IF EXISTS transaction_annotations_delete ON public.transaction_annotations;
CREATE POLICY transaction_annotations_select ON public.transaction_annotations FOR SELECT TO authenticated
 USING (user_id = (select auth.uid()));
CREATE POLICY transaction_annotations_insert ON public.transaction_annotations FOR INSERT TO authenticated
 WITH CHECK (user_id = (select auth.uid()) AND EXISTS
  (SELECT 1 FROM public.transactions t WHERE t.id=transaction_id AND t.user_id=(select auth.uid())));
CREATE POLICY transaction_annotations_update ON public.transaction_annotations FOR UPDATE TO authenticated
 USING (user_id = (select auth.uid()))
 WITH CHECK (user_id = (select auth.uid()) AND EXISTS
  (SELECT 1 FROM public.transactions t WHERE t.id=transaction_id AND t.user_id=(select auth.uid())));
CREATE POLICY transaction_annotations_delete ON public.transaction_annotations FOR DELETE TO authenticated
 USING (user_id = (select auth.uid()));
GRANT SELECT, INSERT, UPDATE, DELETE ON public.transaction_annotations TO authenticated;
COMMIT;
