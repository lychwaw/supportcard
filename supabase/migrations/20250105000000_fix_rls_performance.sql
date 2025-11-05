-- Fix RLS Performance Issues
-- This migration optimizes all RLS policies by wrapping auth.uid() in (select auth.uid())
-- This prevents the function from being re-evaluated for each row, improving query performance

-- ============================================
-- ENSURE REQUIRED COLUMNS AND TABLES EXIST
-- ============================================
-- Add family_id column if it doesn't exist (from family support migration)
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS family_id TEXT;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS parent_role TEXT CHECK (parent_role IN ('payer', 'receiver', 'both'));
ALTER TABLE public.children ADD COLUMN IF NOT EXISTS co_parent_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL;

-- Create parent_invites table if it doesn't exist (from family support migration)
CREATE TABLE IF NOT EXISTS public.parent_invites (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  inviter_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
  invited_email TEXT NOT NULL,
  invited_phone TEXT,
  child_id UUID REFERENCES public.children(id) ON DELETE CASCADE NOT NULL,
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'declined', 'expired')),
  token TEXT UNIQUE NOT NULL,
  expires_at TIMESTAMP WITH TIME ZONE DEFAULT (NOW() + INTERVAL '7 days'),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  accepted_at TIMESTAMP WITH TIME ZONE
);

-- Enable RLS on parent_invites if not already enabled
ALTER TABLE public.parent_invites ENABLE ROW LEVEL SECURITY;

-- Create indexes if they don't exist
CREATE INDEX IF NOT EXISTS idx_parent_invites_token ON public.parent_invites(token);
CREATE INDEX IF NOT EXISTS idx_parent_invites_email ON public.parent_invites(invited_email);
CREATE INDEX IF NOT EXISTS idx_profiles_family_id ON public.profiles(family_id) WHERE family_id IS NOT NULL;

-- ============================================
-- HELPER FUNCTIONS (Ensure they exist)
-- ============================================
-- Function to get user role (needed for some policies)
CREATE OR REPLACE FUNCTION public.get_user_role(user_uuid UUID)
RETURNS TEXT AS $$
DECLARE
  user_role TEXT;
BEGIN
  SELECT role INTO user_role 
  FROM public.user_roles 
  WHERE user_id = user_uuid;
  
  RETURN COALESCE(user_role, 'parent'); -- Default to parent if no role found
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================
-- PROFILES TABLE
-- ============================================
DROP POLICY IF EXISTS "Users can view own profile" ON public.profiles;
DROP POLICY IF EXISTS "Users can update own profile" ON public.profiles;
DROP POLICY IF EXISTS "Users can insert own profile" ON public.profiles;

CREATE POLICY "Users can view own profile" ON public.profiles 
  FOR SELECT USING ((select auth.uid()) = id);
CREATE POLICY "Users can update own profile" ON public.profiles 
  FOR UPDATE USING ((select auth.uid()) = id);
CREATE POLICY "Users can insert own profile" ON public.profiles 
  FOR INSERT WITH CHECK ((select auth.uid()) = id);

-- ============================================
-- CHILDREN TABLE
-- ============================================
DROP POLICY IF EXISTS "Users can view own children" ON public.children;
DROP POLICY IF EXISTS "Users can insert own children" ON public.children;
DROP POLICY IF EXISTS "Users can update own children" ON public.children;
DROP POLICY IF EXISTS "Users can delete own children" ON public.children;
DROP POLICY IF EXISTS "Parents can manage their children" ON public.children;

-- Recreate with optimized policies (supporting both child users AND family sharing)
CREATE POLICY "Users can view own children" ON public.children 
  FOR SELECT USING (
    (select auth.uid()) = parent_id OR
    ((select auth.uid()) = user_id AND public.get_user_role((select auth.uid())) = 'child') OR
    EXISTS (
      SELECT 1 FROM public.profiles 
      WHERE id = (select auth.uid()) 
      AND family_id IS NOT NULL 
      AND family_id = (SELECT family_id FROM public.profiles WHERE id = children.parent_id)
    )
  );

CREATE POLICY "Users can insert own children" ON public.children 
  FOR INSERT WITH CHECK (
    (select auth.uid()) = parent_id OR
    EXISTS (
      SELECT 1 FROM public.profiles 
      WHERE id = (select auth.uid()) 
      AND family_id IS NOT NULL 
      AND family_id = (SELECT family_id FROM public.profiles WHERE id = parent_id)
    )
  );

CREATE POLICY "Users can update own children" ON public.children 
  FOR UPDATE USING (
    (select auth.uid()) = parent_id OR
    EXISTS (
      SELECT 1 FROM public.profiles 
      WHERE id = (select auth.uid()) 
      AND family_id IS NOT NULL 
      AND family_id = (SELECT family_id FROM public.profiles WHERE id = parent_id)
    )
  );

CREATE POLICY "Users can delete own children" ON public.children 
  FOR DELETE USING (
    (select auth.uid()) = parent_id OR
    EXISTS (
      SELECT 1 FROM public.profiles 
      WHERE id = (select auth.uid()) 
      AND family_id IS NOT NULL 
      AND family_id = (SELECT family_id FROM public.profiles WHERE id = parent_id)
    )
  );

-- ============================================
-- VIRTUAL_CARDS TABLE
-- ============================================
DROP POLICY IF EXISTS "Users can view own cards" ON public.virtual_cards;
DROP POLICY IF EXISTS "Users can insert own cards" ON public.virtual_cards;
DROP POLICY IF EXISTS "Users can update own cards" ON public.virtual_cards;
DROP POLICY IF EXISTS "Users can delete own cards" ON public.virtual_cards;
DROP POLICY IF EXISTS "Users can view relevant cards" ON public.virtual_cards;

-- Recreate with optimized policies (keeping child user support)
CREATE POLICY "Users can view relevant cards" ON public.virtual_cards 
  FOR SELECT USING (
    (select auth.uid()) = user_id OR
    EXISTS (
      SELECT 1 FROM public.children c
      WHERE c.id = virtual_cards.child_id 
      AND c.user_id = (select auth.uid())
    )
  );
CREATE POLICY "Users can insert own cards" ON public.virtual_cards 
  FOR INSERT WITH CHECK ((select auth.uid()) = user_id);
CREATE POLICY "Users can update own cards" ON public.virtual_cards 
  FOR UPDATE USING ((select auth.uid()) = user_id);
CREATE POLICY "Users can delete own cards" ON public.virtual_cards 
  FOR DELETE USING ((select auth.uid()) = user_id);

-- ============================================
-- TRANSACTIONS TABLE
-- ============================================
DROP POLICY IF EXISTS "Users can view own transactions" ON public.transactions;
DROP POLICY IF EXISTS "Users can insert own transactions" ON public.transactions;
DROP POLICY IF EXISTS "Users can view relevant transactions" ON public.transactions;
DROP POLICY IF EXISTS "Parents can create transactions" ON public.transactions;

-- Recreate with optimized policies (keeping child user support)
CREATE POLICY "Users can view relevant transactions" ON public.transactions 
  FOR SELECT USING (
    (select auth.uid()) = user_id OR
    EXISTS (
      SELECT 1 FROM public.virtual_cards vc
      JOIN public.children c ON vc.child_id = c.id
      WHERE vc.id = transactions.card_id 
      AND c.user_id = (select auth.uid())
    )
  );
CREATE POLICY "Parents can create transactions" ON public.transactions 
  FOR INSERT WITH CHECK (
    (select auth.uid()) = user_id AND 
    public.get_user_role((select auth.uid())) = 'parent'
  );

-- ============================================
-- EXPENSE_REQUESTS TABLE
-- ============================================
DROP POLICY IF EXISTS "Users can view own expense requests" ON public.expense_requests;
DROP POLICY IF EXISTS "Users can insert own expense requests" ON public.expense_requests;
DROP POLICY IF EXISTS "Users can update own expense requests" ON public.expense_requests;
DROP POLICY IF EXISTS "Users can view relevant expense requests" ON public.expense_requests;
DROP POLICY IF EXISTS "Users can create expense requests" ON public.expense_requests;
DROP POLICY IF EXISTS "Parents can update expense requests" ON public.expense_requests;

-- Recreate with optimized policies (keeping child user support)
CREATE POLICY "Users can view relevant expense requests" ON public.expense_requests 
  FOR SELECT USING (
    (select auth.uid()) = requester_id OR
    EXISTS (
      SELECT 1 FROM public.children c
      WHERE c.id = expense_requests.child_id 
      AND c.parent_id = (select auth.uid())
    ) OR
    EXISTS (
      SELECT 1 FROM public.children c
      WHERE c.id = expense_requests.child_id 
      AND c.user_id = (select auth.uid())
    )
  );
CREATE POLICY "Users can create expense requests" ON public.expense_requests 
  FOR INSERT WITH CHECK ((select auth.uid()) = requester_id);
CREATE POLICY "Parents can update expense requests" ON public.expense_requests 
  FOR UPDATE USING (
    public.get_user_role((select auth.uid())) = 'parent' AND
    EXISTS (
      SELECT 1 FROM public.children c
      WHERE c.id = expense_requests.child_id 
      AND c.parent_id = (select auth.uid())
    )
  );

-- ============================================
-- BUDGET_CATEGORIES TABLE
-- ============================================
DROP POLICY IF EXISTS "Users can view own budgets" ON public.budget_categories;
DROP POLICY IF EXISTS "Users can insert own budgets" ON public.budget_categories;
DROP POLICY IF EXISTS "Users can update own budgets" ON public.budget_categories;
DROP POLICY IF EXISTS "Users can delete own budgets" ON public.budget_categories;
DROP POLICY IF EXISTS "Users can view relevant budgets" ON public.budget_categories;

-- Recreate with optimized policies (keeping child user support)
CREATE POLICY "Users can view relevant budgets" ON public.budget_categories 
  FOR SELECT USING (
    (select auth.uid()) = user_id OR
    EXISTS (
      SELECT 1 FROM public.children c
      WHERE c.id = budget_categories.child_id 
      AND c.user_id = (select auth.uid())
    )
  );
CREATE POLICY "Users can insert own budgets" ON public.budget_categories 
  FOR INSERT WITH CHECK ((select auth.uid()) = user_id);
CREATE POLICY "Users can update own budgets" ON public.budget_categories 
  FOR UPDATE USING ((select auth.uid()) = user_id);
CREATE POLICY "Users can delete own budgets" ON public.budget_categories 
  FOR DELETE USING ((select auth.uid()) = user_id);

-- ============================================
-- CALENDAR_EVENTS TABLE
-- ============================================
DROP POLICY IF EXISTS "Users can view own events" ON public.calendar_events;
DROP POLICY IF EXISTS "Users can insert own events" ON public.calendar_events;
DROP POLICY IF EXISTS "Users can update own events" ON public.calendar_events;
DROP POLICY IF EXISTS "Users can delete own events" ON public.calendar_events;

CREATE POLICY "Users can view own events" ON public.calendar_events 
  FOR SELECT USING ((select auth.uid()) = user_id);
CREATE POLICY "Users can insert own events" ON public.calendar_events 
  FOR INSERT WITH CHECK ((select auth.uid()) = user_id);
CREATE POLICY "Users can update own events" ON public.calendar_events 
  FOR UPDATE USING ((select auth.uid()) = user_id);
CREATE POLICY "Users can delete own events" ON public.calendar_events 
  FOR DELETE USING ((select auth.uid()) = user_id);

-- ============================================
-- EMERGENCY_CONTACTS TABLE
-- ============================================
DROP POLICY IF EXISTS "Users can view own contacts" ON public.emergency_contacts;
DROP POLICY IF EXISTS "Users can insert own contacts" ON public.emergency_contacts;
DROP POLICY IF EXISTS "Users can update own contacts" ON public.emergency_contacts;
DROP POLICY IF EXISTS "Users can delete own contacts" ON public.emergency_contacts;

CREATE POLICY "Users can view own contacts" ON public.emergency_contacts 
  FOR SELECT USING ((select auth.uid()) = user_id);
CREATE POLICY "Users can insert own contacts" ON public.emergency_contacts 
  FOR INSERT WITH CHECK ((select auth.uid()) = user_id);
CREATE POLICY "Users can update own contacts" ON public.emergency_contacts 
  FOR UPDATE USING ((select auth.uid()) = user_id);
CREATE POLICY "Users can delete own contacts" ON public.emergency_contacts 
  FOR DELETE USING ((select auth.uid()) = user_id);

-- ============================================
-- MESSAGES TABLE
-- ============================================
DROP POLICY IF EXISTS "Users can view sent messages" ON public.messages;
DROP POLICY IF EXISTS "Users can insert messages" ON public.messages;

CREATE POLICY "Users can view sent messages" ON public.messages 
  FOR SELECT USING ((select auth.uid()) = sender_id OR (select auth.uid()) = receiver_id);
CREATE POLICY "Users can insert messages" ON public.messages 
  FOR INSERT WITH CHECK ((select auth.uid()) = sender_id);

-- ============================================
-- PAYMENT_METHODS TABLE
-- ============================================
DROP POLICY IF EXISTS "Users can view own payment methods" ON public.payment_methods;
DROP POLICY IF EXISTS "Users can insert own payment methods" ON public.payment_methods;
DROP POLICY IF EXISTS "Users can update own payment methods" ON public.payment_methods;
DROP POLICY IF EXISTS "Users can delete own payment methods" ON public.payment_methods;

CREATE POLICY "Users can view own payment methods" ON public.payment_methods 
  FOR SELECT USING ((select auth.uid()) = user_id);
CREATE POLICY "Users can insert own payment methods" ON public.payment_methods 
  FOR INSERT WITH CHECK ((select auth.uid()) = user_id);
CREATE POLICY "Users can update own payment methods" ON public.payment_methods 
  FOR UPDATE USING ((select auth.uid()) = user_id);
CREATE POLICY "Users can delete own payment methods" ON public.payment_methods 
  FOR DELETE USING ((select auth.uid()) = user_id);

-- ============================================
-- USER_ROLES TABLE
-- ============================================
-- Fix duplicate policies: Remove both "role" (singular) and "roles" (plural) policies
-- Keep only one set with consistent naming
DROP POLICY IF EXISTS "Users can view own role" ON public.user_roles;
DROP POLICY IF EXISTS "Users can insert own role" ON public.user_roles;
DROP POLICY IF EXISTS "Users can update own role" ON public.user_roles;
DROP POLICY IF EXISTS "Users can view own roles" ON public.user_roles;
DROP POLICY IF EXISTS "Users can insert own roles" ON public.user_roles;
DROP POLICY IF EXISTS "Users can update own roles" ON public.user_roles;
DROP POLICY IF EXISTS "Users can delete own roles" ON public.user_roles;

-- Create single set of policies with optimized auth.uid() calls
CREATE POLICY "Users can view own roles" ON public.user_roles 
  FOR SELECT USING ((select auth.uid()) = user_id);
CREATE POLICY "Users can insert own roles" ON public.user_roles 
  FOR INSERT WITH CHECK ((select auth.uid()) = user_id);
CREATE POLICY "Users can update own roles" ON public.user_roles 
  FOR UPDATE USING ((select auth.uid()) = user_id);

-- ============================================
-- PERMISSIONS TABLE
-- ============================================
DROP POLICY IF EXISTS "Authenticated users can view permissions" ON public.permissions;

CREATE POLICY "Authenticated users can view permissions" ON public.permissions 
  FOR SELECT USING ((select auth.role()) = 'authenticated');

-- ============================================
-- PARENT_INVITES TABLE (from family support migration)
-- ============================================
DROP POLICY IF EXISTS "Users can view invitations they sent" ON public.parent_invites;
DROP POLICY IF EXISTS "Users can view invitations sent to them" ON public.parent_invites;
DROP POLICY IF EXISTS "Users can create invitations for their children" ON public.parent_invites;
DROP POLICY IF EXISTS "Users can update their invitations" ON public.parent_invites;

CREATE POLICY "Users can view invitations they sent" ON public.parent_invites 
  FOR SELECT USING ((select auth.uid()) = inviter_id);
CREATE POLICY "Users can view invitations sent to them" ON public.parent_invites 
  FOR SELECT USING (
    invited_email = (SELECT email FROM public.profiles WHERE id = (select auth.uid()))
  );
CREATE POLICY "Users can create invitations for their children" ON public.parent_invites 
  FOR INSERT WITH CHECK ((select auth.uid()) = inviter_id AND EXISTS (
    SELECT 1 FROM public.children WHERE id = child_id AND parent_id = (select auth.uid())
  ));
CREATE POLICY "Users can update their invitations" ON public.parent_invites 
  FOR UPDATE USING ((select auth.uid()) = inviter_id OR invited_email = (
    SELECT email FROM public.profiles WHERE id = (select auth.uid())
  ));

-- ============================================
-- PROFILES TABLE - Family Support Policy
-- ============================================
DROP POLICY IF EXISTS "Users can view family members" ON public.profiles;

CREATE POLICY "Users can view family members" ON public.profiles 
  FOR SELECT USING (
    (select auth.uid()) = id OR 
    (family_id IS NOT NULL AND family_id = (
      SELECT family_id FROM public.profiles WHERE id = (select auth.uid())
    ))
  );

