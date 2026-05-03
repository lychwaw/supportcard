-- South African ID verification audit trail.
-- The raw SA ID number is NEVER stored (PII). Only the outcome and KoraPay reference.

CREATE TABLE IF NOT EXISTS public.id_verifications (
  id                  UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id             UUID        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  korapay_reference   TEXT        UNIQUE,         -- KoraPay VR-* reference
  id_type             TEXT        NOT NULL DEFAULT 'za_said',
  status              TEXT        NOT NULL CHECK (status IN ('verified', 'failed')),
  first_name_match    BOOLEAN,
  last_name_match     BOOLEAN,
  deceased_status     TEXT,                        -- 'alive' | 'deceased'
  country_of_birth    TEXT,
  on_hanis            BOOLEAN,
  on_npr              BOOLEAN,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Users can only read their own records; writes go through the service-role API route.
ALTER TABLE public.id_verifications ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users select own verifications"
  ON public.id_verifications FOR SELECT
  USING (user_id = auth.uid());

CREATE POLICY "Service role all on id_verifications"
  ON public.id_verifications FOR ALL
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');

CREATE INDEX IF NOT EXISTS idx_id_verifications_user_id ON public.id_verifications(user_id);

-- Track verification state on the profile so the rest of the app can read it cheaply.
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS id_verified     BOOLEAN     NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS id_verified_at  TIMESTAMPTZ;
