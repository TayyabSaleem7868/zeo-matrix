
CREATE INDEX IF NOT EXISTS idx_profiles_created_at ON public.profiles (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_posts_created_at ON public.posts (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_likes_created_at ON public.likes (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_follows_created_at ON public.follows (created_at DESC);
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema='public' AND table_name='comments'
  ) THEN
    EXECUTE 'CREATE INDEX IF NOT EXISTS idx_comments_created_at ON public.comments (created_at DESC)';
  END IF;
END $$;
CREATE OR REPLACE FUNCTION public.admin_analytics_overview()
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_users_total BIGINT;
  v_posts_total BIGINT;
  v_likes_total BIGINT;
  v_follows_total BIGINT;
  v_comments_total BIGINT;
  v_users_24h BIGINT;
  v_posts_24h BIGINT;
  v_users_7d BIGINT;
  v_posts_7d BIGINT;
BEGIN
  SELECT COUNT(*) INTO v_users_total FROM public.profiles;
  SELECT COUNT(*) INTO v_posts_total FROM public.posts;
  SELECT COUNT(*) INTO v_likes_total FROM public.likes;
  SELECT COUNT(*) INTO v_follows_total FROM public.follows;

  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema='public' AND table_name='comments'
  ) THEN
    EXECUTE 'SELECT COUNT(*) FROM public.comments' INTO v_comments_total;
  ELSE
    v_comments_total := 0;
  END IF;

  SELECT COUNT(*) INTO v_users_24h FROM public.profiles WHERE created_at >= now() - interval '24 hours';
  SELECT COUNT(*) INTO v_posts_24h FROM public.posts WHERE created_at >= now() - interval '24 hours';

  SELECT COUNT(*) INTO v_users_7d FROM public.profiles WHERE created_at >= now() - interval '7 days';
  SELECT COUNT(*) INTO v_posts_7d FROM public.posts WHERE created_at >= now() - interval '7 days';

  RETURN jsonb_build_object(
    'users_total', v_users_total,
    'posts_total', v_posts_total,
    'comments_total', v_comments_total,
    'likes_total', v_likes_total,
    'follows_total', v_follows_total,
    'users_24h', v_users_24h,
    'posts_24h', v_posts_24h,
    'users_7d', v_users_7d,
    'posts_7d', v_posts_7d
  );
END;
$$;

REVOKE ALL ON FUNCTION public.admin_analytics_overview() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.admin_analytics_overview() TO authenticated;
CREATE OR REPLACE FUNCTION public.admin_top_users_by_posts(p_limit INT DEFAULT 10)
RETURNS TABLE (
  user_id UUID,
  username TEXT,
  display_name TEXT,
  avatar_url TEXT,
  posts_count BIGINT
)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    p.user_id,
    p.username,
    p.display_name,
    p.avatar_url,
    COUNT(po.*) AS posts_count
  FROM public.profiles p
  LEFT JOIN public.posts po ON po.user_id = p.user_id
  GROUP BY p.user_id, p.username, p.display_name, p.avatar_url
  ORDER BY posts_count DESC
  LIMIT p_limit;
$$;

REVOKE ALL ON FUNCTION public.admin_top_users_by_posts(INT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.admin_top_users_by_posts(INT) TO authenticated;
CREATE OR REPLACE FUNCTION public.admin_top_posts_by_likes(p_limit INT DEFAULT 10)
RETURNS TABLE (
  post_id UUID,
  user_id UUID,
  content TEXT,
  created_at TIMESTAMPTZ,
  likes_count BIGINT
)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    po.id AS post_id,
    po.user_id,
    po.content,
    po.created_at,
    COUNT(l.*) AS likes_count
  FROM public.posts po
  LEFT JOIN public.likes l ON l.post_id = po.id
  GROUP BY po.id
  ORDER BY likes_count DESC, po.created_at DESC
  LIMIT p_limit;
$$;

REVOKE ALL ON FUNCTION public.admin_top_posts_by_likes(INT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.admin_top_posts_by_likes(INT) TO authenticated;
CREATE OR REPLACE FUNCTION public.admin_delete_post(p_post_id UUID, p_reason TEXT DEFAULT 'Violation of our community guidelines.')
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_owner UUID;
BEGIN
  SELECT user_id INTO v_owner FROM public.posts WHERE id = p_post_id;

  IF v_owner IS NULL THEN
    RETURN 'not_found';
  END IF;
  PERFORM public.create_notification(
    v_owner,
    auth.uid(),
    'admin_post_deleted',
    COALESCE(p_reason, 'Violation of our community guidelines.'),
    p_post_id,
    NULL,
    NULL,
    NULL
  );

  DELETE FROM public.posts WHERE id = p_post_id;
  IF NOT FOUND THEN
    RETURN 'not_found';
  END IF;
  RETURN 'ok';
END;
$$;

REVOKE ALL ON FUNCTION public.admin_delete_post(UUID, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.admin_delete_post(UUID, TEXT) TO authenticated;
