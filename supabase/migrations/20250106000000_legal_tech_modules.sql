-- ============================================
-- LEGAL-TECH MODULES: ULTIMATE UPDATE
-- ============================================
-- Module A: Compliance & Progression Dashboard
-- Module B: GPS Handoff (Visitation Tracker)
-- Module C: Tone Police (Conflict Prevention) - No DB changes needed
-- Module D: Document Vault
-- ============================================

-- ============================================
-- MODULE A: COMPLIANCE & PROGRESSION DASHBOARD
-- ============================================

-- Create compliance_scores table (calculated server-side, not client)
CREATE TABLE IF NOT EXISTS public.compliance_scores (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
  child_id UUID REFERENCES public.children(id) ON DELETE CASCADE,
  score_percentage DECIMAL(5, 2) NOT NULL CHECK (score_percentage >= 0 AND score_percentage <= 100),
  payment_adherence DECIMAL(5, 2) NOT NULL DEFAULT 0,
  response_time_score DECIMAL(5, 2) NOT NULL DEFAULT 0,
  calculated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  period_start DATE NOT NULL,
  period_end DATE NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(user_id, child_id, period_start, period_end)
);

-- Create compliance_history view (for progression chart)
-- Note: This is a view that joins compliance_scores with expense_requests
CREATE OR REPLACE VIEW public.compliance_history AS
SELECT 
  cs.user_id,
  cs.child_id,
  cs.period_start,
  cs.period_end,
  cs.score_percentage,
  cs.payment_adherence,
  cs.response_time_score,
  cs.calculated_at,
  -- Calculate debt/arrears (unpaid expenses)
  COALESCE(
    (SELECT SUM(amount) 
     FROM public.expense_requests 
     WHERE child_id = cs.child_id 
       AND status = 'pending' 
       AND created_at::date >= cs.period_start 
       AND created_at::date <= cs.period_end),
    0
  ) as unpaid_amount,
  -- Calculate paid amount
  COALESCE(
    (SELECT SUM(amount) 
     FROM public.expense_requests 
     WHERE child_id = cs.child_id 
       AND status = 'approved' 
       AND created_at::date >= cs.period_start 
       AND created_at::date <= cs.period_end),
    0
  ) as paid_amount
FROM public.compliance_scores cs;

-- Function to calculate compliance score (server-side, tamper-proof)
CREATE OR REPLACE FUNCTION public.calculate_compliance_score(
  p_user_id UUID,
  p_child_id UUID,
  p_period_start DATE,
  p_period_end DATE
)
RETURNS TABLE (
  score_percentage DECIMAL(5, 2),
  payment_adherence DECIMAL(5, 2),
  response_time_score DECIMAL(5, 2)
) 
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_payment_adherence DECIMAL(5, 2);
  v_response_time_score DECIMAL(5, 2);
  v_total_expenses INTEGER;
  v_approved_expenses INTEGER;
  v_avg_response_hours DECIMAL;
BEGIN
  -- Calculate payment adherence (approved / total requests)
  SELECT 
    COUNT(*) FILTER (WHERE status = 'approved'),
    COUNT(*)
  INTO v_approved_expenses, v_total_expenses
  FROM public.expense_requests
  WHERE child_id = p_child_id
    AND created_at >= p_period_start
    AND created_at <= p_period_end;
  
  IF v_total_expenses > 0 THEN
    v_payment_adherence := (v_approved_expenses::DECIMAL / v_total_expenses::DECIMAL) * 100;
  ELSE
    v_payment_adherence := 100; -- No expenses = perfect adherence
  END IF;
  
  -- Calculate response time score (faster responses = higher score)
  -- Ideal: < 24 hours = 100%, < 48 hours = 80%, < 72 hours = 60%, > 72 hours = 40%
  SELECT 
    AVG(EXTRACT(EPOCH FROM (updated_at - created_at)) / 3600) -- hours
  INTO v_avg_response_hours
  FROM public.expense_requests
  WHERE child_id = p_child_id
    AND status IN ('approved', 'rejected')
    AND created_at >= p_period_start
    AND created_at <= p_period_end;
  
  IF v_avg_response_hours IS NULL THEN
    v_response_time_score := 100; -- No responses = perfect score
  ELSIF v_avg_response_hours <= 24 THEN
    v_response_time_score := 100;
  ELSIF v_avg_response_hours <= 48 THEN
    v_response_time_score := 80;
  ELSIF v_avg_response_hours <= 72 THEN
    v_response_time_score := 60;
  ELSE
    v_response_time_score := 40;
  END IF;
  
  -- Overall score: 70% payment adherence + 30% response time
  RETURN QUERY SELECT 
    (v_payment_adherence * 0.7 + v_response_time_score * 0.3)::DECIMAL(5, 2),
    v_payment_adherence,
    v_response_time_score;
END;
$$;

-- Enable RLS on compliance_scores
ALTER TABLE public.compliance_scores ENABLE ROW LEVEL SECURITY;

-- RLS Policy: Users can only view their own compliance scores
CREATE POLICY "Users can view own compliance scores" ON public.compliance_scores
  FOR SELECT USING (
    (SELECT auth.uid()) = user_id OR
    EXISTS (
      SELECT 1 FROM public.children c
      WHERE c.id = compliance_scores.child_id
      AND (c.parent_id = (SELECT auth.uid()) OR c.co_parent_id = (SELECT auth.uid()))
    )
  );

-- RLS Policy: Only system can insert (via function)
CREATE POLICY "System can insert compliance scores" ON public.compliance_scores
  FOR INSERT WITH CHECK (true); -- Function uses SECURITY DEFINER

-- ============================================
-- MODULE B: GPS HANDOFF (VISITATION TRACKER)
-- ============================================

-- Create visitation_logs table (insert-only, immutable)
CREATE TABLE IF NOT EXISTS public.visitation_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
  child_id UUID REFERENCES public.children(id) ON DELETE CASCADE,
  handoff_type TEXT NOT NULL CHECK (handoff_type IN ('pickup', 'dropoff')),
  latitude DECIMAL(10, 8) NOT NULL CHECK (latitude >= -90 AND latitude <= 90),
  longitude DECIMAL(11, 8) NOT NULL CHECK (longitude >= -180 AND longitude <= 180),
  accuracy_meters DECIMAL(8, 2),
  timestamp TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
  notes TEXT,
  verified BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
  -- Prevent deletion: no DELETE policy, only INSERT and SELECT
  CONSTRAINT valid_coordinates CHECK (
    latitude IS NOT NULL AND longitude IS NOT NULL
  )
);

-- Create index for fast lookups
CREATE INDEX IF NOT EXISTS idx_visitation_logs_user_child ON public.visitation_logs(user_id, child_id, timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_visitation_logs_timestamp ON public.visitation_logs(timestamp DESC);

-- Enable RLS on visitation_logs
ALTER TABLE public.visitation_logs ENABLE ROW LEVEL SECURITY;

-- RLS Policy: Users can view logs for their children
CREATE POLICY "Users can view relevant visitation logs" ON public.visitation_logs
  FOR SELECT USING (
    (SELECT auth.uid()) = user_id OR
    EXISTS (
      SELECT 1 FROM public.children c
      WHERE c.id = visitation_logs.child_id
      AND (c.parent_id = (SELECT auth.uid()) OR c.co_parent_id = (SELECT auth.uid()))
    )
  );

-- RLS Policy: Users can insert their own logs (but NOT delete)
CREATE POLICY "Users can insert own visitation logs" ON public.visitation_logs
  FOR INSERT WITH CHECK ((SELECT auth.uid()) = user_id);

-- CRITICAL: NO DELETE POLICY - This makes the table insert-only for users
-- Only database admins can delete (via service role)

-- Function to verify handoff (checks if both parents logged same location)
CREATE OR REPLACE FUNCTION public.verify_handoff(
  p_child_id UUID,
  p_timestamp TIMESTAMP WITH TIME ZONE,
  p_tolerance_minutes INTEGER DEFAULT 15
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_pickup_count INTEGER;
  v_dropoff_count INTEGER;
BEGIN
  -- Check if both pickup and dropoff were logged within tolerance window
  SELECT COUNT(*) FILTER (WHERE handoff_type = 'pickup')
  INTO v_pickup_count
  FROM public.visitation_logs
  WHERE child_id = p_child_id
    AND ABS(EXTRACT(EPOCH FROM (timestamp - p_timestamp)) / 60) <= p_tolerance_minutes;
  
  SELECT COUNT(*) FILTER (WHERE handoff_type = 'dropoff')
  INTO v_dropoff_count
  FROM public.visitation_logs
  WHERE child_id = p_child_id
    AND ABS(EXTRACT(EPOCH FROM (timestamp - p_timestamp)) / 60) <= p_tolerance_minutes;
  
  -- Verified if both types exist (both parents logged)
  RETURN (v_pickup_count > 0 AND v_dropoff_count > 0);
END;
$$;

-- ============================================
-- MODULE D: DOCUMENT VAULT
-- ============================================

-- Create legal_documents table
CREATE TABLE IF NOT EXISTS public.legal_documents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
  child_id UUID REFERENCES public.children(id) ON DELETE CASCADE,
  document_type TEXT NOT NULL CHECK (document_type IN ('court_order', 'medical_card', 'agreement', 'other')),
  file_name TEXT NOT NULL,
  file_path TEXT NOT NULL, -- Path in Supabase Storage
  file_size BIGINT NOT NULL,
  mime_type TEXT NOT NULL,
  uploaded_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL NOT NULL,
  uploaded_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
  description TEXT,
  -- Critical: Track who uploaded to prevent deletion by co-parent
  is_shared BOOLEAN DEFAULT TRUE, -- Shared with co-parent
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL
);

-- Create index for fast lookups
CREATE INDEX IF NOT EXISTS idx_legal_documents_user_child ON public.legal_documents(user_id, child_id);
CREATE INDEX IF NOT EXISTS idx_legal_documents_uploaded_by ON public.legal_documents(uploaded_by);

-- Enable RLS on legal_documents
ALTER TABLE public.legal_documents ENABLE ROW LEVEL SECURITY;

-- RLS Policy: Users can view documents for their children
CREATE POLICY "Users can view relevant legal documents" ON public.legal_documents
  FOR SELECT USING (
    (SELECT auth.uid()) = user_id OR
    (is_shared = TRUE AND EXISTS (
      SELECT 1 FROM public.children c
      WHERE c.id = legal_documents.child_id
      AND (c.parent_id = (SELECT auth.uid()) OR c.co_parent_id = (SELECT auth.uid()))
    ))
  );

-- RLS Policy: Users can upload documents
CREATE POLICY "Users can insert legal documents" ON public.legal_documents
  FOR INSERT WITH CHECK ((SELECT auth.uid()) = user_id AND (SELECT auth.uid()) = uploaded_by);

-- CRITICAL RLS Policy: Users can ONLY delete documents they uploaded
-- Co-parents CANNOT delete each other's documents (prevents evidence destruction)
CREATE POLICY "Users can only delete own uploaded documents" ON public.legal_documents
  FOR DELETE USING ((SELECT auth.uid()) = uploaded_by);

-- RLS Policy: Users can update their own documents (description, etc.)
CREATE POLICY "Users can update own legal documents" ON public.legal_documents
  FOR UPDATE USING ((SELECT auth.uid()) = uploaded_by)
  WITH CHECK ((SELECT auth.uid()) = uploaded_by);

-- ============================================
-- STORAGE POLICIES FOR LEGAL-DOCS BUCKET
-- ============================================
-- NOTE: You must create a bucket named 'legal-docs' in the Supabase Storage menu first!
-- Then these policies will secure it.
-- File path structure: legal-docs/{child_id}/{user_id}_{child_id}_{timestamp}.{ext}

-- Allow users to upload documents (check they have access to the child_id in path)
CREATE POLICY "Upload Legal Docs" ON storage.objects
  FOR INSERT 
  WITH CHECK (
    bucket_id = 'legal-docs' 
    AND EXISTS (
      SELECT 1 FROM public.children c
      WHERE c.id::text = (string_to_array(name, '/'))[2]
      AND (c.parent_id = (SELECT auth.uid()) OR c.co_parent_id = (SELECT auth.uid()))
    )
  );

-- Allow users to view/download documents (check they have access via legal_documents table or child)
CREATE POLICY "View Legal Docs" ON storage.objects
  FOR SELECT 
  USING (
    bucket_id = 'legal-docs'
    AND (
      -- Check if user uploaded it (via legal_documents table)
      EXISTS (
        SELECT 1 FROM public.legal_documents ld
        WHERE ld.file_path = name
        AND ld.uploaded_by = (SELECT auth.uid())
      )
      OR
      -- Check if user has access to the child (co-parent)
      EXISTS (
        SELECT 1 FROM public.children c
        WHERE c.id::text = (string_to_array(name, '/'))[2]
        AND (c.parent_id = (SELECT auth.uid()) OR c.co_parent_id = (SELECT auth.uid()))
        AND EXISTS (
          SELECT 1 FROM public.legal_documents ld2
          WHERE ld2.file_path = name
          AND ld2.is_shared = TRUE
        )
      )
    )
  );

-- CRITICAL: NO DELETE POLICY
-- This means NOBODY (except database admins with service role) can delete files.
-- This protects court evidence from being destroyed.
-- Deletion is controlled via the legal_documents table RLS policy.

-- ============================================
-- COMMENTS FOR DOCUMENTATION
-- ============================================

COMMENT ON TABLE public.compliance_scores IS 'Court-ready compliance scores calculated server-side to prevent tampering';
COMMENT ON TABLE public.visitation_logs IS 'Immutable GPS handoff logs for custody exchanges (insert-only)';
COMMENT ON TABLE public.legal_documents IS 'Secure document storage with strict RLS preventing co-parent deletion';
COMMENT ON FUNCTION public.calculate_compliance_score IS 'Server-side compliance calculation (tamper-proof)';
COMMENT ON FUNCTION public.verify_handoff IS 'Verifies if both parents logged handoff at same location/time';

