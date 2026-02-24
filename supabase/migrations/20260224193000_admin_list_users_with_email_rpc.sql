-- Admin: list users (profiles) with their auth email
-- Uses SECURITY DEFINER so we can read from auth.users without granting that to clients.

CREATE OR REPLACE FUNCTION public.admin_list_users_with_email(
  p_admin_secret text
)
RETURNS TABLE (
  user_id uuid,
  email text,
  username text,
  display_name text,
  avatar_url text,
  bio text,
  created_at timestamptz,
  is_banned boolean,
  is_verified boolean
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_me uuid;
  v_ok boolean;
BEGIN
  v_me := auth.uid();
  IF v_me IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  SELECT EXISTS(
    SELECT 1
    FROM public.admin_secrets s
    WHERE s.secret = p_admin_secret
  )
  INTO v_ok;

  IF NOT COALESCE(v_ok, false) THEN
    RAISE EXCEPTION 'Not authorized';
  END IF;

  RETURN QUERY
  SELECT
    p.user_id,
    u.email::text,
    p.username,
    p.display_name,
    p.avatar_url,
    p.bio,
    p.created_at,
    COALESCE(p.is_banned, false) AS is_banned,
    COALESCE(p.is_verified, false) AS is_verified
  FROM public.profiles p
  JOIN auth.users u ON u.id = p.user_id
  ORDER BY p.created_at DESC;
END;
$$;

REVOKE ALL ON FUNCTION public.admin_list_users_with_email(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.admin_list_users_with_email(text) TO authenticated;
