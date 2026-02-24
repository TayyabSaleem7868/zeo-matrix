
CREATE TABLE IF NOT EXISTS public.admin_secrets (
  id int primary key generated always as identity,
  secret text not null,
  created_at timestamptz not null default now()
);

ALTER TABLE public.admin_secrets ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admin secrets are not readable" ON public.admin_secrets;
CREATE POLICY "Admin secrets are not readable" ON public.admin_secrets
FOR SELECT USING (false);

DROP POLICY IF EXISTS "Admin secrets are not writable" ON public.admin_secrets;
CREATE POLICY "Admin secrets are not writable" ON public.admin_secrets
FOR ALL USING (false) WITH CHECK (false);

CREATE OR REPLACE FUNCTION public.admin_delete_user(p_user_id uuid, p_admin_secret text, p_reason text DEFAULT NULL)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_me uuid;
BEGIN
  v_me := auth.uid();
  IF v_me IS NULL THEN
    RAISE EXCEPTION 'not_authenticated';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM public.admin_secrets s
    WHERE s.secret = p_admin_secret
  ) THEN
    RAISE EXCEPTION 'not_authorized';
  END IF;

  UPDATE public.profiles
  SET is_banned = true,
      updated_at = now()
  WHERE user_id = p_user_id;

  DELETE FROM public.likes WHERE user_id = p_user_id;
  DELETE FROM public.follows WHERE follower_id = p_user_id OR following_id = p_user_id;
  DELETE FROM public.posts WHERE user_id = p_user_id;

  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema='public' AND table_name='comments'
  ) THEN
    EXECUTE 'DELETE FROM public.comments WHERE user_id = $1' USING p_user_id;
  END IF;

  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema='public' AND table_name='notifications'
  ) THEN
    EXECUTE 'DELETE FROM public.notifications WHERE user_id = $1 OR actor_id = $1' USING p_user_id;
  END IF;

  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema='public' AND table_name='follow_requests'
  ) THEN
    EXECUTE 'DELETE FROM public.follow_requests WHERE requester_id = $1 OR target_id = $1' USING p_user_id;
  END IF;

  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema='public' AND table_name='dm_conversations'
  ) THEN
    EXECUTE 'DELETE FROM public.dm_conversations WHERE user1_id = $1 OR user2_id = $1' USING p_user_id;
  END IF;

  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema='public' AND table_name='dm_messages'
  ) THEN
    EXECUTE 'DELETE FROM public.dm_messages WHERE user_id = $1 OR sender_id = $1' USING p_user_id;
  END IF;

  -- Finally remove the profile row itself so the user disappears from admin lists.
  DELETE FROM public.profiles WHERE user_id = p_user_id;

  RETURN 'ok';
END;
$$;

REVOKE ALL ON FUNCTION public.admin_delete_user(uuid, text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.admin_delete_user(uuid, text, text) TO authenticated;
