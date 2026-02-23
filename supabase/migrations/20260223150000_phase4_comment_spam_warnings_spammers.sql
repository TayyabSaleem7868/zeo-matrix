
CREATE TABLE IF NOT EXISTS public.comment_spam_warnings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  comment_id UUID NULL,
  post_id UUID NULL,
  reason TEXT NOT NULL DEFAULT 'spam',
  details TEXT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_comment_spam_warnings_user_created_at
  ON public.comment_spam_warnings (user_id, created_at DESC);
CREATE TABLE IF NOT EXISTS public.spammer_flags (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL UNIQUE,
  warnings_count INT NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open','reviewed','ignored')),
  last_warning_at TIMESTAMPTZ NULL,
  admin_note TEXT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_spammer_flags_status_updated_at
  ON public.spammer_flags (status, updated_at DESC);
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at := now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_spammer_flags_updated_at ON public.spammer_flags;
CREATE TRIGGER trg_spammer_flags_updated_at
BEFORE UPDATE ON public.spammer_flags
FOR EACH ROW
EXECUTE FUNCTION public.set_updated_at();
ALTER TABLE public.comment_spam_warnings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.spammer_flags ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "warnings_select_own" ON public.comment_spam_warnings;
CREATE POLICY "warnings_select_own"
ON public.comment_spam_warnings
FOR SELECT
TO authenticated
USING (auth.uid() = user_id);
DROP POLICY IF EXISTS "warnings_no_write" ON public.comment_spam_warnings;
CREATE POLICY "warnings_no_write"
ON public.comment_spam_warnings
FOR ALL
TO authenticated
USING (false)
WITH CHECK (false);
DROP POLICY IF EXISTS "spammer_flags_no_select" ON public.spammer_flags;
CREATE POLICY "spammer_flags_no_select"
ON public.spammer_flags
FOR SELECT
TO authenticated
USING (false);

DROP POLICY IF EXISTS "spammer_flags_no_write" ON public.spammer_flags;
CREATE POLICY "spammer_flags_no_write"
ON public.spammer_flags
FOR ALL
TO authenticated
USING (false)
WITH CHECK (false);

CREATE OR REPLACE FUNCTION public.handle_comment_spam_guard()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_recent_count INT;
  v_same_text_recent INT;
  v_warnings_24h INT;
  v_is_spam BOOLEAN := FALSE;
  v_reason TEXT := NULL;
BEGIN
  SELECT COUNT(*) INTO v_warnings_24h
  FROM public.comment_spam_warnings w
  WHERE w.user_id = NEW.user_id
    AND w.created_at >= now() - interval '24 hours';
  SELECT COUNT(*) INTO v_recent_count
  FROM public.comments c
  WHERE c.user_id = NEW.user_id
    AND c.created_at >= now() - interval '60 seconds';
  SELECT COUNT(*) INTO v_same_text_recent
  FROM public.comments c
  WHERE c.user_id = NEW.user_id
    AND c.content = NEW.content
    AND c.created_at >= now() - interval '10 minutes';

  IF v_recent_count >= 6 THEN
    v_is_spam := TRUE;
    v_reason := 'rate_limit';
  ELSIF v_same_text_recent >= 2 THEN
    v_is_spam := TRUE;
    v_reason := 'repeat_text';
  END IF;

  IF v_is_spam THEN
    IF v_warnings_24h < 3 THEN
      INSERT INTO public.comment_spam_warnings (user_id, comment_id, post_id, reason, details)
      VALUES (NEW.user_id, NEW.id, NEW.post_id, v_reason, left(NEW.content, 200));

      v_warnings_24h := v_warnings_24h + 1;
    END IF;
    INSERT INTO public.spammer_flags (user_id, warnings_count, status, last_warning_at)
    VALUES (NEW.user_id, v_warnings_24h, CASE WHEN v_warnings_24h >= 3 THEN 'open' ELSE 'ignored' END, now())
    ON CONFLICT (user_id)
    DO UPDATE SET
      warnings_count = EXCLUDED.warnings_count,
      last_warning_at = now(),
      status = CASE WHEN EXCLUDED.warnings_count >= 3 THEN 'open' ELSE public.spammer_flags.status END;
    IF v_warnings_24h >= 3 THEN
      DELETE FROM public.comments WHERE id = NEW.id;
      RETURN NULL;
    END IF;
  END IF;

  RETURN NEW;
END;
$$;
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema='public' AND table_name='comments'
  ) THEN
    BEGIN
      EXECUTE 'ALTER TABLE public.comments ALTER COLUMN created_at SET DEFAULT now()';
    EXCEPTION WHEN others THEN
      NULL;
    END;

    EXECUTE 'DROP TRIGGER IF EXISTS trg_comment_spam_guard ON public.comments';
    EXECUTE 'CREATE TRIGGER trg_comment_spam_guard AFTER INSERT ON public.comments FOR EACH ROW EXECUTE FUNCTION public.handle_comment_spam_guard()';
  END IF;
END $$;
CREATE OR REPLACE FUNCTION public.get_my_spam_warnings_count(p_window_hours INT DEFAULT 24)
RETURNS INT
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COUNT(*)::int
  FROM public.comment_spam_warnings w
  WHERE w.user_id = auth.uid()
    AND w.created_at >= now() - (p_window_hours || ' hours')::interval;
$$;

REVOKE ALL ON FUNCTION public.get_my_spam_warnings_count(INT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_my_spam_warnings_count(INT) TO authenticated;
CREATE OR REPLACE FUNCTION public.admin_list_spammers(p_limit INT DEFAULT 50)
RETURNS TABLE (
  user_id UUID,
  username TEXT,
  display_name TEXT,
  avatar_url TEXT,
  warnings_count INT,
  status TEXT,
  last_warning_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ
)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    f.user_id,
    p.username,
    p.display_name,
    p.avatar_url,
    f.warnings_count,
    f.status,
    f.last_warning_at,
    f.updated_at
  FROM public.spammer_flags f
  JOIN public.profiles p ON p.user_id = f.user_id
  WHERE f.status = 'open'
  ORDER BY f.updated_at DESC
  LIMIT p_limit;
$$;

REVOKE ALL ON FUNCTION public.admin_list_spammers(INT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.admin_list_spammers(INT) TO authenticated;

CREATE OR REPLACE FUNCTION public.admin_update_spammer_status(p_user_id UUID, p_status TEXT, p_admin_note TEXT DEFAULT NULL)
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF p_status NOT IN ('reviewed','ignored','open') THEN
    RAISE EXCEPTION 'Invalid status %', p_status;
  END IF;

  UPDATE public.spammer_flags
  SET status = p_status,
      admin_note = COALESCE(p_admin_note, admin_note)
  WHERE user_id = p_user_id;

  IF NOT FOUND THEN
    RETURN 'not_found';
  END IF;

  RETURN 'ok';
END;
$$;

REVOKE ALL ON FUNCTION public.admin_update_spammer_status(UUID, TEXT, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.admin_update_spammer_status(UUID, TEXT, TEXT) TO authenticated;
