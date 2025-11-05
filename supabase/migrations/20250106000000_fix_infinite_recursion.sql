-- Fix Infinite Recursion in RLS Policies
-- The "Users can view family members" policy was causing infinite recursion
-- because it queries profiles table which triggers the same policy again

-- ============================================
-- FIX PROFILES TABLE - Remove Recursive Policy
-- ============================================
-- Remove the problematic "Users can view family members" policy
-- It causes infinite recursion because it queries profiles which triggers itself
DROP POLICY IF EXISTS "Users can view family members" ON public.profiles;

-- Note: The "Users can view own profile" policy already exists from the performance fix
-- We don't need to recreate it - it's already there and working

-- Update children policies to remove recursive profile queries
DROP POLICY IF EXISTS "Users can view own children" ON public.children;
DROP POLICY IF EXISTS "Users can insert own children" ON public.children;
DROP POLICY IF EXISTS "Users can update own children" ON public.children;
DROP POLICY IF EXISTS "Users can delete own children" ON public.children;

-- Simplified children policies (no family_id recursion)
CREATE POLICY "Users can view own children" ON public.children 
  FOR SELECT USING (
    (select auth.uid()) = parent_id OR
    ((select auth.uid()) = user_id AND public.get_user_role((select auth.uid())) = 'child')
  );

CREATE POLICY "Users can insert own children" ON public.children 
  FOR INSERT WITH CHECK ((select auth.uid()) = parent_id);

CREATE POLICY "Users can update own children" ON public.children 
  FOR UPDATE USING ((select auth.uid()) = parent_id);

CREATE POLICY "Users can delete own children" ON public.children 
  FOR DELETE USING ((select auth.uid()) = parent_id);

-- ============================================
-- ADD AGE COLUMN TO PROFILES
-- ============================================
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS age INTEGER;

-- ============================================
-- SMART ROLE ASSIGNMENT ON SIGNUP
-- ============================================
-- Function to determine user role based on age criteria
CREATE OR REPLACE FUNCTION public.determine_user_role(
  user_id UUID, 
  user_email TEXT, 
  user_created_at TIMESTAMPTZ,
  user_age INTEGER DEFAULT NULL
)
RETURNS TEXT AS $$
DECLARE
  user_role TEXT := 'parent'; -- Default to parent
  account_age_years NUMERIC;
  calculated_age INTEGER;
BEGIN
  -- Priority 1: Use explicit age from profile if provided
  IF user_age IS NOT NULL THEN
    IF user_age < 18 THEN
      user_role := 'child';
    ELSE
      user_role := 'parent';
    END IF;
    RETURN user_role;
  END IF;
  
  -- Priority 2: Calculate age from Google account creation date
  -- Google accounts created less than 13 years ago = likely child
  -- Note: This is approximate - Google account age doesn't equal user age
  -- But we can use it as a fallback indicator
  account_age_years := EXTRACT(YEAR FROM AGE(NOW(), user_created_at));
  
  -- If account is very new (less than 13 years old), it might indicate a younger user
  -- But this is unreliable, so we'll default to parent unless we have explicit age
  -- For now, we'll only use this if account is extremely new (less than 5 years)
  -- This is a conservative approach
  
  -- Default to parent if we can't determine age
  RETURN user_role;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to auto-create user_role when profile is created or updated
CREATE OR REPLACE FUNCTION public.handle_new_user_role()
RETURNS TRIGGER AS $$
DECLARE
  assigned_role TEXT;
  user_record RECORD;
  user_age INTEGER;
BEGIN
  -- Get user info from auth.users to check metadata
  SELECT id, email, created_at, raw_user_meta_data 
  INTO user_record
  FROM auth.users 
  WHERE id = NEW.id;
  
  -- Get age from profile (may be NULL on first insert)
  user_age := NEW.age;
  
  -- Determine role based on age criteria
  assigned_role := public.determine_user_role(
    NEW.id,
    COALESCE(NEW.email, user_record.email),
    COALESCE(NEW.created_at, user_record.created_at),
    user_age
  );
  
  -- Default to 'parent' if no specific criteria match
  IF assigned_role IS NULL THEN
    assigned_role := 'parent';
  END IF;
  
  -- Check if user_role already exists
  IF EXISTS (
    SELECT 1 FROM public.user_roles WHERE user_id = NEW.id
  ) THEN
    -- Update existing role if age was just added/updated
    IF user_age IS NOT NULL THEN
      UPDATE public.user_roles 
      SET role = assigned_role
      WHERE user_id = NEW.id;
    END IF;
  ELSE
    -- Create new role
    INSERT INTO public.user_roles (user_id, role)
    VALUES (NEW.id, assigned_role);
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Drop existing triggers if they exist
DROP TRIGGER IF EXISTS on_profile_created_create_role ON public.profiles;
DROP TRIGGER IF EXISTS on_profile_updated_update_role ON public.profiles;

-- Create trigger to auto-create role when profile is created
CREATE TRIGGER on_profile_created_create_role
  AFTER INSERT ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_user_role();

-- Create trigger to update role when profile age is updated
CREATE TRIGGER on_profile_updated_update_role
  AFTER UPDATE OF age ON public.profiles
  FOR EACH ROW
  WHEN (OLD.age IS DISTINCT FROM NEW.age)
  EXECUTE FUNCTION public.handle_new_user_role();

-- ============================================
-- CREATE MISSING ROLE FOR EXISTING USERS
-- ============================================
-- For users who already signed up but don't have a role
INSERT INTO public.user_roles (user_id, role)
SELECT id, 'parent'
FROM public.profiles
WHERE id NOT IN (SELECT user_id FROM public.user_roles)
ON CONFLICT (user_id) DO NOTHING;

