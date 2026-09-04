-- Professional notes must be private to the professional who wrote them.
--
-- They were originally a `notes` column on professional_links, but that table
-- carries "professional_links_parent_manage" FOR ALL USING (auth.uid() =
-- parent_id). Postgres RLS is row-level, not column-level, so the parent could
-- both read and overwrite the column directly through the Supabase client.
--
-- Moving them to their own table with a professional-only policy is the only
-- way to actually scope them.

CREATE TABLE IF NOT EXISTS public.professional_notes (
  id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  link_id         UUID        NOT NULL UNIQUE
                              REFERENCES public.professional_links(id) ON DELETE CASCADE,
  professional_id UUID        NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  body            TEXT,
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_professional_notes_professional
  ON public.professional_notes(professional_id);

ALTER TABLE public.professional_notes ENABLE ROW LEVEL SECURITY;

-- Only the professional who owns the note may see or change it.
-- Parents get no policy at all, so RLS denies them by default.
DROP POLICY IF EXISTS "professional_notes_owner" ON public.professional_notes;
CREATE POLICY "professional_notes_owner"
  ON public.professional_notes
  FOR ALL USING (auth.uid() = professional_id)
  WITH CHECK (auth.uid() = professional_id);

-- Carry across anything already written, then remove the exposed column.
INSERT INTO public.professional_notes (link_id, professional_id, body)
SELECT id, professional_id, notes
FROM public.professional_links
WHERE notes IS NOT NULL
  AND btrim(notes) <> ''
  AND professional_id IS NOT NULL
ON CONFLICT (link_id) DO NOTHING;

ALTER TABLE public.professional_links DROP COLUMN IF EXISTS notes;
