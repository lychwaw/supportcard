-- ============================================
-- ENHANCE TRANSACTIONS FOR LOGGING
-- ============================================
-- Add fields to support transaction logging by children and parents
-- For legal documentation and communication

-- Add new columns to transactions table
ALTER TABLE public.transactions
  ADD COLUMN IF NOT EXISTS logged_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS transaction_type TEXT DEFAULT 'past' CHECK (transaction_type IN ('past', 'future', 'planned')),
  ADD COLUMN IF NOT EXISTS notes TEXT,
  ADD COLUMN IF NOT EXISTS is_parent_logged BOOLEAN DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS child_id UUID REFERENCES public.children(id) ON DELETE SET NULL;

-- Update existing transactions to set logged_by = user_id
UPDATE public.transactions
SET logged_by = user_id,
    is_parent_logged = TRUE
WHERE logged_by IS NULL;

-- Create index for better query performance
CREATE INDEX IF NOT EXISTS idx_transactions_logged_by ON public.transactions(logged_by);
CREATE INDEX IF NOT EXISTS idx_transactions_child_id ON public.transactions(child_id);
CREATE INDEX IF NOT EXISTS idx_transactions_type ON public.transactions(transaction_type);
CREATE INDEX IF NOT EXISTS idx_transactions_is_parent_logged ON public.transactions(is_parent_logged);

-- Update RLS policies to allow children to create transactions
DROP POLICY IF EXISTS "Parents can create transactions" ON public.transactions;

-- Allow both parents and children to create transactions
CREATE POLICY "Users can create transactions" ON public.transactions 
  FOR INSERT WITH CHECK (
    auth.uid() = user_id AND
    auth.uid() = logged_by
  );

-- Allow users to update their own logged transactions
CREATE POLICY "Users can update own logged transactions" ON public.transactions 
  FOR UPDATE USING (
    auth.uid() = logged_by
  );

-- Allow users to delete their own logged transactions
CREATE POLICY "Users can delete own logged transactions" ON public.transactions 
  FOR DELETE USING (
    auth.uid() = logged_by
  );

COMMENT ON COLUMN public.transactions.logged_by IS 'User who logged this transaction (for legal documentation)';
COMMENT ON COLUMN public.transactions.transaction_type IS 'Type: past (completed), future (scheduled), planned (proposed)';
COMMENT ON COLUMN public.transactions.notes IS 'Additional notes for legal documentation';
COMMENT ON COLUMN public.transactions.is_parent_logged IS 'True if logged by parent, false if logged by child';
COMMENT ON COLUMN public.transactions.child_id IS 'Child associated with this transaction';





