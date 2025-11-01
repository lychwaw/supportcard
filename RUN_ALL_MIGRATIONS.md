# Run ALL Migrations in Order

Your Supabase database needs ALL migrations run. Do them in THIS order:

---

## Migration 1: Base Schema (20251001212404)

Run this FIRST - it creates all the base tables:

```sql
-- Create profiles table
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name TEXT,
  email TEXT,
  phone TEXT,
  avatar_url TEXT,
  preferred_currency TEXT DEFAULT 'USD',
  id_verification_url TEXT,
  id_verified BOOLEAN DEFAULT FALSE,
  subscription_tier TEXT DEFAULT 'Free',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create user_roles table
CREATE TABLE public.user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
  role TEXT NOT NULL DEFAULT 'parent',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create children table
CREATE TABLE public.children (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  parent_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
  name TEXT NOT NULL,
  target_amount DECIMAL(10, 2) DEFAULT 0,
  current_amount DECIMAL(10, 2) DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create virtual_cards table
CREATE TABLE public.virtual_cards (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
  child_id UUID REFERENCES public.children(id) ON DELETE SET NULL,
  card_number TEXT NOT NULL,
  card_type TEXT DEFAULT 'VISA',
  balance DECIMAL(10, 2) DEFAULT 0,
  is_primary BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create transactions table
CREATE TABLE public.transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
  card_id UUID REFERENCES public.virtual_cards(id) ON DELETE SET NULL,
  merchant_name TEXT,
  amount DECIMAL(10, 2) NOT NULL,
  category TEXT,
  transaction_date TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  location TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create expense_requests table
CREATE TABLE public.expense_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  requester_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
  child_id UUID REFERENCES public.children(id) ON DELETE CASCADE,
  amount DECIMAL(10, 2) NOT NULL,
  category TEXT NOT NULL,
  description TEXT,
  receipt_url TEXT,
  status TEXT DEFAULT 'pending',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create budget_categories table
CREATE TABLE public.budget_categories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
  child_id UUID REFERENCES public.children(id) ON DELETE CASCADE,
  category TEXT NOT NULL,
  monthly_limit DECIMAL(10, 2) NOT NULL,
  current_spent DECIMAL(10, 2) DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create calendar_events table
CREATE TABLE public.calendar_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
  child_id UUID REFERENCES public.children(id) ON DELETE CASCADE,
  event_date DATE NOT NULL,
  event_type TEXT,
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create emergency_contacts table
CREATE TABLE public.emergency_contacts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
  name TEXT NOT NULL,
  relationship TEXT,
  phone TEXT NOT NULL,
  email TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create messages table
CREATE TABLE public.messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  sender_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
  receiver_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
  content TEXT NOT NULL,
  read BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create payment_methods table
CREATE TABLE public.payment_methods (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
  method_type TEXT NOT NULL,
  last_four TEXT,
  is_default BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Enable Row Level Security
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.children ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.virtual_cards ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.expense_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.budget_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.calendar_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.emergency_contacts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payment_methods ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

-- RLS Policies for profiles
CREATE POLICY "Users can view own profile" ON public.profiles FOR SELECT USING (auth.uid() = id);
CREATE POLICY "Users can update own profile" ON public.profiles FOR UPDATE USING (auth.uid() = id);
CREATE POLICY "Users can insert own profile" ON public.profiles FOR INSERT WITH CHECK (auth.uid() = id);

-- RLS Policies for children
CREATE POLICY "Users can view own children" ON public.children FOR SELECT USING (auth.uid() = parent_id);
CREATE POLICY "Users can insert own children" ON public.children FOR INSERT WITH CHECK (auth.uid() = parent_id);
CREATE POLICY "Users can update own children" ON public.children FOR UPDATE USING (auth.uid() = parent_id);
CREATE POLICY "Users can delete own children" ON public.children FOR DELETE USING (auth.uid() = parent_id);

-- RLS Policies for virtual_cards
CREATE POLICY "Users can view own cards" ON public.virtual_cards FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own cards" ON public.virtual_cards FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own cards" ON public.virtual_cards FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own cards" ON public.virtual_cards FOR DELETE USING (auth.uid() = user_id);

-- RLS Policies for transactions
CREATE POLICY "Users can view own transactions" ON public.transactions FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own transactions" ON public.transactions FOR INSERT WITH CHECK (auth.uid() = user_id);

-- RLS Policies for expense_requests
CREATE POLICY "Users can view own expense requests" ON public.expense_requests FOR SELECT USING (auth.uid() = requester_id);
CREATE POLICY "Users can insert own expense requests" ON public.expense_requests FOR INSERT WITH CHECK (auth.uid() = requester_id);
CREATE POLICY "Users can update own expense requests" ON public.expense_requests FOR UPDATE USING (auth.uid() = requester_id);

-- RLS Policies for budget_categories
CREATE POLICY "Users can view own budgets" ON public.budget_categories FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own budgets" ON public.budget_categories FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own budgets" ON public.budget_categories FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own budgets" ON public.budget_categories FOR DELETE USING (auth.uid() = user_id);

-- RLS Policies for calendar_events
CREATE POLICY "Users can view own events" ON public.calendar_events FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own events" ON public.calendar_events FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own events" ON public.calendar_events FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own events" ON public.calendar_events FOR DELETE USING (auth.uid() = user_id);

-- RLS Policies for emergency_contacts
CREATE POLICY "Users can view own contacts" ON public.emergency_contacts FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own contacts" ON public.emergency_contacts FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own contacts" ON public.emergency_contacts FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own contacts" ON public.emergency_contacts FOR DELETE USING (auth.uid() = user_id);

-- RLS Policies for messages
CREATE POLICY "Users can view sent messages" ON public.messages FOR SELECT USING (auth.uid() = sender_id OR auth.uid() = receiver_id);
CREATE POLICY "Users can insert messages" ON public.messages FOR INSERT WITH CHECK (auth.uid() = sender_id);

-- RLS Policies for payment_methods
CREATE POLICY "Users can view own payment methods" ON public.payment_methods FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own payment methods" ON public.payment_methods FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own payment methods" ON public.payment_methods FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own payment methods" ON public.payment_methods FOR DELETE USING (auth.uid() = user_id);

-- RLS Policies for user_roles
CREATE POLICY "Users can view own roles" ON public.user_roles FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own roles" ON public.user_roles FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Create trigger function for updating timestamps
CREATE OR REPLACE FUNCTION public.handle_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Add triggers for updated_at
CREATE TRIGGER set_profiles_updated_at BEFORE UPDATE ON public.profiles FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();
CREATE TRIGGER set_children_updated_at BEFORE UPDATE ON public.children FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();
CREATE TRIGGER set_expense_requests_updated_at BEFORE UPDATE ON public.expense_requests FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

-- Create trigger to auto-create profile on signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, email, full_name)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.email)
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();
```

---

## Migration 2: Avatar & Permissions (20251002120000)

Run this SECOND:

```sql
-- Add avatar support to children table
ALTER TABLE public.children ADD COLUMN IF NOT EXISTS avatar_url TEXT;
ALTER TABLE public.children ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL;

-- Create user_roles table (referenced in code but missing from schema)
CREATE TABLE IF NOT EXISTS public.user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  role TEXT NOT NULL CHECK (role IN ('parent', 'child')),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(user_id)
);

-- Create permissions table for fine-grained access control
CREATE TABLE IF NOT EXISTS public.permissions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  role TEXT NOT NULL,
  resource TEXT NOT NULL,
  action TEXT NOT NULL,
  allowed BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(role, resource, action)
);

-- Enable RLS on new tables
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.permissions ENABLE ROW LEVEL SECURITY;

-- RLS Policies for user_roles
CREATE POLICY IF NOT EXISTS "Users can view own role" ON public.user_roles FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY IF NOT EXISTS "Users can insert own role" ON public.user_roles FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY IF NOT EXISTS "Users can update own role" ON public.user_roles FOR UPDATE USING (auth.uid() = user_id);

-- RLS Policies for permissions (read-only for all authenticated users)
CREATE POLICY IF NOT EXISTS "Authenticated users can view permissions" ON public.permissions FOR SELECT USING (auth.role() = 'authenticated');

-- Insert default permissions for parent role
INSERT INTO public.permissions (role, resource, action, allowed) VALUES
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
('child', 'dashboard', 'read', true),
('child', 'children', 'read', false),
('child', 'transactions', 'create', false),
('child', 'transactions', 'read', true),
('child', 'transactions', 'update', false),
('child', 'transactions', 'delete', false),
('child', 'budget', 'create', false),
('child', 'budget', 'read', true),
('child', 'budget', 'update', false),
('child', 'budget', 'delete', false),
('child', 'cards', 'create', false),
('child', 'cards', 'read', true),
('child', 'cards', 'update', false),
('child', 'cards', 'delete', false),
('child', 'expenses', 'create', true),
('child', 'expenses', 'read', true),
('child', 'expenses', 'update', false),
('child', 'expenses', 'delete', false),
('child', 'messages', 'create', true),
('child', 'messages', 'read', true),
('child', 'calendar', 'read', true),
('child', 'settings', 'read', true)
ON CONFLICT (role, resource, action) DO NOTHING;
```

---

## Migration 3: Bio Column (20251002140000)

Run this THIRD:

```sql
-- Add bio to profiles
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS bio TEXT;
```

---

## Migration 4: Family Support (20250104000000)

Run this LAST:

```sql
-- Add family_id support for grouping parents and children
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS family_id TEXT;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS parent_role TEXT CHECK (parent_role IN ('payer', 'receiver', 'both'));
ALTER TABLE public.children ADD COLUMN IF NOT EXISTS co_parent_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_profiles_family_id ON public.profiles(family_id) WHERE family_id IS NOT NULL;

COMMENT ON COLUMN public.profiles.family_id IS 'Family group identifier - parents in same family share this ID';
COMMENT ON COLUMN public.profiles.parent_role IS 'Role of parent: payer (sends money), receiver (manages spending), or both';
COMMENT ON COLUMN public.children.co_parent_id IS 'Links to the co-parent profile (Parent A/B sharing same child)';

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

CREATE INDEX IF NOT EXISTS idx_parent_invites_token ON public.parent_invites(token);
CREATE INDEX IF NOT EXISTS idx_parent_invites_email ON public.parent_invites(invited_email);

ALTER TABLE public.parent_invites ENABLE ROW LEVEL SECURITY;

CREATE POLICY IF NOT EXISTS "Users can view invitations they sent" ON public.parent_invites 
  FOR SELECT USING (auth.uid() = inviter_id);

CREATE POLICY IF NOT EXISTS "Users can view invitations sent to them" ON public.parent_invites 
  FOR SELECT USING (
    invited_email = (SELECT email FROM public.profiles WHERE id = auth.uid())
  );

CREATE POLICY IF NOT EXISTS "Users can create invitations for their children" ON public.parent_invites 
  FOR INSERT WITH CHECK (auth.uid() = inviter_id AND EXISTS (
    SELECT 1 FROM public.children WHERE id = child_id AND parent_id = auth.uid()
  ));

CREATE POLICY IF NOT EXISTS "Users can update their invitations" ON public.parent_invites 
  FOR UPDATE USING (auth.uid() = inviter_id OR invited_email = (
    SELECT email FROM public.profiles WHERE id = auth.uid()
  ));

DROP POLICY IF EXISTS "Users can view family members" ON public.profiles;
CREATE POLICY "Users can view family members" ON public.profiles 
  FOR SELECT USING (
    auth.uid() = id OR 
    (family_id IS NOT NULL AND family_id = (SELECT family_id FROM public.profiles WHERE id = auth.uid()))
  );

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
```

---

## How to Run

1. Go to https://app.supabase.com
2. SQL Editor → New Query
3. Copy/paste Migration 1, click Run
4. New Query again
5. Copy/paste Migration 2, click Run  
6. New Query again
7. Copy/paste Migration 3, click Run
8. New Query again
9. Copy/paste Migration 4, click Run

**DONE!** ✅



