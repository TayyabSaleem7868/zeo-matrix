BEGIN;
ALTER TABLE public.messages
  ADD COLUMN IF NOT EXISTS reply_to_message_id UUID REFERENCES public.messages(id) ON DELETE SET NULL;

ALTER TABLE public.messages
  ADD COLUMN IF NOT EXISTS deleted_for_user_ids UUID[] NOT NULL DEFAULT '{}'::uuid[];

ALTER TABLE public.messages
  ADD COLUMN IF NOT EXISTS edited_at TIMESTAMPTZ;
CREATE TABLE IF NOT EXISTS public.message_reactions (
  message_id UUID REFERENCES public.messages(id) ON DELETE CASCADE NOT NULL,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  emoji TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (message_id, user_id, emoji)
);

ALTER TABLE public.message_reactions ENABLE ROW LEVEL SECURITY;
CREATE TABLE IF NOT EXISTS public.message_user_state (
  conversation_id UUID REFERENCES public.conversations(id) ON DELETE CASCADE NOT NULL,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  cleared_at TIMESTAMPTZ,
  PRIMARY KEY (conversation_id, user_id)
);

ALTER TABLE public.message_user_state ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Messages: members can view" ON public.messages;
CREATE POLICY "Messages: members can view"
ON public.messages FOR SELECT
USING (
  EXISTS (
    SELECT 1
    FROM public.conversation_members m
    WHERE m.conversation_id = conversation_id
      AND m.user_id = auth.uid()
  )
  AND NOT (auth.uid() = ANY(deleted_for_user_ids))
  AND (
    (SELECT mus.cleared_at
     FROM public.message_user_state mus
     WHERE mus.conversation_id = conversation_id
       AND mus.user_id = auth.uid())
    IS NULL
    OR created_at > (
      SELECT mus.cleared_at
      FROM public.message_user_state mus
      WHERE mus.conversation_id = conversation_id
        AND mus.user_id = auth.uid()
    )
  )
);
DROP POLICY IF EXISTS "Reactions: members can view" ON public.message_reactions;
CREATE POLICY "Reactions: members can view"
ON public.message_reactions FOR SELECT
USING (
  EXISTS (
    SELECT 1
    FROM public.messages msg
    JOIN public.conversation_members m
      ON m.conversation_id = msg.conversation_id
    WHERE msg.id = message_id
      AND m.user_id = auth.uid()
  )
);
DROP POLICY IF EXISTS "Reactions: user can react" ON public.message_reactions;
CREATE POLICY "Reactions: user can react"
ON public.message_reactions FOR INSERT
WITH CHECK (
  auth.uid() = user_id
  AND EXISTS (
    SELECT 1
    FROM public.messages msg
    JOIN public.conversation_members m
      ON m.conversation_id = msg.conversation_id
    WHERE msg.id = message_id
      AND m.user_id = auth.uid()
  )
);
DROP POLICY IF EXISTS "Reactions: user can remove own" ON public.message_reactions;
CREATE POLICY "Reactions: user can remove own"
ON public.message_reactions FOR DELETE
USING (auth.uid() = user_id);
DROP POLICY IF EXISTS "Message user state: user can view" ON public.message_user_state;
CREATE POLICY "Message user state: user can view"
ON public.message_user_state FOR SELECT
USING (user_id = auth.uid());
DROP POLICY IF EXISTS "Message user state: user can upsert" ON public.message_user_state;
CREATE POLICY "Message user state: user can upsert"
ON public.message_user_state FOR INSERT
WITH CHECK (user_id = auth.uid());
DROP POLICY IF EXISTS "Message user state: user can update" ON public.message_user_state;
CREATE POLICY "Message user state: user can update"
ON public.message_user_state FOR UPDATE
USING (user_id = auth.uid())
WITH CHECK (user_id = auth.uid());
DO $$
BEGIN
  BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.message_reactions;
  EXCEPTION WHEN duplicate_object THEN
    NULL;
  END;

  BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.message_user_state;
  EXCEPTION WHEN duplicate_object THEN
    NULL;
  END;
END $$;

COMMIT;
