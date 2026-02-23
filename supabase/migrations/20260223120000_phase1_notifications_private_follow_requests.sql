
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS is_private BOOLEAN NOT NULL DEFAULT false;
CREATE TABLE IF NOT EXISTS public.follow_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  requester_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  target_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','accepted','declined')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (requester_id, target_id)
);

ALTER TABLE public.follow_requests ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Follow requests: requester can view own" ON public.follow_requests;
CREATE POLICY "Follow requests: requester can view own"
ON public.follow_requests FOR SELECT
USING (auth.uid() = requester_id);

DROP POLICY IF EXISTS "Follow requests: target can view incoming" ON public.follow_requests;
CREATE POLICY "Follow requests: target can view incoming"
ON public.follow_requests FOR SELECT
USING (auth.uid() = target_id);

DROP POLICY IF EXISTS "Follow requests: requester can create" ON public.follow_requests;
CREATE POLICY "Follow requests: requester can create"
ON public.follow_requests FOR INSERT
WITH CHECK (auth.uid() = requester_id);

DROP POLICY IF EXISTS "Follow requests: requester can cancel pending" ON public.follow_requests;
CREATE POLICY "Follow requests: requester can cancel pending"
ON public.follow_requests FOR DELETE
USING (auth.uid() = requester_id AND status = 'pending');

DROP POLICY IF EXISTS "Follow requests: target can update status" ON public.follow_requests;
CREATE POLICY "Follow requests: target can update status"
ON public.follow_requests FOR UPDATE
USING (auth.uid() = target_id)
WITH CHECK (auth.uid() = target_id);
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_trigger
    WHERE tgname = 'update_follow_requests_updated_at'
  ) THEN
    CREATE TRIGGER update_follow_requests_updated_at
      BEFORE UPDATE ON public.follow_requests
      FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
  END IF;
END $$;
CREATE TABLE IF NOT EXISTS public.notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  actor_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  type TEXT NOT NULL CHECK (type IN ('like','comment','reply','follow','follow_request','follow_request_accepted','admin_post_deleted')),
  message TEXT,
  post_id UUID REFERENCES public.posts(id) ON DELETE CASCADE,
  comment_id UUID,
  reply_id UUID,
  follow_request_id UUID REFERENCES public.follow_requests(id) ON DELETE CASCADE,
  is_read BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Notifications: users can view own" ON public.notifications;
CREATE POLICY "Notifications: users can view own"
ON public.notifications FOR SELECT
USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Notifications: users can update own" ON public.notifications;
CREATE POLICY "Notifications: users can update own"
ON public.notifications FOR UPDATE
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);
CREATE OR REPLACE FUNCTION public.create_notification(
  p_user_id UUID,
  p_actor_id UUID,
  p_type TEXT,
  p_message TEXT DEFAULT NULL,
  p_post_id UUID DEFAULT NULL,
  p_comment_id UUID DEFAULT NULL,
  p_reply_id UUID DEFAULT NULL,
  p_follow_request_id UUID DEFAULT NULL
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF p_user_id IS NULL THEN
    RETURN;
  END IF;
  IF p_actor_id IS NOT NULL AND p_user_id = p_actor_id THEN
    RETURN;
  END IF;

  INSERT INTO public.notifications (
    user_id,
    actor_id,
    type,
    message,
    post_id,
    comment_id,
    reply_id,
    follow_request_id
  )
  VALUES (
    p_user_id,
    p_actor_id,
    p_type,
    p_message,
    p_post_id,
    p_comment_id,
    p_reply_id,
    p_follow_request_id
  );
END;
$$;

REVOKE ALL ON FUNCTION public.create_notification(UUID, UUID, TEXT, TEXT, UUID, UUID, UUID, UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.create_notification(UUID, UUID, TEXT, TEXT, UUID, UUID, UUID, UUID) TO authenticated;
CREATE OR REPLACE FUNCTION public.notify_on_like()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_post_owner UUID;
BEGIN
  SELECT user_id INTO v_post_owner FROM public.posts WHERE id = NEW.post_id;
  PERFORM public.create_notification(v_post_owner, NEW.user_id, 'like', NULL, NEW.post_id, NULL, NULL, NULL);
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_notify_on_like ON public.likes;
CREATE TRIGGER trg_notify_on_like
AFTER INSERT ON public.likes
FOR EACH ROW EXECUTE FUNCTION public.notify_on_like();
CREATE OR REPLACE FUNCTION public.notify_on_follow()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  PERFORM public.create_notification(NEW.following_id, NEW.follower_id, 'follow', NULL, NULL, NULL, NULL, NULL);
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_notify_on_follow ON public.follows;
CREATE TRIGGER trg_notify_on_follow
AFTER INSERT ON public.follows
FOR EACH ROW EXECUTE FUNCTION public.notify_on_follow();
CREATE OR REPLACE FUNCTION public.notify_on_follow_request()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.status = 'pending' THEN
    PERFORM public.create_notification(NEW.target_id, NEW.requester_id, 'follow_request', NULL, NULL, NULL, NULL, NEW.id);
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_notify_on_follow_request ON public.follow_requests;
CREATE TRIGGER trg_notify_on_follow_request
AFTER INSERT ON public.follow_requests
FOR EACH ROW EXECUTE FUNCTION public.notify_on_follow_request();
CREATE OR REPLACE FUNCTION public.notify_on_follow_request_update()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF OLD.status = 'pending' AND NEW.status = 'accepted' THEN
    PERFORM public.create_notification(NEW.requester_id, NEW.target_id, 'follow_request_accepted', NULL, NULL, NULL, NULL, NEW.id);
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_notify_on_follow_request_update ON public.follow_requests;
CREATE TRIGGER trg_notify_on_follow_request_update
AFTER UPDATE ON public.follow_requests
FOR EACH ROW EXECUTE FUNCTION public.notify_on_follow_request_update();
CREATE OR REPLACE FUNCTION public.request_follow(target_user_id UUID)
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_target_private BOOLEAN;
  v_current UUID;
BEGIN
  v_current := auth.uid();
  IF v_current IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;
  IF target_user_id = v_current THEN
    RAISE EXCEPTION 'Cannot follow yourself';
  END IF;

  SELECT is_private INTO v_target_private
  FROM public.profiles
  WHERE user_id = target_user_id;

  IF v_target_private IS NULL THEN
    RAISE EXCEPTION 'Target profile not found';
  END IF;

  IF v_target_private = false THEN
    INSERT INTO public.follows (follower_id, following_id)
    VALUES (v_current, target_user_id)
    ON CONFLICT (follower_id, following_id) DO NOTHING;
    RETURN 'followed';
  END IF;
  INSERT INTO public.follow_requests (requester_id, target_id, status)
  VALUES (v_current, target_user_id, 'pending')
  ON CONFLICT (requester_id, target_id) DO UPDATE
    SET status = CASE
      WHEN public.follow_requests.status = 'declined' THEN 'pending'
      ELSE public.follow_requests.status
    END,
    updated_at = now();

  RETURN 'requested';
END;
$$;

REVOKE ALL ON FUNCTION public.request_follow(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.request_follow(UUID) TO authenticated;

CREATE OR REPLACE FUNCTION public.respond_follow_request(request_id UUID, action TEXT)
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_row public.follow_requests%ROWTYPE;
  v_current UUID;
BEGIN
  v_current := auth.uid();
  IF v_current IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  SELECT * INTO v_row
  FROM public.follow_requests
  WHERE id = request_id;

  IF v_row.id IS NULL THEN
    RAISE EXCEPTION 'Request not found';
  END IF;

  IF v_row.target_id <> v_current THEN
    RAISE EXCEPTION 'Not allowed';
  END IF;

  IF v_row.status <> 'pending' THEN
    RETURN v_row.status;
  END IF;

  IF action = 'accept' THEN
    UPDATE public.follow_requests
    SET status = 'accepted', updated_at = now()
    WHERE id = request_id;

    INSERT INTO public.follows (follower_id, following_id)
    VALUES (v_row.requester_id, v_row.target_id)
    ON CONFLICT (follower_id, following_id) DO NOTHING;

    RETURN 'accepted';
  ELSIF action = 'decline' THEN
    UPDATE public.follow_requests
    SET status = 'declined', updated_at = now()
    WHERE id = request_id;
    RETURN 'declined';
  ELSE
    RAISE EXCEPTION 'Invalid action';
  END IF;
END;
$$;

REVOKE ALL ON FUNCTION public.respond_follow_request(UUID, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.respond_follow_request(UUID, TEXT) TO authenticated;
