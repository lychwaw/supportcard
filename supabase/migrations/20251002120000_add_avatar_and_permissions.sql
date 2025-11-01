-- Add avatar support to children table
ALTER TABLE public.children ADD COLUMN avatar_url TEXT;
ALTER TABLE public.children ADD COLUMN user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL;

-- Create user_roles table (referenced in code but missing from schema)
CREATE TABLE public.user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  role TEXT NOT NULL CHECK (role IN ('parent', 'child')),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(user_id)
);

-- Create permissions table for fine-grained access control
CREATE TABLE public.permissions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  role TEXT NOT NULL,
  resource TEXT NOT NULL, -- e.g., 'transactions', 'budget', 'cards', 'settings'
  action TEXT NOT NULL,   -- e.g., 'create', 'read', 'update', 'delete'
  allowed BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(role, resource, action)
);

-- Enable RLS on new tables
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.permissions ENABLE ROW LEVEL SECURITY;

-- RLS Policies for user_roles
CREATE POLICY "Users can view own role" ON public.user_roles FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own role" ON public.user_roles FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own role" ON public.user_roles FOR UPDATE USING (auth.uid() = user_id);

-- RLS Policies for permissions (read-only for all authenticated users)
CREATE POLICY "Authenticated users can view permissions" ON public.permissions FOR SELECT USING (auth.role() = 'authenticated');

-- Insert default permissions for parent role
INSERT INTO public.permissions (role, resource, action, allowed) VALUES
-- Parent permissions (full access)
('parent', 'dashboard', 'read', true),
('parent', 'children', 'create', true),
('parent', 'children', 'read', true),
('parent', 'children', 'update', true),
('parent', 'children', 'delete', true),
('parent', 'transactions', 'create', true),
('parent', 'transactions', 'read', true),
('parent', 'transactions', 'update', true),
('parent', 'transactions', 'delete', true),
('parent', 'budget', 'create', true),
('parent', 'budget', 'read', true),
('parent', 'budget', 'update', true),
('parent', 'budget', 'delete', true),
('parent', 'cards', 'create', true),
('parent', 'cards', 'read', true),
('parent', 'cards', 'update', true),
('parent', 'cards', 'delete', true),
('parent', 'expenses', 'create', true),
('parent', 'expenses', 'read', true),
('parent', 'expenses', 'update', true),
('parent', 'expenses', 'delete', true),
('parent', 'settings', 'read', true),
('parent', 'settings', 'update', true),
('parent', 'messages', 'create', true),
('parent', 'messages', 'read', true),
('parent', 'calendar', 'create', true),
('parent', 'calendar', 'read', true),
('parent', 'calendar', 'update', true),
('parent', 'calendar', 'delete', true),
('parent', 'contacts', 'create', true),
('parent', 'contacts', 'read', true),
('parent', 'contacts', 'update', true),
('parent', 'contacts', 'delete', true),

-- Child permissions (limited access)
('child', 'dashboard', 'read', true),
('child', 'children', 'read', false), -- Children can't see other children
('child', 'transactions', 'create', false), -- Children can't create transactions
('child', 'transactions', 'read', true),   -- Children can view their transactions
('child', 'transactions', 'update', false),
('child', 'transactions', 'delete', false),
('child', 'budget', 'create', false),
('child', 'budget', 'read', true),        -- Children can view their budget
('child', 'budget', 'update', false),
('child', 'budget', 'delete', false),
('child', 'cards', 'create', false),
('child', 'cards', 'read', true),         -- Children can view their cards
('child', 'cards', 'update', false),
('child', 'cards', 'delete', false),
('child', 'expenses', 'create', true),    -- Children can request expenses
('child', 'expenses', 'read', true),      -- Children can view their expense requests
('child', 'expenses', 'update', false),   -- Children can't approve/deny
('child', 'expenses', 'delete', false),
('child', 'settings', 'read', true),      -- Children can view limited settings
('child', 'settings', 'update', true),    -- Children can update their profile
('child', 'messages', 'create', true),    -- Children can send messages
('child', 'messages', 'read', true),      -- Children can read their messages
('child', 'calendar', 'create', false),
('child', 'calendar', 'read', true),      -- Children can view calendar events
('child', 'calendar', 'update', false),
('child', 'calendar', 'delete', false),
('child', 'contacts', 'create', false),
('child', 'contacts', 'read', false),
('child', 'contacts', 'update', false),
('child', 'contacts', 'delete', false);

-- Function to check permissions
CREATE OR REPLACE FUNCTION public.has_permission(user_role TEXT, resource_name TEXT, action_name TEXT)
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM public.permissions 
    WHERE role = user_role 
    AND resource = resource_name 
    AND action = action_name 
    AND allowed = true
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to get user role
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

-- Update RLS policies for children table to support child users
DROP POLICY IF EXISTS "Users can view own children" ON public.children;
DROP POLICY IF EXISTS "Users can insert own children" ON public.children;
DROP POLICY IF EXISTS "Users can update own children" ON public.children;
DROP POLICY IF EXISTS "Users can delete own children" ON public.children;

-- New RLS policies for children table
CREATE POLICY "Parents can manage their children" ON public.children 
  FOR ALL USING (
    auth.uid() = parent_id OR 
    (auth.uid() = user_id AND public.get_user_role(auth.uid()) = 'child')
  );

-- Update RLS policies for transactions to support child access
DROP POLICY IF EXISTS "Users can view own transactions" ON public.transactions;
DROP POLICY IF EXISTS "Users can insert own transactions" ON public.transactions;

CREATE POLICY "Users can view relevant transactions" ON public.transactions 
  FOR SELECT USING (
    auth.uid() = user_id OR
    -- Child can view transactions on cards assigned to them
    EXISTS (
      SELECT 1 FROM public.virtual_cards vc
      JOIN public.children c ON vc.child_id = c.id
      WHERE vc.id = transactions.card_id 
      AND c.user_id = auth.uid()
    )
  );

CREATE POLICY "Parents can create transactions" ON public.transactions 
  FOR INSERT WITH CHECK (
    auth.uid() = user_id AND 
    public.get_user_role(auth.uid()) = 'parent'
  );

-- Update other RLS policies to support child users
-- Budget categories
DROP POLICY IF EXISTS "Users can view own budgets" ON public.budget_categories;
CREATE POLICY "Users can view relevant budgets" ON public.budget_categories 
  FOR SELECT USING (
    auth.uid() = user_id OR
    -- Child can view budgets assigned to them
    EXISTS (
      SELECT 1 FROM public.children c
      WHERE c.id = budget_categories.child_id 
      AND c.user_id = auth.uid()
    )
  );

-- Virtual cards
DROP POLICY IF EXISTS "Users can view own cards" ON public.virtual_cards;
CREATE POLICY "Users can view relevant cards" ON public.virtual_cards 
  FOR SELECT USING (
    auth.uid() = user_id OR
    -- Child can view cards assigned to them
    EXISTS (
      SELECT 1 FROM public.children c
      WHERE c.id = virtual_cards.child_id 
      AND c.user_id = auth.uid()
    )
  );

-- Expense requests - allow children to create and view their own requests
DROP POLICY IF EXISTS "Users can view own expense requests" ON public.expense_requests;
DROP POLICY IF EXISTS "Users can insert own expense requests" ON public.expense_requests;
DROP POLICY IF EXISTS "Users can update own expense requests" ON public.expense_requests;

CREATE POLICY "Users can view relevant expense requests" ON public.expense_requests 
  FOR SELECT USING (
    auth.uid() = requester_id OR
    -- Parent can view requests for their children
    EXISTS (
      SELECT 1 FROM public.children c
      WHERE c.id = expense_requests.child_id 
      AND c.parent_id = auth.uid()
    ) OR
    -- Child can view their own requests
    EXISTS (
      SELECT 1 FROM public.children c
      WHERE c.id = expense_requests.child_id 
      AND c.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can create expense requests" ON public.expense_requests 
  FOR INSERT WITH CHECK (
    auth.uid() = requester_id
  );

CREATE POLICY "Parents can update expense requests" ON public.expense_requests 
  FOR UPDATE USING (
    -- Only parents can approve/deny requests
    public.get_user_role(auth.uid()) = 'parent' AND
    EXISTS (
      SELECT 1 FROM public.children c
      WHERE c.id = expense_requests.child_id 
      AND c.parent_id = auth.uid()
    )
  );
