-- ============================================================
-- Migration: Professional role + Goals contribution tracker
-- Part of the SupportCard co-parenting platform repositioning.
-- ============================================================

-- ────────────────────────────────────────────────────────────
-- 1. professional_links
-- Links a 'professional' role user (lawyer/mediator) to a parent's
-- family for scoped, read-only access. invited_email is set at
-- invite time; professional_id is filled in once that email signs
-- up (or logs in) as a professional and claims the link via token.
-- ────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS professional_links (
  id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  parent_id       UUID        NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  professional_id UUID        REFERENCES profiles(id) ON DELETE CASCADE,
  invited_email   TEXT        NOT NULL,
  token           TEXT        UNIQUE NOT NULL,
  status          TEXT        NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'active', 'revoked')),
  can_edit        BOOLEAN     NOT NULL DEFAULT FALSE,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  accepted_at     TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_professional_links_token ON professional_links(token);
CREATE INDEX IF NOT EXISTS idx_professional_links_professional ON professional_links(professional_id) WHERE professional_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_professional_links_parent ON professional_links(parent_id);

ALTER TABLE professional_links ENABLE ROW LEVEL SECURITY;

CREATE POLICY "professional_links_parent_manage" ON professional_links
  FOR ALL USING (auth.uid() = parent_id)
  WITH CHECK (auth.uid() = parent_id);

CREATE POLICY "professional_links_professional_view" ON professional_links
  FOR SELECT USING (auth.uid() = professional_id);

-- ────────────────────────────────────────────────────────────
-- Helper: is the current user an active professional for this parent?
-- Used by read-only RLS policies below. SECURITY DEFINER so it can
-- read professional_links regardless of the calling user's own RLS.
-- ────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION is_active_professional_for(target_parent_id UUID)
RETURNS BOOLEAN AS $$
  SELECT EXISTS (
    SELECT 1 FROM professional_links
    WHERE professional_id = auth.uid()
      AND parent_id = target_parent_id
      AND status = 'active'
  );
$$ LANGUAGE sql SECURITY DEFINER STABLE;

-- ────────────────────────────────────────────────────────────
-- Read-only professional access to the core record-keeping tables.
-- Scoped via children.parent_id — a professional sees everything
-- tied to children owned by a parent who has linked them.
-- ────────────────────────────────────────────────────────────
CREATE POLICY "professional_readonly_children" ON children
  FOR SELECT USING (is_active_professional_for(parent_id));

CREATE POLICY "professional_readonly_expense_requests" ON expense_requests
  FOR SELECT USING (
    child_id IN (SELECT id FROM children WHERE is_active_professional_for(parent_id))
  );

CREATE POLICY "professional_readonly_messages" ON messages
  FOR SELECT USING (
    is_active_professional_for(sender_id) OR is_active_professional_for(receiver_id)
  );

CREATE POLICY "professional_readonly_legal_documents" ON legal_documents
  FOR SELECT USING (
    child_id IN (SELECT id FROM children WHERE is_active_professional_for(parent_id))
  );

CREATE POLICY "professional_readonly_checkins" ON custody_checkins
  FOR SELECT USING (
    child_id IN (SELECT id FROM children WHERE is_active_professional_for(parent_id))
  );

CREATE POLICY "professional_readonly_exchange_logs" ON exchange_logs
  FOR SELECT USING (
    child_id IN (SELECT id FROM children WHERE is_active_professional_for(parent_id))
  );

-- ────────────────────────────────────────────────────────────
-- 2. Goals & contribution tracker
-- Append-only ledger of logged pledges toward a child goal.
-- No balance column anywhere — progress is always SUM(contributions),
-- computed at read time. SupportCard never holds or moves the money.
-- ────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS child_goals (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  child_id    UUID        NOT NULL REFERENCES children(id) ON DELETE CASCADE,
  name        TEXT        NOT NULL,
  target_amount NUMERIC(12,2) NOT NULL CHECK (target_amount > 0),
  notes       TEXT,
  created_by  UUID        REFERENCES profiles(id),
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE child_goals ENABLE ROW LEVEL SECURITY;

CREATE POLICY "child_goals_family_access" ON child_goals
  FOR ALL USING (
    child_id IN (
      SELECT id FROM children
      WHERE parent_id = auth.uid() OR co_parent_id = auth.uid()
    )
  );

CREATE TABLE IF NOT EXISTS goal_contributions (
  id             UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  goal_id        UUID        NOT NULL REFERENCES child_goals(id) ON DELETE CASCADE,
  contributor_id UUID        NOT NULL REFERENCES profiles(id),
  amount         NUMERIC(12,2) NOT NULL CHECK (amount > 0),
  note           TEXT,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_goal_contributions_goal ON goal_contributions(goal_id);

ALTER TABLE goal_contributions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "goal_contributions_family_access" ON goal_contributions
  FOR ALL USING (
    goal_id IN (
      SELECT g.id FROM child_goals g
      JOIN children c ON c.id = g.child_id
      WHERE c.parent_id = auth.uid() OR c.co_parent_id = auth.uid()
    )
  );

-- Professionals also get read-only visibility into goals (part of the
-- "Document" pillar's record-keeping, useful for court export context).
CREATE POLICY "professional_readonly_child_goals" ON child_goals
  FOR SELECT USING (
    child_id IN (SELECT id FROM children WHERE is_active_professional_for(parent_id))
  );

CREATE POLICY "professional_readonly_goal_contributions" ON goal_contributions
  FOR SELECT USING (
    goal_id IN (
      SELECT g.id FROM child_goals g
      JOIN children c ON c.id = g.child_id
      WHERE is_active_professional_for(c.parent_id)
    )
  );
