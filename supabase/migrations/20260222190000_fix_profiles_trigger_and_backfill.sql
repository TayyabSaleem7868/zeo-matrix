-- Fix profile auto-creation trigger and backfill missing profiles
-- الهدف: mobile/desktop دونوں signups کے لئے profiles row ہمیشہ create ہو اور verified badge consistently work کرے.

-- 1) Ensure columns exist and defaults are sane
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS is_banned BOOLEAN DEFAULT false;

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS is_verified BOOLEAN DEFAULT false;

-- Backfill NULLs (in case older rows exist)
UPDATE public.profiles
SET is_banned = COALESCE(is_banned, false),
    is_verified = COALESCE(is_verified, false);

-- 2) Create/Replace handle_new_user with correct conflict target (user_id)
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (user_id, username, display_name, is_banned, is_verified)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'username', split_part(NEW.email, '@', 1)),
    COALESCE(NEW.raw_user_meta_data->>'display_name', split_part(NEW.email, '@', 1)),
    false,
    false
  )
  ON CONFLICT (user_id) DO UPDATE
    SET username = EXCLUDED.username,
        display_name = EXCLUDED.display_name;

  RETURN NEW;
END;
$$;

-- 3) Ensure trigger exists (idempotent)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_trigger
    WHERE tgname = 'on_auth_user_created'
  ) THEN
    CREATE TRIGGER on_auth_user_created
      AFTER INSERT ON auth.users
      FOR EACH ROW
      EXECUTE FUNCTION public.handle_new_user();
  END IF;
END $$;

-- 4) Backfill: create profiles for any auth.users without a profile row
INSERT INTO public.profiles (user_id, username, display_name, is_banned, is_verified)
SELECT
  u.id,
  COALESCE(u.raw_user_meta_data->>'username', split_part(u.email, '@', 1)),
  COALESCE(u.raw_user_meta_data->>'display_name', split_part(u.email, '@', 1)),
  false,
  false
FROM auth.users u
LEFT JOIN public.profiles p ON p.user_id = u.id
WHERE p.user_id IS NULL;
