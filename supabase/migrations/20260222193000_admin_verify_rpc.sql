



CREATE OR REPLACE FUNCTION public.set_user_verified(target_user_id uuid, verified boolean)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_admin uuid;
  v_target uuid;
  v_target_username text;
  v_was_verified boolean;
  v_company_user_id uuid;
  v_company_post_id uuid;
  v_content text;
BEGIN
  v_admin := auth.uid();
  IF v_admin IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  v_target := target_user_id;

  SELECT COALESCE(p.is_verified, false), p.username
  INTO v_was_verified, v_target_username
  FROM public.profiles p
  WHERE p.user_id = v_target
  LIMIT 1;

  UPDATE public.profiles
  SET is_verified = COALESCE(verified, false)
  WHERE user_id = v_target;

  IF COALESCE(verified, false) = true AND COALESCE(v_was_verified, false) = false THEN
    SELECT p.user_id
    INTO v_company_user_id
    FROM public.profiles p
    WHERE p.username = 'zeomatrixofficial'
    LIMIT 1;

    IF v_company_user_id IS NOT NULL AND v_target_username IS NOT NULL THEN
      v_content := '@' || v_target_username || E'\n\nWe\x27ve announced you our premium member lifetime.\nYour verification badge is ready and had been given by our Verification management team.';

      INSERT INTO public.posts (user_id, content, image_url)
      VALUES (v_company_user_id, v_content, '')
      RETURNING id INTO v_company_post_id;

      IF v_company_post_id IS NOT NULL THEN
        INSERT INTO public.post_mentions (post_id, mentioned_user_id, actor_id)
        VALUES (v_company_post_id, v_target, v_company_user_id)
        ON CONFLICT (post_id, mentioned_user_id)
        DO UPDATE SET actor_id = EXCLUDED.actor_id, created_at = now();
      END IF;
    END IF;
  END IF;
END;
$$;

REVOKE ALL ON FUNCTION public.set_user_verified(uuid, boolean) FROM PUBLIC;

GRANT EXECUTE ON FUNCTION public.set_user_verified(uuid, boolean) TO authenticated;
