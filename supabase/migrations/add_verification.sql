
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS is_verified BOOLEAN DEFAULT false;

-- NOTE: This file used to redefine public.handle_new_user() and could overwrite the canonical
-- signup trigger function from later migrations. We intentionally keep this logic under a
-- different name to avoid breaking signup.
CREATE OR REPLACE FUNCTION public.handle_new_user_add_verification()
RETURNS trigger AS $$
BEGIN
  INSERT INTO public.profiles (user_id, username, display_name, is_banned, is_verified)
  VALUES (
    new.id,
    COALESCE(new.raw_user_meta_data->>'username', split_part(new.email, '@', 1)),
    new.raw_user_meta_data->>'display_name',
    false,
    false
  )
  ON CONFLICT (user_id) DO NOTHING;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
