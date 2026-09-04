CREATE TABLE IF NOT EXISTS public.recurring_expense_templates (
  id           UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id      UUID          NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  child_id     UUID          REFERENCES public.children(id) ON DELETE SET NULL,
  amount       DECIMAL(10,2) NOT NULL,
  currency     TEXT          NOT NULL DEFAULT 'ZAR' CHECK (currency IN ('ZAR', 'USD')),
  category     TEXT          NOT NULL,
  description  TEXT,
  frequency    TEXT          NOT NULL CHECK (frequency IN ('weekly', 'monthly')),
  next_due_date DATE         NOT NULL,
  active       BOOLEAN       NOT NULL DEFAULT TRUE,
  created_at   TIMESTAMPTZ   NOT NULL DEFAULT NOW()
);

ALTER TABLE public.recurring_expense_templates ENABLE ROW LEVEL SECURITY;

CREATE POLICY "users_own_recurring_templates"
  ON public.recurring_expense_templates
  FOR ALL USING (auth.uid() = user_id);
