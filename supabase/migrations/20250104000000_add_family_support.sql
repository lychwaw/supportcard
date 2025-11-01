-- Add family_id support for grouping parents and children
-- This allows multiple parents to be part of the same family unit

-- Add family_id to profiles table
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS family_id TEXT;

-- Add parent_role to profiles - tracks if they're payer or receiver
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS parent_role TEXT CHECK (parent_role IN ('payer', 'receiver', 'both'));

-- Add parent_role to children table to link to co-parent
ALTER TABLE public.children ADD COLUMN IF NOT EXISTS co_parent_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL;

-- Create index for faster family queries
CREATE INDEX IF NOT EXISTS idx_profiles_family_id ON public.profiles(family_id) WHERE family_id IS NOT NULL;

-- Add comments
COMMENT ON COLUMN public.profiles.family_id IS 'Family group identifier - parents in same family share this ID';
COMMENT ON COLUMN public.profiles.parent_role IS 'Role of parent: payer (sends money), receiver (manages spending), or both';
COMMENT ON COLUMN public.children.co_parent_id IS 'Links to the co-parent profile (Parent A/B sharing same child)';

-- Create parent_invites table for inviting other parents to join family
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

-- Create index for token lookups
CREATE INDEX IF NOT EXISTS idx_parent_invites_token ON public.parent_invites(token);
CREATE INDEX IF NOT EXISTS idx_parent_invites_email ON public.parent_invites(invited_email);

-- Enable RLS on parent_invites
ALTER TABLE public.parent_invites ENABLE ROW LEVEL SECURITY;

-- RLS Policies for parent_invites
CREATE POLICY "Users can view invitations they sent" ON public.parent_invites 
  FOR SELECT USING (auth.uid() = inviter_id);

CREATE POLICY "Users can view invitations sent to them" ON public.parent_invites 
  FOR SELECT USING (
    invited_email = (SELECT email FROM public.profiles WHERE id = auth.uid())
  );

CREATE POLICY "Users can create invitations for their children" ON public.parent_invites 
  FOR INSERT WITH CHECK (auth.uid() = inviter_id AND EXISTS (
    SELECT 1 FROM public.children WHERE id = child_id AND parent_id = auth.uid()
  ));

CREATE POLICY "Users can update their invitations" ON public.parent_invites 
  FOR UPDATE USING (auth.uid() = inviter_id OR invited_email = (
    SELECT email FROM public.profiles WHERE id = auth.uid()
  ));

-- Update RLS policies to allow family members to view each other's profiles
-- This will allow Parent A and Parent B to see each other's children in the same family
DROP POLICY IF EXISTS "Users can view family members" ON public.profiles;
CREATE POLICY "Users can view family members" ON public.profiles 
  FOR SELECT USING (
    auth.uid() = id OR 
    (family_id IS NOT NULL AND family_id = (SELECT family_id FROM public.profiles WHERE id = auth.uid()))
  );

-- Update children RLS to allow both parents to view and manage children in their family
DROP POLICY IF EXISTS "Users can view own children" ON public.children;
CREATE POLICY "Users can view own children" ON public.children 
  FOR SELECT USING (
    auth.uid() = parent_id OR
    EXISTS (
      SELECT 1 FROM public.profiles 
      WHERE id = auth.uid() 
      AND family_id IS NOT NULL 
      AND family_id = (SELECT family_id FROM public.profiles WHERE id = children.parent_id)
    )
  );

DROP POLICY IF EXISTS "Users can insert own children" ON public.children;
CREATE POLICY "Users can insert own children" ON public.children 
  FOR INSERT WITH CHECK (
    auth.uid() = parent_id OR
    EXISTS (
      SELECT 1 FROM public.profiles 
      WHERE id = auth.uid() 
      AND family_id IS NOT NULL 
      AND family_id = (SELECT family_id FROM public.profiles WHERE id = parent_id)
    )
  );

DROP POLICY IF EXISTS "Users can update own children" ON public.children;
CREATE POLICY "Users can update own children" ON public.children 
  FOR UPDATE USING (
    auth.uid() = parent_id OR
    EXISTS (
      SELECT 1 FROM public.profiles 
      WHERE id = auth.uid() 
      AND family_id IS NOT NULL 
      AND family_id = (SELECT family_id FROM public.profiles WHERE id = parent_id)
    )
  );

DROP POLICY IF EXISTS "Users can delete own children" ON public.children;
CREATE POLICY "Users can delete own children" ON public.children 
  FOR DELETE USING (
    auth.uid() = parent_id OR
    EXISTS (
      SELECT 1 FROM public.profiles 
      WHERE id = auth.uid() 
      AND family_id IS NOT NULL 
      AND family_id = (SELECT family_id FROM public.profiles WHERE id = parent_id)
    )
  );

