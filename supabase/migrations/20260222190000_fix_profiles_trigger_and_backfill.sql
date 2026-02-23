
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS is_banned BOOLEAN DEFAULT false;

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS is_verified BOOLEAN DEFAULT false;
UPDATE public.profiles
SET is_banned = COALESCE(is_banned, false),
    is_verified = COALESCE(is_verified, false);
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
