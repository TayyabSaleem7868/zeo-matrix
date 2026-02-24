BEGIN;

CREATE TABLE IF NOT EXISTS public.post_mentions (
  post_id UUID REFERENCES public.posts(id) ON DELETE CASCADE NOT NULL,
  mentioned_user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  actor_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (post_id, mentioned_user_id)
);

ALTER TABLE public.post_mentions ENABLE ROW LEVEL SECURITY;

CREATE TABLE IF NOT EXISTS public.comment_mentions (
  comment_id UUID REFERENCES public.comments(id) ON DELETE CASCADE NOT NULL,
  mentioned_user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  actor_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (comment_id, mentioned_user_id)
);

ALTER TABLE public.comment_mentions ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.notifications
  DROP CONSTRAINT IF EXISTS notifications_type_check;

DELETE FROM public.notifications n
WHERE n.type NOT IN (
  'like',
  'comment',
  'reply',
  'follow',
  'follow_request',
  'follow_request_accepted',
  'admin_post_deleted',
  'mention_post',
  'mention_comment'
);

ALTER TABLE public.notifications
  ADD CONSTRAINT notifications_type_check
  CHECK (type IN (
    'like',
    'comment',
    'reply',
    'follow',
    'follow_request',
    'follow_request_accepted',
    'admin_post_deleted',
    'mention_post',
    'mention_comment'
  ));

CREATE OR REPLACE FUNCTION public.remove_post_mention(p_post_id uuid, p_username text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_me uuid;
  v_target uuid;
BEGIN
  v_me := auth.uid();
  IF v_me IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  SELECT user_id INTO v_target
  FROM public.profiles
  WHERE username = p_username
  LIMIT 1;

  IF v_target IS NULL THEN
    RETURN;
  END IF;

  DELETE FROM public.post_mentions
  WHERE post_id = p_post_id
    AND mentioned_user_id = v_target
    AND actor_id = v_me;
END;
$$;

REVOKE ALL ON FUNCTION public.remove_post_mention(uuid, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.remove_post_mention(uuid, text) TO authenticated;

CREATE OR REPLACE FUNCTION public.remove_comment_mention(p_comment_id uuid, p_username text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_me uuid;
  v_target uuid;
BEGIN
  v_me := auth.uid();
  IF v_me IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  SELECT user_id INTO v_target
  FROM public.profiles
  WHERE username = p_username
  LIMIT 1;

  IF v_target IS NULL THEN
    RETURN;
  END IF;

  DELETE FROM public.comment_mentions
  WHERE comment_id = p_comment_id
    AND mentioned_user_id = v_target
    AND actor_id = v_me;
END;
$$;

REVOKE ALL ON FUNCTION public.remove_comment_mention(uuid, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.remove_comment_mention(uuid, text) TO authenticated;

DROP POLICY IF EXISTS "Post mentions: users can view relevant" ON public.post_mentions;
CREATE POLICY "Post mentions: users can view relevant"
ON public.post_mentions FOR SELECT
USING (
  auth.uid() = mentioned_user_id
  OR EXISTS (
    SELECT 1
    FROM public.posts p
    WHERE p.id = post_id
      AND p.user_id = auth.uid()
  )
);

DROP POLICY IF EXISTS "Post mentions: actor can insert" ON public.post_mentions;
CREATE POLICY "Post mentions: actor can insert"
ON public.post_mentions FOR INSERT
WITH CHECK (
  auth.uid() = actor_id
  AND EXISTS (
    SELECT 1
    FROM public.posts p
    WHERE p.id = post_id
      AND p.user_id = auth.uid()
  )
);

DROP POLICY IF EXISTS "Post mentions: actor can delete" ON public.post_mentions;
CREATE POLICY "Post mentions: actor can delete"
ON public.post_mentions FOR DELETE
USING (auth.uid() = actor_id);

DROP POLICY IF EXISTS "Comment mentions: users can view relevant" ON public.comment_mentions;
CREATE POLICY "Comment mentions: users can view relevant"
ON public.comment_mentions FOR SELECT
USING (
  auth.uid() = mentioned_user_id
  OR EXISTS (
    SELECT 1
    FROM public.comments c
    WHERE c.id = comment_id
      AND c.user_id = auth.uid()
  )
);

DROP POLICY IF EXISTS "Comment mentions: actor can insert" ON public.comment_mentions;
CREATE POLICY "Comment mentions: actor can insert"
ON public.comment_mentions FOR INSERT
WITH CHECK (
  auth.uid() = actor_id
  AND EXISTS (
    SELECT 1
    FROM public.comments c
    WHERE c.id = comment_id
      AND c.user_id = auth.uid()
  )
);

DROP POLICY IF EXISTS "Comment mentions: actor can delete" ON public.comment_mentions;
CREATE POLICY "Comment mentions: actor can delete"
ON public.comment_mentions FOR DELETE
USING (auth.uid() = actor_id);

CREATE OR REPLACE FUNCTION public.resolve_usernames_to_ids(p_usernames text[])
RETURNS TABLE (username text, user_id uuid)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT p.username, p.user_id
  FROM public.profiles p
  WHERE p.username = ANY(p_usernames);
$$;

REVOKE ALL ON FUNCTION public.resolve_usernames_to_ids(text[]) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.resolve_usernames_to_ids(text[]) TO authenticated;

CREATE OR REPLACE FUNCTION public.upsert_post_mentions(p_post_id uuid, p_usernames text[])
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_me uuid;
BEGIN
  v_me := auth.uid();
  IF v_me IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  INSERT INTO public.post_mentions (post_id, mentioned_user_id, actor_id)
  SELECT p_post_id, r.user_id, v_me
  FROM public.resolve_usernames_to_ids(p_usernames) r
  WHERE r.user_id IS NOT NULL AND r.user_id <> v_me
  ON CONFLICT (post_id, mentioned_user_id)
  DO UPDATE SET actor_id = EXCLUDED.actor_id, created_at = now();
END;
$$;

REVOKE ALL ON FUNCTION public.upsert_post_mentions(uuid, text[]) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.upsert_post_mentions(uuid, text[]) TO authenticated;

CREATE OR REPLACE FUNCTION public.upsert_comment_mentions(p_comment_id uuid, p_usernames text[])
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_me uuid;
BEGIN
  v_me := auth.uid();
  IF v_me IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  INSERT INTO public.comment_mentions (comment_id, mentioned_user_id, actor_id)
  SELECT p_comment_id, r.user_id, v_me
  FROM public.resolve_usernames_to_ids(p_usernames) r
  WHERE r.user_id IS NOT NULL AND r.user_id <> v_me
  ON CONFLICT (comment_id, mentioned_user_id)
  DO UPDATE SET actor_id = EXCLUDED.actor_id, created_at = now();
END;
$$;

REVOKE ALL ON FUNCTION public.upsert_comment_mentions(uuid, text[]) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.upsert_comment_mentions(uuid, text[]) TO authenticated;

CREATE OR REPLACE FUNCTION public.notify_on_post_mention()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  PERFORM public.create_notification(NEW.mentioned_user_id, NEW.actor_id, 'mention_post', NULL, NEW.post_id, NULL, NULL, NULL);
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_notify_on_post_mention ON public.post_mentions;
CREATE TRIGGER trg_notify_on_post_mention
AFTER INSERT ON public.post_mentions
FOR EACH ROW EXECUTE FUNCTION public.notify_on_post_mention();

CREATE OR REPLACE FUNCTION public.notify_on_comment_mention()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_post_id uuid;
BEGIN
  SELECT c.post_id INTO v_post_id FROM public.comments c WHERE c.id = NEW.comment_id;
  PERFORM public.create_notification(NEW.mentioned_user_id, NEW.actor_id, 'mention_comment', NULL, v_post_id, NEW.comment_id, NULL, NULL);
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_notify_on_comment_mention ON public.comment_mentions;
CREATE TRIGGER trg_notify_on_comment_mention
AFTER INSERT ON public.comment_mentions
FOR EACH ROW EXECUTE FUNCTION public.notify_on_comment_mention();

DO $$
BEGIN
  BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.post_mentions;
  EXCEPTION WHEN duplicate_object THEN
    NULL;
  END;

  BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.comment_mentions;
  EXCEPTION WHEN duplicate_object THEN
    NULL;
  END;
END $$;

COMMIT;
