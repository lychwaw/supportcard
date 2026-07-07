-- ============================================================
-- Migration: Neutral Ledger + Custody Clock pillars
-- Run this in Supabase SQL Editor → Run
-- ============================================================

-- ────────────────────────────────────────────────────────────
-- 1. wallet_pockets  (replaces virtual_cards for balance tracking)
-- ────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS wallet_pockets (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID        NOT NULL REFERENCES profiles(id)  ON DELETE CASCADE,
  child_id    UUID        REFERENCES children(id)           ON DELETE SET NULL,
  category    TEXT        NOT NULL,
  balance     NUMERIC(12,2) NOT NULL DEFAULT 0,
  is_primary  BOOLEAN     NOT NULL DEFAULT FALSE,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Migrate existing virtual_cards data that was used as balance envelopes
-- (card_number starting with 'BAL-' are the budget-envelope entries)
INSERT INTO wallet_pockets (id, user_id, child_id, category, balance, is_primary, created_at)
SELECT
  gen_random_uuid(),
  user_id,
  child_id,
  COALESCE(card_type, 'General'),
  COALESCE(balance, 0),
  COALESCE(is_primary, FALSE),
  COALESCE(created_at, NOW())
FROM virtual_cards
WHERE card_number LIKE 'BAL-%'
ON CONFLICT DO NOTHING;

ALTER TABLE wallet_pockets ENABLE ROW LEVEL SECURITY;

CREATE POLICY "wallet_pockets_select" ON wallet_pockets
  FOR SELECT USING (
    auth.uid() = user_id
    OR child_id IN (
      SELECT id FROM children
      WHERE parent_id = auth.uid() OR co_parent_id = auth.uid()
    )
  );

CREATE POLICY "wallet_pockets_insert" ON wallet_pockets
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "wallet_pockets_update" ON wallet_pockets
  FOR UPDATE USING (
    auth.uid() = user_id
    OR child_id IN (
      SELECT id FROM children
      WHERE parent_id = auth.uid() OR co_parent_id = auth.uid()
    )
  );

CREATE POLICY "wallet_pockets_delete" ON wallet_pockets
  FOR DELETE USING (auth.uid() = user_id);

-- ────────────────────────────────────────────────────────────
-- 2. wishlist_items
-- ────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS wishlist_items (
  id             UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  child_id       UUID        NOT NULL REFERENCES children(id) ON DELETE CASCADE,
  name           TEXT        NOT NULL,
  price_estimate NUMERIC(12,2),
  notes          TEXT,
  fulfilled      BOOLEAN     NOT NULL DEFAULT FALSE,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE wishlist_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "wishlist_parent_access" ON wishlist_items
  FOR ALL USING (
    child_id IN (
      SELECT id FROM children
      WHERE parent_id = auth.uid() OR co_parent_id = auth.uid()
    )
  );

-- ────────────────────────────────────────────────────────────
-- 3. withdrawal_requests
-- ────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS withdrawal_requests (
  id            UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  child_id      UUID        NOT NULL REFERENCES children(id) ON DELETE CASCADE,
  pocket_id     UUID        REFERENCES wallet_pockets(id)   ON DELETE SET NULL,
  amount        NUMERIC(12,2) NOT NULL,
  reason        TEXT,
  status        TEXT        NOT NULL DEFAULT 'pending', -- pending | approved | declined
  requested_by  UUID        REFERENCES profiles(id),
  resolved_by   UUID        REFERENCES profiles(id),
  resolved_at   TIMESTAMPTZ,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE withdrawal_requests ENABLE ROW LEVEL SECURITY;

CREATE POLICY "withdrawal_requests_access" ON withdrawal_requests
  FOR ALL USING (
    requested_by = auth.uid()
    OR child_id IN (
      SELECT id FROM children
      WHERE parent_id = auth.uid() OR co_parent_id = auth.uid()
    )
  );

-- ────────────────────────────────────────────────────────────
-- 4. custody_zones
-- ────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS custody_zones (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID        NOT NULL REFERENCES profiles(id)  ON DELETE CASCADE,
  child_id    UUID        REFERENCES children(id)           ON DELETE SET NULL,
  name        TEXT        NOT NULL,
  zone_type   TEXT        NOT NULL,
  lat         DOUBLE PRECISION NOT NULL DEFAULT 0,
  lng         DOUBLE PRECISION NOT NULL DEFAULT 0,
  radius_m    INTEGER     NOT NULL DEFAULT 200,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE custody_zones ENABLE ROW LEVEL SECURITY;

CREATE POLICY "custody_zones_access" ON custody_zones
  FOR ALL USING (
    auth.uid() = user_id
    OR child_id IN (
      SELECT id FROM children
      WHERE parent_id = auth.uid() OR co_parent_id = auth.uid()
    )
  );

-- ────────────────────────────────────────────────────────────
-- 5. custody_checkins
-- ────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS custody_checkins (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID        NOT NULL REFERENCES profiles(id)  ON DELETE CASCADE,
  child_id    UUID        REFERENCES children(id)           ON DELETE SET NULL,
  zone_id     UUID        REFERENCES custody_zones(id)      ON DELETE SET NULL,
  event_type  TEXT        NOT NULL DEFAULT 'manual', -- enter | exit | manual
  lat         DOUBLE PRECISION,
  lng         DOUBLE PRECISION,
  notes       TEXT,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE custody_checkins ENABLE ROW LEVEL SECURITY;

CREATE POLICY "checkins_access" ON custody_checkins
  FOR ALL USING (
    auth.uid() = user_id
    OR child_id IN (
      SELECT id FROM children
      WHERE parent_id = auth.uid() OR co_parent_id = auth.uid()
    )
  );

-- ────────────────────────────────────────────────────────────
-- 6. exchange_logs
-- ────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS exchange_logs (
  id            UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       UUID        NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  child_id      UUID        REFERENCES children(id)          ON DELETE SET NULL,
  handoff_from  TEXT,
  handoff_to    TEXT,
  lat           DOUBLE PRECISION,
  lng           DOUBLE PRECISION,
  notes         TEXT,
  exchange_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE exchange_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "exchange_logs_access" ON exchange_logs
  FOR ALL USING (
    auth.uid() = user_id
    OR child_id IN (
      SELECT id FROM children
      WHERE parent_id = auth.uid() OR co_parent_id = auth.uid()
    )
  );

-- ────────────────────────────────────────────────────────────
-- 7. curfew_rules
-- ────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS curfew_rules (
  id                    UUID      PRIMARY KEY DEFAULT gen_random_uuid(),
  child_id              UUID      NOT NULL REFERENCES children(id) ON DELETE CASCADE,
  curfew_time           TIME      NOT NULL,
  days_of_week          INTEGER[] NOT NULL DEFAULT '{0,1,2,3,4,5,6}',
  alert_minutes_before  INTEGER   NOT NULL DEFAULT 15,
  active                BOOLEAN   NOT NULL DEFAULT TRUE,
  created_by            UUID      REFERENCES profiles(id),
  created_at            TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE curfew_rules ENABLE ROW LEVEL SECURITY;

CREATE POLICY "curfew_rules_access" ON curfew_rules
  FOR ALL USING (
    child_id IN (
      SELECT id FROM children
      WHERE parent_id = auth.uid() OR co_parent_id = auth.uid()
    )
  );

-- ────────────────────────────────────────────────────────────
-- 8. Add co_parent_id to children table if not already present
--    (used by several RLS policies above)
-- ────────────────────────────────────────────────────────────
ALTER TABLE children
  ADD COLUMN IF NOT EXISTS co_parent_id UUID REFERENCES profiles(id) ON DELETE SET NULL;

-- ────────────────────────────────────────────────────────────
-- Optional: Storage bucket for receipt images
-- Run separately or via Supabase dashboard:
-- INSERT INTO storage.buckets (id, name, public)
-- VALUES ('receipts', 'receipts', true)
-- ON CONFLICT DO NOTHING;
-- ────────────────────────────────────────────────────────────
