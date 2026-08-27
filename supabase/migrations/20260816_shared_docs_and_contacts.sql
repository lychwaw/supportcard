-- ============================================================
-- Shared Documents + Contacts — 2026-08-16
--
--   1. legal_documents — fix document_type constraint (app sends
--      'Legal'/'Medical'/'School'/'Financial'/'Other' but table
--      only allowed 'court_order'/'medical_card'/'agreement'/'other').
--      Also update the SELECT policy to share docs with co-parents
--      even when child_id is NULL (older/current uploads don't set it).
--
--   2. emergency_contacts — add co-parent SELECT policy so both
--      parents see the family's emergency contacts list.
-- ============================================================


-- ── FIX 1: legal_documents document_type values ───────────────────────────────
-- Normalize any existing rows to the five values the app actually uses,
-- then replace the old constraint.
UPDATE public.legal_documents
SET document_type = CASE
  WHEN lower(document_type) LIKE '%court%' OR lower(document_type) = 'legal'      THEN 'Legal'
  WHEN lower(document_type) LIKE '%medical%'                                       THEN 'Medical'
  WHEN lower(document_type) LIKE '%school%'                                        THEN 'School'
  WHEN lower(document_type) LIKE '%financial%' OR lower(document_type) = 'agreement' THEN 'Financial'
  WHEN document_type IN ('Legal','Medical','School','Financial','Other')            THEN document_type
  ELSE 'Other'
END
WHERE document_type NOT IN ('Legal','Medical','School','Financial','Other');

ALTER TABLE public.legal_documents
  DROP CONSTRAINT IF EXISTS legal_documents_document_type_check;

ALTER TABLE public.legal_documents
  ADD CONSTRAINT legal_documents_document_type_check
  CHECK (document_type IN ('Legal','Medical','School','Financial','Other'));


-- ── FIX 2: legal_documents co-parent SELECT ───────────────────────────────────
-- The original policy required child_id to be set for co-parent access.
-- Since the upload form doesn't ask for child_id, all docs have child_id = NULL
-- and the co-parent could never see them. Updated to fall back to the uploader's
-- family membership check when child_id is absent.

DROP POLICY IF EXISTS "Users can view relevant legal documents" ON public.legal_documents;
CREATE POLICY "Users can view relevant legal documents" ON public.legal_documents
  FOR SELECT USING (
    -- Owner always sees their own docs
    auth.uid() = user_id
    -- Co-parent via specific child (when child_id is set)
    OR (is_shared = TRUE AND child_id IS NOT NULL AND EXISTS (
      SELECT 1 FROM public.children c
      WHERE c.id = child_id
        AND (c.parent_id = auth.uid() OR c.co_parent_id = auth.uid())
    ))
    -- Co-parent via family membership (when child_id is NULL)
    OR (is_shared = TRUE AND child_id IS NULL AND EXISTS (
      SELECT 1 FROM public.children c
      WHERE (c.parent_id = auth.uid() OR c.co_parent_id = auth.uid())
        AND (c.parent_id = legal_documents.user_id OR c.co_parent_id = legal_documents.user_id)
    ))
  );


-- ── FIX 3: emergency_contacts co-parent SELECT ────────────────────────────────
-- The original "Users can view own contacts" policy only returns user's own rows.
-- Add a permissive co-parent policy (OR'd with the existing one) so the contacts
-- list is shared across the family.

DROP POLICY IF EXISTS "Co-parents can view family contacts" ON public.emergency_contacts;
CREATE POLICY "Co-parents can view family contacts" ON public.emergency_contacts
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.children c
      WHERE (c.parent_id = auth.uid() OR c.co_parent_id = auth.uid())
        AND (c.parent_id = emergency_contacts.user_id OR c.co_parent_id = emergency_contacts.user_id)
    )
  );
