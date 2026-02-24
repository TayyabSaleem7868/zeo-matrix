-- Fix: allow the auth signup trigger (SECURITY DEFINER) to create a profile row.
--
-- Problem
--   public.handle_new_user() runs on auth.users insert and inserts into public.profiles.
--   But profiles has RLS with an INSERT policy requiring auth.uid() = user_id.
--   During signup trigger execution, auth.uid() is NULL, so the insert is blocked,
--   causing "Database error saving new user".
--
-- Solution
--   Permit inserts executed by the service role used by the auth system
--   (supabase_auth_admin) while keeping client-side inserts restricted.

CREATE POLICY IF NOT EXISTS "Auth trigger can insert profiles"
ON public.profiles
FOR INSERT
TO supabase_auth_admin
WITH CHECK (true);
