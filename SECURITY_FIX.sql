-- Fix Supabase security warnings
-- Run this in Supabase SQL Editor if you're getting security warnings

-- Add IF NOT EXISTS to all policies to prevent conflicts

-- Add missing RLS policies for delete operations on expense_requests
DROP POLICY IF EXISTS "Users can delete own expense requests" ON public.expense_requests;
CREATE POLICY "Users can delete own expense requests" ON public.expense_requests 
  FOR DELETE USING (auth.uid() = requester_id);

-- Add missing RLS policies for budget_categories delete
DROP POLICY IF EXISTS "Users can delete own budgets" ON public.budget_categories;
CREATE POLICY "Users can delete own budgets" ON public.budget_categories 
  FOR DELETE USING (auth.uid() = user_id);

-- Add missing RLS policies for calendar_events delete
DROP POLICY IF EXISTS "Users can delete own events" ON public.calendar_events;
CREATE POLICY "Users can delete own events" ON public.calendar_events 
  FOR DELETE USING (auth.uid() = user_id);

-- Add missing RLS policies for emergency_contacts delete
DROP POLICY IF EXISTS "Users can delete own contacts" ON public.emergency_contacts;
CREATE POLICY "Users can delete own contacts" ON public.emergency_contacts 
  FOR DELETE USING (auth.uid() = user_id);

-- Add missing RLS policies for payment_methods delete
DROP POLICY IF EXISTS "Users can delete own payment methods" ON public.payment_methods;
CREATE POLICY "Users can delete own payment methods" ON public.payment_methods 
  FOR DELETE USING (auth.uid() = user_id);

-- Add missing RLS policies for calendar_events insert
DROP POLICY IF EXISTS "Users can insert own events" ON public.calendar_events;
CREATE POLICY "Users can insert own events" ON public.calendar_events 
  FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Add missing RLS policies for calendar_events update
DROP POLICY IF EXISTS "Users can update own events" ON public.calendar_events;
CREATE POLICY "Users can update own events" ON public.calendar_events 
  FOR UPDATE USING (auth.uid() = user_id);

-- Add missing RLS policies for budget_categories insert (if missing)
DROP POLICY IF EXISTS "Users can insert own budgets" ON public.budget_categories;
CREATE POLICY "Users can insert own budgets" ON public.budget_categories 
  FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Add missing RLS policies for budget_categories update (if missing)
DROP POLICY IF EXISTS "Users can update own budgets" ON public.budget_categories;
CREATE POLICY "Users can update own budgets" ON public.budget_categories 
  FOR UPDATE USING (auth.uid() = user_id);

-- Add missing RLS policies for virtual_cards (if missing)
DROP POLICY IF EXISTS "Users can insert own cards" ON public.virtual_cards;
CREATE POLICY "Users can insert own cards" ON public.virtual_cards 
  FOR INSERT WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update own cards" ON public.virtual_cards;
CREATE POLICY "Users can update own cards" ON public.virtual_cards 
  FOR UPDATE USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can delete own cards" ON public.virtual_cards;
CREATE POLICY "Users can delete own cards" ON public.virtual_cards 
  FOR DELETE USING (auth.uid() = user_id);

-- Add missing RLS policies for expense_requests update
DROP POLICY IF EXISTS "Users can update own expense requests" ON public.expense_requests;
CREATE POLICY "Users can update own expense requests" ON public.expense_requests 
  FOR UPDATE USING (auth.uid() = requester_id);

-- Add missing RLS policies for emergency_contacts insert
DROP POLICY IF EXISTS "Users can insert own contacts" ON public.emergency_contacts;
CREATE POLICY "Users can insert own contacts" ON public.emergency_contacts 
  FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Add missing RLS policies for emergency_contacts update
DROP POLICY IF EXISTS "Users can update own contacts" ON public.emergency_contacts;
CREATE POLICY "Users can update own contacts" ON public.emergency_contacts 
  FOR UPDATE USING (auth.uid() = user_id);

-- Add missing RLS policies for payment_methods insert
DROP POLICY IF EXISTS "Users can insert own payment methods" ON public.payment_methods;
CREATE POLICY "Users can insert own payment methods" ON public.payment_methods 
  FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Add missing RLS policies for payment_methods update
DROP POLICY IF EXISTS "Users can update own payment methods" ON public.payment_methods;
CREATE POLICY "Users can update own payment methods" ON public.payment_methods 
  FOR UPDATE USING (auth.uid() = user_id);

-- Ensure all tables have RLS enabled
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

-- For any new tables, add:
ALTER TABLE public.parent_invites ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.permissions ENABLE ROW LEVEL SECURITY;



