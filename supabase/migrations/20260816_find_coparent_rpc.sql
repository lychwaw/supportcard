-- Allows the mobile app to look up a co-parent by their sign-in email
-- even when profiles.email is null or contains an Apple relay address.
-- SECURITY DEFINER runs as the function owner so it can read auth.users.
CREATE OR REPLACE FUNCTION public.find_coparent_by_email(lookup_email text)
RETURNS TABLE(user_id uuid, full_name text, display_email text)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    u.id          AS user_id,
    p.full_name   AS full_name,
    u.email       AS display_email
  FROM auth.users u
  LEFT JOIN public.profiles p ON p.id = u.id
  WHERE lower(u.email) = lower(lookup_email)
  LIMIT 1;
$$;

-- Only authenticated users can call this function
REVOKE ALL ON FUNCTION public.find_coparent_by_email(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.find_coparent_by_email(text) TO authenticated;
