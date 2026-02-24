-- Fix likes FK to reference auth.users(id) reliably.
-- Some environments ended up with likes.user_id referencing public.profiles(id),
-- which breaks inserts because the app uses auth uid as user_id.

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM pg_constraint c
    JOIN pg_class t ON t.oid = c.conrelid
    JOIN pg_namespace n ON n.oid = t.relnamespace
    WHERE n.nspname = 'public'
      AND t.relname = 'likes'
      AND c.conname = 'likes_user_id_fkey'
  ) THEN
    EXECUTE 'ALTER TABLE public.likes DROP CONSTRAINT likes_user_id_fkey';
  END IF;
END $$;

ALTER TABLE public.likes
  ADD CONSTRAINT likes_user_id_fkey
  FOREIGN KEY (user_id)
  REFERENCES auth.users(id)
  ON DELETE CASCADE;

-- Optional: ensure the uniqueness constraint exists (safe if already present).
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint c
    JOIN pg_class t ON t.oid = c.conrelid
    JOIN pg_namespace n ON n.oid = t.relnamespace
    WHERE n.nspname = 'public'
      AND t.relname = 'likes'
      AND c.contype = 'u'
      AND c.conname = 'likes_user_id_post_id_key'
  ) THEN
    -- Name inferred by Postgres can differ; create a deterministic one if missing.
    EXECUTE 'ALTER TABLE public.likes ADD CONSTRAINT likes_user_id_post_id_key UNIQUE (user_id, post_id)';
  END IF;
END $$;
