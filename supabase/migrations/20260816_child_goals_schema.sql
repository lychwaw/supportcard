-- Add missing columns to child_goals table
ALTER TABLE child_goals ADD COLUMN IF NOT EXISTS title TEXT;
ALTER TABLE child_goals ADD COLUMN IF NOT EXISTS target_amount NUMERIC(12,2);
ALTER TABLE child_goals ADD COLUMN IF NOT EXISTS child_id UUID REFERENCES children(id) ON DELETE SET NULL;
ALTER TABLE child_goals ADD COLUMN IF NOT EXISTS created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL;

-- Add goal_contributions table if it doesn't exist
CREATE TABLE IF NOT EXISTS goal_contributions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  goal_id UUID REFERENCES child_goals(id) ON DELETE CASCADE,
  contributor_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  amount NUMERIC(12,2) NOT NULL,
  note TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- RLS
ALTER TABLE child_goals ENABLE ROW LEVEL SECURITY;
ALTER TABLE goal_contributions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "child_goals_owner" ON child_goals;
CREATE POLICY "child_goals_owner" ON child_goals
  FOR ALL USING (created_by = auth.uid());

DROP POLICY IF EXISTS "goal_contributions_owner" ON goal_contributions;
CREATE POLICY "goal_contributions_owner" ON goal_contributions
  FOR ALL USING (contributor_id = auth.uid());
