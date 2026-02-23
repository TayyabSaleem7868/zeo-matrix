

CREATE OR REPLACE FUNCTION public.set_user_verified(target_user_id uuid, verified boolean)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE public.profiles
  SET is_verified = COALESCE(verified, false)
  WHERE user_id = target_user_id;
END;
$$;

REVOKE ALL ON FUNCTION public.set_user_verified(uuid, boolean) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.set_user_verified(uuid, boolean) TO authenticated;
