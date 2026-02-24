BEGIN;

ALTER TABLE public.conversation_members
  ADD COLUMN IF NOT EXISTS pinned_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS muted_until TIMESTAMPTZ;

ALTER TABLE public.message_user_state
  ADD COLUMN IF NOT EXISTS last_read_message_id UUID REFERENCES public.messages(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS last_read_at TIMESTAMPTZ;

DROP POLICY IF EXISTS "Conversation members: member can update preferences" ON public.conversation_members;
CREATE POLICY "Conversation members: member can update preferences"
ON public.conversation_members FOR UPDATE
USING (user_id = auth.uid())
WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS "Message user state: user can upsert" ON public.message_user_state;
CREATE POLICY "Message user state: user can upsert"
ON public.message_user_state FOR INSERT
WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS "Message user state: user can update" ON public.message_user_state;
CREATE POLICY "Message user state: user can update"
ON public.message_user_state FOR UPDATE
USING (user_id = auth.uid())
WITH CHECK (user_id = auth.uid());

CREATE TABLE IF NOT EXISTS public.conversation_typing (
  conversation_id UUID REFERENCES public.conversations(id) ON DELETE CASCADE NOT NULL,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  is_typing BOOLEAN NOT NULL DEFAULT false,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (conversation_id, user_id)
);

ALTER TABLE public.conversation_typing ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Typing: members can view" ON public.conversation_typing;
CREATE POLICY "Typing: members can view"
ON public.conversation_typing FOR SELECT
USING (public.is_conversation_member(conversation_id));

DROP POLICY IF EXISTS "Typing: user can upsert" ON public.conversation_typing;
CREATE POLICY "Typing: user can upsert"
ON public.conversation_typing FOR INSERT
WITH CHECK (auth.uid() = user_id AND public.is_conversation_member(conversation_id));

DROP POLICY IF EXISTS "Typing: user can update own" ON public.conversation_typing;
CREATE POLICY "Typing: user can update own"
ON public.conversation_typing FOR UPDATE
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

CREATE OR REPLACE FUNCTION public.set_typing(p_conversation_id uuid, p_is_typing boolean)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.conversation_typing (conversation_id, user_id, is_typing, updated_at)
  VALUES (p_conversation_id, auth.uid(), p_is_typing, now())
  ON CONFLICT (conversation_id, user_id)
  DO UPDATE SET is_typing = EXCLUDED.is_typing, updated_at = EXCLUDED.updated_at;
END;
$$;

REVOKE ALL ON FUNCTION public.set_typing(uuid, boolean) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.set_typing(uuid, boolean) TO authenticated;

DO $$
BEGIN
  BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.conversation_typing;
  EXCEPTION WHEN duplicate_object THEN
    NULL;
  END;
END $$;

COMMIT;
