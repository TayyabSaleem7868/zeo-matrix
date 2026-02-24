


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
DECLARE
  v_base text;
  v_handle text;
  v_try int := 0;
BEGIN
  -- Ensure the trigger can create the profile row even though public.profiles has RLS.
  -- This runs as the function owner (SECURITY DEFINER) and explicitly bypasses RLS.
  PERFORM set_config('row_security', 'off', true);

  -- Base handle from metadata or email prefix, then sanitize to match your username CHECK constraint.
  v_base := COALESCE(NEW.raw_user_meta_data->>'username', split_part(NEW.email, '@', 1));
  v_base := lower(regexp_replace(COALESCE(v_base, ''), '[^a-z0-9_]+', '_', 'g'));
  v_base := regexp_replace(v_base, '^_+|_+$', '', 'g');
  IF v_base = '' THEN
    v_base := 'user_' || substr(NEW.id::text, 1, 8);
  END IF;

  -- Try a few suffixes to avoid unique violations.
  v_handle := v_base;
  WHILE v_try < 20 LOOP
    BEGIN
      INSERT INTO public.profiles (user_id, username, display_name, is_banned, is_verified)
      VALUES (
        NEW.id,
        v_handle,
        COALESCE(NULLIF(NEW.raw_user_meta_data->>'display_name', ''), v_handle),
        false,
        false
      )
      ON CONFLICT ON CONSTRAINT profiles_user_id_key DO UPDATE
        SET username = COALESCE(public.profiles.username, EXCLUDED.username),
            display_name = COALESCE(public.profiles.display_name, EXCLUDED.display_name);

      RETURN NEW;
    EXCEPTION
      WHEN unique_violation THEN
        v_try := v_try + 1;
        v_handle := left(v_base, 20) || '_' || lpad(v_try::text, 2, '0');
    END;
  END LOOP;

  -- Last-resort fallback (should never reach here)
  INSERT INTO public.profiles (user_id, username, display_name, is_banned, is_verified)
  VALUES (
    NEW.id,
    'user_' || substr(NEW.id::text, 1, 8),
    'user_' || substr(NEW.id::text, 1, 8),
    false,
    false
  )
  ON CONFLICT ON CONSTRAINT profiles_user_id_key DO UPDATE
    SET username = COALESCE(public.profiles.username, EXCLUDED.username),
        display_name = COALESCE(public.profiles.display_name, EXCLUDED.display_name);

  RETURN NEW;
END;
$$;

-- Make sure the trigger is always pointing at the latest handle_new_user implementation.
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_user();

INSERT INTO public.profiles (user_id, username, display_name, is_banned, is_verified)
SELECT
  u.id,
  (
    CASE
      WHEN COALESCE(regexp_replace(lower(COALESCE(u.raw_user_meta_data->>'username', split_part(u.email, '@', 1))), '[^a-z0-9_]+', '_', 'g'), '') = ''
        THEN 'user_' || substr(u.id::text, 1, 8)
      ELSE left(regexp_replace(lower(COALESCE(u.raw_user_meta_data->>'username', split_part(u.email, '@', 1))), '[^a-z0-9_]+', '_', 'g'), 24)
    END
  )
  || '_' || substr(replace(u.id::text, '-', ''), 1, 6) AS username,
  COALESCE(NULLIF(u.raw_user_meta_data->>'display_name', ''), split_part(u.email, '@', 1)),
  false,
  false
FROM auth.users u
LEFT JOIN public.profiles p ON p.user_id = u.id
WHERE p.user_id IS NULL;
