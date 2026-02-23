
ALTER TABLE public.posts
  ADD COLUMN IF NOT EXISTS media JSONB DEFAULT '[]'::jsonb;
CREATE INDEX IF NOT EXISTS idx_posts_created_at_id
  ON public.posts (created_at DESC, id DESC);

CREATE INDEX IF NOT EXISTS idx_posts_user_id_created_at
  ON public.posts (user_id, created_at DESC, id DESC);

CREATE INDEX IF NOT EXISTS idx_follows_follower_following
  ON public.follows (follower_id, following_id);

CREATE INDEX IF NOT EXISTS idx_follows_following_follower
  ON public.follows (following_id, follower_id);
CREATE OR REPLACE FUNCTION public.get_feed_page(
  p_limit INT DEFAULT 20,
  p_cursor_created_at TIMESTAMPTZ DEFAULT NULL,
  p_cursor_id UUID DEFAULT NULL
)
RETURNS TABLE (
  id UUID,
  user_id UUID,
  content TEXT,
  image_url TEXT,
  media JSONB,
  created_at TIMESTAMPTZ,
  username TEXT,
  display_name TEXT,
  avatar_url TEXT,
  is_verified BOOLEAN
)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  WITH me AS (SELECT auth.uid() AS uid),
  follow_count AS (
    SELECT COUNT(*)::int AS cnt
    FROM public.follows f
    JOIN me ON me.uid = f.follower_id
  ),
  visible_posts AS (
    SELECT p.*
    FROM public.posts p
    JOIN public.profiles pr ON pr.user_id = p.user_id
    JOIN me ON true
    JOIN follow_count fc ON true
    WHERE
      (
        (fc.cnt > 0 AND (p.user_id = me.uid OR EXISTS (
          SELECT 1 FROM public.follows f
          WHERE f.follower_id = me.uid
            AND f.following_id = p.user_id
        )))
        OR (fc.cnt = 0)
      )
      AND (
        COALESCE(pr.is_private, false) = false
        OR pr.user_id = me.uid
        OR EXISTS (
          SELECT 1
          FROM public.follows f2
          WHERE f2.follower_id = me.uid
            AND f2.following_id = pr.user_id
        )
      )
      AND (
        p_cursor_created_at IS NULL
        OR (p.created_at, p.id) < (p_cursor_created_at, p_cursor_id)
      )
  )
  SELECT
    vp.id,
    vp.user_id,
    vp.content,
    vp.image_url,
    COALESCE(vp.media, '[]'::jsonb) AS media,
    vp.created_at,
    pr.username,
    pr.display_name,
    pr.avatar_url,
    COALESCE(pr.is_verified, false) AS is_verified
  FROM visible_posts vp
  JOIN public.profiles pr ON pr.user_id = vp.user_id
  ORDER BY vp.created_at DESC, vp.id DESC
  LIMIT p_limit;
$$;

REVOKE ALL ON FUNCTION public.get_feed_page(INT, TIMESTAMPTZ, UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_feed_page(INT, TIMESTAMPTZ, UUID) TO authenticated;
