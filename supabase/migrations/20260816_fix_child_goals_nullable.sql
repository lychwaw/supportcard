-- Ensure child_id is nullable so goals can be created without assigning to a specific child.
-- The column may have been created with NOT NULL before this migration was written.
ALTER TABLE public.child_goals ALTER COLUMN child_id DROP NOT NULL;

-- Also ensure created_by is nullable for the same reason.
ALTER TABLE public.child_goals ALTER COLUMN created_by DROP NOT NULL;
