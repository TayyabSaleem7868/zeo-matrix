-- Admin: toggle ban status for a user
-- Uses SECURITY DEFINER to bypass RLS and update profiles.

CREATE OR REPLACE FUNCTION public.admin_toggle_ban(
  p_user_id uuid,
  p_is_banned boolean,
  p_admin_secret text
)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_ok boolean;
BEGIN
  -- Verify admin secret
  SELECT EXISTS(
    SELECT 1
    FROM public.admin_secrets s
    WHERE s.secret = p_admin_secret
  )
  INTO v_ok;

  IF NOT COALESCE(v_ok, false) THEN
    RAISE EXCEPTION 'Not authorized';
  END IF;

  UPDATE public.profiles
  SET is_banned = p_is_banned,
      updated_at = now()
  WHERE user_id = p_user_id;

  RETURN 'ok';
END;
$$;

-- Grant permissions
REVOKE ALL ON FUNCTION public.admin_toggle_ban(uuid, boolean, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.admin_toggle_ban(uuid, boolean, text) TO authenticated;

-- Enable Realtime for profiles if not already enabled
-- Note: Check if the table is already in the publication to avoid errors if run multiple times
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables 
    WHERE pubname = 'supabase_realtime' 
    AND schemaname = 'public' 
    AND tablename = 'profiles'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.profiles;
  END IF;
END $$;
