-- ============================================================
-- Fix: handle_new_user trigger to write role + currency from signup metadata
-- Root cause: trigger only wrote id/email/full_name; role and preferred_currency
-- from supabase.auth.signUp({ options: { data: { role, ... } } }) were silently
-- dropped. Email-signup professionals always got role=NULL → defaulted to 'parent'
-- → canAccessProfessionalPortal was always false.
-- Also fixes preferred_currency not saving on email signup (no session at signup
-- time means the client-side UPDATE is blocked by RLS).
-- ============================================================

-- 1. Ensure role column exists with a safe default
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS role TEXT NOT NULL DEFAULT 'parent';

-- 2. Backfill any existing NULLs (only possible if column existed without DEFAULT)
UPDATE public.profiles SET role = 'parent' WHERE role IS NULL;

-- 3. Rebuild handle_new_user to capture role + preferred_currency from metadata
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
DECLARE
  v_role TEXT;
  v_currency TEXT;
BEGIN
  v_role := COALESCE(
    NULLIF(TRIM(NEW.raw_user_meta_data->>'role'), ''),
    'parent'
  );
  -- Validate: only allow known roles; anything unknown falls back to parent
  IF v_role NOT IN ('parent', 'co_parent', 'child', 'professional') THEN
    v_role := 'parent';
  END IF;

  v_currency := COALESCE(
    NULLIF(TRIM(NEW.raw_user_meta_data->>'preferred_currency'), ''),
    'USD'
  );
  IF v_currency NOT IN ('USD', 'ZAR') THEN
    v_currency := 'USD';
  END IF;

  INSERT INTO public.profiles (id, email, full_name, role, preferred_currency)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NULLIF(TRIM(NEW.raw_user_meta_data->>'full_name'), ''), NEW.email),
    v_role,
    v_currency
  )
  ON CONFLICT (id) DO UPDATE
    SET
      full_name          = EXCLUDED.full_name,
      role               = EXCLUDED.role,
      preferred_currency = EXCLUDED.preferred_currency,
      updated_at         = NOW()
    WHERE
      -- Only overwrite if the row was just auto-created (no real data yet)
      profiles.full_name IS NULL OR profiles.full_name = profiles.email;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
