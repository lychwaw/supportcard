-- Fix child_goals: drop NOT NULL on name column (app uses title column instead)
ALTER TABLE public.child_goals ALTER COLUMN name DROP NOT NULL;

-- Fix emergency_contacts: add contact_type column if missing
ALTER TABLE public.emergency_contacts
  ADD COLUMN IF NOT EXISTS contact_type TEXT NOT NULL DEFAULT 'Other';
