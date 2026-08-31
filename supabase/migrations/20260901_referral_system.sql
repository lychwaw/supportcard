-- ============================================================
-- Referral System — 2026-09-01
-- Partners refer users via a short code (e.g. LIESEL42).
-- Commission is earned after 90 days of active subscription.
-- Attorneys and HPCSA-registered professionals are excluded
-- from commission (commission_eligible = false) — enforced here,
-- not at payout time.
-- ============================================================

-- ────────────────────────────────────────────────────────────
-- 1. PARTNERS
-- ────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS partners (
  id                   UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  name                 TEXT        NOT NULL,
  email                TEXT        NOT NULL UNIQUE,
  category             TEXT        NOT NULL CHECK (category IN ('coach', 'mediator', 'attorney', 'creator')),
  code                 TEXT        NOT NULL UNIQUE,
  commission_eligible  BOOLEAN     NOT NULL DEFAULT TRUE,
  -- Payout amounts in cents (e.g. 2000 = R20.00)
  payout_plus_cents    INTEGER     NOT NULL DEFAULT 0,
  payout_premium_cents INTEGER     NOT NULL DEFAULT 0,
  bank_details         JSONB,
  -- Monthly payout cap until partner has earned trust
  monthly_payout_cap   INTEGER     NOT NULL DEFAULT 20,
  created_at           TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Codes are always stored uppercase; enforce at insert/update
CREATE UNIQUE INDEX IF NOT EXISTS idx_partners_code_upper ON partners (UPPER(code));

-- ────────────────────────────────────────────────────────────
-- 2. REFERRALS
-- One row per referred user. Co-parent deduplication is handled
-- by the unique index on family_id — if both co-parents share
-- a family, only the first signup earns the referral.
-- ────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS referrals (
  id                     UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  partner_id             UUID        NOT NULL REFERENCES partners(id) ON DELETE RESTRICT,
  user_id                UUID        NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  -- family_id from profiles — ensures one referral per family unit
  family_id              TEXT,
  code_used              TEXT        NOT NULL,
  code_entered_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  signed_up_at           TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  -- Filled when subscription goes active (via RevenueCat webhook)
  tier                   TEXT,
  subscription_started_at TIMESTAMPTZ,
  -- Filled by qualification job after 90 days active
  qualified_at           TIMESTAMPTZ,
  commission_cents       INTEGER,
  status                 TEXT        NOT NULL DEFAULT 'pending'
                           CHECK (status IN ('pending', 'qualified', 'paid', 'void')),
  void_reason            TEXT,
  created_at             TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- One referral per user (they can only be referred once)
CREATE UNIQUE INDEX IF NOT EXISTS idx_referrals_user ON referrals (user_id);

-- One referral per family unit (co-parent deduplication)
CREATE UNIQUE INDEX IF NOT EXISTS idx_referrals_family
  ON referrals (family_id)
  WHERE family_id IS NOT NULL;

-- Fast lookup by partner and status for payout queries
CREATE INDEX IF NOT EXISTS idx_referrals_partner_status ON referrals (partner_id, status);

-- ────────────────────────────────────────────────────────────
-- 3. PAYOUTS
-- One row per partner per monthly period.
-- ────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS payouts (
  id           UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  partner_id   UUID        NOT NULL REFERENCES partners(id) ON DELETE RESTRICT,
  period       TEXT        NOT NULL, -- e.g. '2026-09'
  total_cents  INTEGER     NOT NULL,
  paid_at      TIMESTAMPTZ,
  reference    TEXT,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (partner_id, period)
);

-- ────────────────────────────────────────────────────────────
-- 4. REFERRAL EVENTS (append-only audit log)
-- Every status change is logged here for dispute resolution.
-- ────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS referral_events (
  id           UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  referral_id  UUID        NOT NULL REFERENCES referrals(id) ON DELETE CASCADE,
  event_type   TEXT        NOT NULL, -- 'created' | 'subscription_started' | 'qualified' | 'paid' | 'voided'
  old_status   TEXT,
  new_status   TEXT,
  meta         JSONB,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_referral_events_referral ON referral_events (referral_id);

-- ────────────────────────────────────────────────────────────
-- 5. RLS
-- Partners table is admin-only (service role). Users cannot
-- read partner commission rates or bank details.
-- Referrals: a user can read their own row only.
-- ────────────────────────────────────────────────────────────
ALTER TABLE partners         ENABLE ROW LEVEL SECURITY;
ALTER TABLE referrals        ENABLE ROW LEVEL SECURITY;
ALTER TABLE payouts          ENABLE ROW LEVEL SECURITY;
ALTER TABLE referral_events  ENABLE ROW LEVEL SECURITY;

-- No public access to partners or payouts (service role only)
CREATE POLICY "partners_no_public_access" ON partners
  FOR ALL USING (FALSE);

CREATE POLICY "payouts_no_public_access" ON payouts
  FOR ALL USING (FALSE);

CREATE POLICY "referral_events_no_public_access" ON referral_events
  FOR ALL USING (FALSE);

-- Users can read their own referral row (so app can confirm code was applied)
CREATE POLICY "referrals_own_row" ON referrals
  FOR SELECT USING (auth.uid() = user_id);

-- ────────────────────────────────────────────────────────────
-- 6. REFERRAL CAPTURE FUNCTION
-- Called by the /api/referral-capture endpoint (service role).
-- Validates the code, checks the 7-day window, prevents
-- self-referral, inserts the row, and logs the event.
-- Returns: 'ok' | 'invalid_code' | 'expired' | 'self_referral'
--          | 'already_referred' | 'family_already_referred'
-- ────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION capture_referral(
  p_user_id  UUID,
  p_code     TEXT,
  p_family_id TEXT DEFAULT NULL
)
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_partner       partners%ROWTYPE;
  v_signup_at     TIMESTAMPTZ;
  v_referral_id   UUID;
BEGIN
  -- Normalise code
  p_code := UPPER(TRIM(p_code));

  -- Validate code exists and partner is commission-eligible
  SELECT * INTO v_partner FROM partners WHERE UPPER(code) = p_code;
  IF NOT FOUND THEN
    RETURN 'invalid_code';
  END IF;

  -- Self-referral check: partner email must not match user email
  IF EXISTS (
    SELECT 1 FROM profiles
    WHERE id = p_user_id AND email = v_partner.email
  ) THEN
    RETURN 'self_referral';
  END IF;

  -- Fetch user signup time
  SELECT created_at INTO v_signup_at FROM profiles WHERE id = p_user_id;

  -- 7-day entry window
  IF NOW() > v_signup_at + INTERVAL '7 days' THEN
    RETURN 'expired';
  END IF;

  -- Already referred (user already has a referral row)
  IF EXISTS (SELECT 1 FROM referrals WHERE user_id = p_user_id) THEN
    RETURN 'already_referred';
  END IF;

  -- Co-parent / family deduplication
  IF p_family_id IS NOT NULL AND EXISTS (
    SELECT 1 FROM referrals WHERE family_id = p_family_id
  ) THEN
    RETURN 'family_already_referred';
  END IF;

  -- Insert referral
  INSERT INTO referrals (partner_id, user_id, family_id, code_used, code_entered_at, signed_up_at)
  VALUES (v_partner.id, p_user_id, p_family_id, p_code, NOW(), v_signup_at)
  RETURNING id INTO v_referral_id;

  -- Audit log
  INSERT INTO referral_events (referral_id, event_type, new_status, meta)
  VALUES (v_referral_id, 'created', 'pending', jsonb_build_object('code', p_code));

  RETURN 'ok';
END;
$$;

-- ────────────────────────────────────────────────────────────
-- 7. QUALIFICATION FUNCTION
-- Run weekly by pg_cron or a Supabase edge function.
-- Finds referrals where subscription has been active 90+ days,
-- partner is commission_eligible, and status is still pending.
-- Respects the monthly payout cap per partner.
-- ────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION qualify_referrals()
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_rec           RECORD;
  v_commission    INTEGER;
  v_month         TEXT;
  v_month_count   INTEGER;
  v_qualified     INTEGER := 0;
BEGIN
  v_month := TO_CHAR(NOW(), 'YYYY-MM');

  FOR v_rec IN
    SELECT r.id, r.partner_id, r.tier, r.user_id,
           p.payout_plus_cents, p.payout_premium_cents,
           p.commission_eligible, p.monthly_payout_cap
    FROM referrals r
    JOIN partners p ON p.id = r.partner_id
    WHERE r.status = 'pending'
      AND r.subscription_started_at IS NOT NULL
      AND r.subscription_started_at <= NOW() - INTERVAL '90 days'
      AND p.commission_eligible = TRUE
  LOOP
    -- Determine commission amount
    IF v_rec.tier = 'premium' THEN
      v_commission := v_rec.payout_premium_cents;
    ELSIF v_rec.tier IN ('plus', 'essential') THEN
      v_commission := v_rec.payout_plus_cents;
    ELSE
      -- preview/free — no commission
      CONTINUE;
    END IF;

    -- Check monthly cap for this partner
    SELECT COUNT(*) INTO v_month_count
    FROM referrals
    WHERE partner_id = v_rec.partner_id
      AND status IN ('qualified', 'paid')
      AND TO_CHAR(qualified_at, 'YYYY-MM') = v_month;

    IF v_month_count >= v_rec.monthly_payout_cap THEN
      CONTINUE;
    END IF;

    -- Qualify
    UPDATE referrals
    SET status           = 'qualified',
        qualified_at     = NOW(),
        commission_cents = v_commission
    WHERE id = v_rec.id;

    INSERT INTO referral_events (referral_id, event_type, old_status, new_status, meta)
    VALUES (v_rec.id, 'qualified', 'pending', 'qualified',
            jsonb_build_object('commission_cents', v_commission, 'tier', v_rec.tier));

    v_qualified := v_qualified + 1;
  END LOOP;

  RETURN v_qualified;
END;
$$;
