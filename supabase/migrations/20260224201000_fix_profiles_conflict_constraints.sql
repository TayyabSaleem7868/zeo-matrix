-- Fix signup failure:
--   ERROR: there is no unique or exclusion constraint matching the ON CONFLICT specification
--
-- The auth.users -> public.handle_new_user() trigger uses:
--   ON CONFLICT (user_id) ...
-- which requires a UNIQUE constraint or UNIQUE index on public.profiles(user_id).
--
-- Some projects end up without this constraint (manual table edits / drift / old migrations).
-- Add the required constraints idempotently.

DO $$
BEGIN
  -- Ensure uniqueness for ON CONFLICT (user_id)
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint c
    JOIN pg_class t ON t.oid = c.conrelid
    JOIN pg_namespace n ON n.oid = t.relnamespace
    WHERE n.nspname = 'public'
      AND t.relname = 'profiles'
      AND c.contype = 'u'
      AND pg_get_constraintdef(c.oid) ILIKE '%(user_id)%'
  ) THEN
    ALTER TABLE public.profiles
      ADD CONSTRAINT profiles_user_id_key UNIQUE (user_id);
  END IF;

  -- Ensure username is unique (expected by handle generator logic)
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint c
    JOIN pg_class t ON t.oid = c.conrelid
    JOIN pg_namespace n ON n.oid = t.relnamespace
    WHERE n.nspname = 'public'
      AND t.relname = 'profiles'
      AND c.contype = 'u'
      AND pg_get_constraintdef(c.oid) ILIKE '%(username)%'
  ) THEN
    ALTER TABLE public.profiles
      ADD CONSTRAINT profiles_username_key UNIQUE (username);
  END IF;
END $$;
