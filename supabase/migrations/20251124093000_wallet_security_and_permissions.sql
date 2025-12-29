-- Wallet security hardening and child safety controls

-- 1. Extend virtual cards with sensitive metadata
ALTER TABLE public.virtual_cards
  ADD COLUMN IF NOT EXISTS cardholder_name TEXT,
  ADD COLUMN IF NOT EXISTS cvv TEXT,
  ADD COLUMN IF NOT EXISTS expiry_month SMALLINT CHECK (expiry_month BETWEEN 1 AND 12),
  ADD COLUMN IF NOT EXISTS expiry_year SMALLINT CHECK (expiry_year BETWEEN date_part('year', CURRENT_DATE)::SMALLINT AND (date_part('year', CURRENT_DATE) + 15)::SMALLINT),
  ADD COLUMN IF NOT EXISTS last_four TEXT;

-- Populate missing derived values for existing cards
UPDATE public.virtual_cards
SET cardholder_name = COALESCE(
      cardholder_name,
      COALESCE(c.name, 'Primary Parent')
    )
FROM public.children c
WHERE c.id = public.virtual_cards.child_id
  AND public.virtual_cards.cardholder_name IS NULL;

UPDATE public.virtual_cards
SET cvv = LPAD(((FLOOR(random() * 900)::INT) + 100)::TEXT, 3, '0')
WHERE cvv IS NULL;

UPDATE public.virtual_cards
SET expiry_month = COALESCE(expiry_month, ((FLOOR(random() * 12)::INT) + 1)),
    expiry_year = COALESCE(expiry_year, (date_part('year', CURRENT_DATE)::INT + 3))
WHERE expiry_month IS NULL OR expiry_year IS NULL;

UPDATE public.virtual_cards
SET last_four = RIGHT(REGEXP_REPLACE(card_number, '\s', '', 'g'), 4)
WHERE last_four IS NULL AND card_number IS NOT NULL;

-- 2. Add parent passcode management columns
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS parent_passcode_hash TEXT,
  ADD COLUMN IF NOT EXISTS parent_passcode_hint TEXT,
  ADD COLUMN IF NOT EXISTS require_child_passcode BOOLEAN DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS passcode_failed_attempts INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS passcode_locked_until TIMESTAMP WITH TIME ZONE,
  ADD COLUMN IF NOT EXISTS passcode_updated_at TIMESTAMP WITH TIME ZONE;

-- Ensure existing rows have sane defaults
UPDATE public.profiles
SET passcode_failed_attempts = COALESCE(passcode_failed_attempts, 0),
    require_child_passcode = COALESCE(require_child_passcode, FALSE)
WHERE passcode_failed_attempts IS NULL OR require_child_passcode IS NULL;

-- 3. Permission seed for wallet actions
INSERT INTO public.permissions (role, resource, action, allowed)
VALUES
  ('parent', 'wallet', 'view', TRUE),
  ('parent', 'wallet', 'manage', TRUE),
  ('parent', 'wallet', 'top_up', TRUE),
  ('parent', 'wallet', 'delete', TRUE),
  ('parent', 'wallet', 'view_sensitive', TRUE),
  ('child', 'wallet', 'view', TRUE),
  ('child', 'wallet', 'manage', FALSE),
  ('child', 'wallet', 'top_up', FALSE),
  ('child', 'wallet', 'delete', FALSE),
  ('child', 'wallet', 'view_sensitive', FALSE)
ON CONFLICT (role, resource, action)
DO UPDATE SET allowed = EXCLUDED.allowed;

COMMENT ON COLUMN public.virtual_cards.cardholder_name IS 'Friendly name for the virtual cardholder (child or parent)';
COMMENT ON COLUMN public.virtual_cards.cvv IS '3-digit CVV for virtual card (never store real card data)';
COMMENT ON COLUMN public.virtual_cards.expiry_month IS 'Card expiry month (1-12)';
COMMENT ON COLUMN public.virtual_cards.expiry_year IS 'Card expiry year';
COMMENT ON COLUMN public.virtual_cards.last_four IS 'Convenience column storing final 4 digits without spaces';
COMMENT ON COLUMN public.profiles.parent_passcode_hash IS 'SHA-256 hash for parent/guardian passcode used when unlocking adult controls';
COMMENT ON COLUMN public.profiles.parent_passcode_hint IS 'Optional hint displayed to trusted family members';
COMMENT ON COLUMN public.profiles.require_child_passcode IS 'Flag indicating whether switching from child to parent requires a passcode';
COMMENT ON COLUMN public.profiles.passcode_failed_attempts IS 'Failed attempts counter for throttling';
COMMENT ON COLUMN public.profiles.passcode_locked_until IS 'Timestamp indicating when another passcode attempt is allowed';



