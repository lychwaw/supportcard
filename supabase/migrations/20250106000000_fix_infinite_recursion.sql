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
-- AUTO-CREATE USER ROLE ON SIGNUP
-- ============================================
-- Function to auto-create user_role when profile is created
CREATE OR REPLACE FUNCTION public.handle_new_user_role()
RETURNS TRIGGER AS $$
BEGIN
  -- Check if user_role already exists (avoid duplicates)
  IF NOT EXISTS (
    SELECT 1 FROM public.user_roles WHERE user_id = NEW.id
  ) THEN
    -- Create default role as 'parent'
    INSERT INTO public.user_roles (user_id, role)
    VALUES (NEW.id, 'parent');
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Drop existing trigger if it exists
DROP TRIGGER IF EXISTS on_profile_created_create_role ON public.profiles;

-- Create trigger to auto-create role when profile is created
CREATE TRIGGER on_profile_created_create_role
  AFTER INSERT ON public.profiles
  FOR EACH ROW
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

