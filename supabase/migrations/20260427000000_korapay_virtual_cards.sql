-- KoraPay virtual card integration
-- Stores card metadata only — raw card numbers and CVVs are NEVER persisted.

CREATE TABLE IF NOT EXISTS public.korapay_cards (
  id               UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id          UUID        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  child_id         UUID        REFERENCES public.children(id) ON DELETE SET NULL,
  korapay_card_id  TEXT        NOT NULL UNIQUE,
  korapay_reference TEXT       UNIQUE, -- our idempotency key used at creation
  name_on_card     TEXT        NOT NULL,
  status           TEXT        NOT NULL DEFAULT 'active'
                               CHECK (status IN ('active', 'blocked', 'terminated')),
  masked_pan       TEXT,       -- e.g. "4000 **** **** 1234"
  expiry_month     SMALLINT    CHECK (expiry_month BETWEEN 1 AND 12),
  expiry_year      SMALLINT,
  brand            TEXT,       -- 'visa' | 'mastercard'
  currency         TEXT        NOT NULL DEFAULT 'USD',
  balance          DECIMAL(12,4) NOT NULL DEFAULT 0 CHECK (balance >= 0),
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Transactions sourced from KoraPay webhooks
CREATE TABLE IF NOT EXISTS public.korapay_card_transactions (
  id                      UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  korapay_card_id         TEXT        NOT NULL,
  korapay_transaction_id  TEXT        NOT NULL UNIQUE,
  amount                  DECIMAL(12,4) NOT NULL,
  currency                TEXT        NOT NULL,
  type                    TEXT        NOT NULL CHECK (type IN ('debit', 'credit', 'reversal')),
  status                  TEXT        NOT NULL CHECK (status IN ('pending', 'success', 'failed')),
  merchant_name           TEXT,
  narration               TEXT,
  transaction_date        TIMESTAMPTZ,
  created_at              TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_korapay_cards_user_id   ON public.korapay_cards(user_id);
CREATE INDEX IF NOT EXISTS idx_korapay_cards_child_id  ON public.korapay_cards(child_id);
CREATE INDEX IF NOT EXISTS idx_korapay_card_txns_card  ON public.korapay_card_transactions(korapay_card_id);

-- updated_at trigger
CREATE OR REPLACE FUNCTION public.set_korapay_card_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_korapay_cards_updated_at ON public.korapay_cards;
CREATE TRIGGER trg_korapay_cards_updated_at
  BEFORE UPDATE ON public.korapay_cards
  FOR EACH ROW EXECUTE FUNCTION public.set_korapay_card_updated_at();

-- RLS
ALTER TABLE public.korapay_cards            ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.korapay_card_transactions ENABLE ROW LEVEL SECURITY;

-- Users see only their own cards; service role bypasses all policies.
CREATE POLICY "Users select own cards"
  ON public.korapay_cards FOR SELECT
  USING (user_id = auth.uid());

-- Service role (used by API routes) has unrestricted access.
CREATE POLICY "Service role all on cards"
  ON public.korapay_cards FOR ALL
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');

-- Card transactions are readable if the parent card belongs to the user.
CREATE POLICY "Users select own card txns"
  ON public.korapay_card_transactions FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.korapay_cards kc
      WHERE kc.korapay_card_id = korapay_card_transactions.korapay_card_id
        AND kc.user_id = auth.uid()
    )
  );

CREATE POLICY "Service role all on card txns"
  ON public.korapay_card_transactions FOR ALL
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');
