BEGIN;
CREATE TABLE IF NOT EXISTS public.conversations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  last_message_at TIMESTAMPTZ
);

ALTER TABLE public.conversations ENABLE ROW LEVEL SECURITY;
CREATE TABLE IF NOT EXISTS public.conversation_members (
  conversation_id UUID REFERENCES public.conversations(id) ON DELETE CASCADE NOT NULL,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  role TEXT NOT NULL DEFAULT 'member' CHECK (role IN ('member')),
  joined_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (conversation_id, user_id)
);

ALTER TABLE public.conversation_members ENABLE ROW LEVEL SECURITY;
CREATE TABLE IF NOT EXISTS public.messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id UUID REFERENCES public.conversations(id) ON DELETE CASCADE NOT NULL,
  sender_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  content TEXT NOT NULL DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  edited_at TIMESTAMPTZ,
  is_deleted BOOLEAN NOT NULL DEFAULT false,
  reply_to_message_id UUID REFERENCES public.messages(id) ON DELETE SET NULL,
  deleted_for_user_ids UUID[] NOT NULL DEFAULT '{}'::uuid[]
);

ALTER TABLE public.messages ENABLE ROW LEVEL SECURITY;
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
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'update_conversations_updated_at') THEN
    CREATE TRIGGER update_conversations_updated_at
      BEFORE UPDATE ON public.conversations
      FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
  END IF;
END $$;
DROP POLICY IF EXISTS "Conversations: members can view" ON public.conversations;
CREATE POLICY "Conversations: members can view"
ON public.conversations FOR SELECT
USING (
  EXISTS (
    SELECT 1
    FROM public.conversation_members m
    WHERE m.conversation_id = id
      AND m.user_id = auth.uid()
  )
);
DROP POLICY IF EXISTS "Conversations: authenticated can insert" ON public.conversations;
CREATE POLICY "Conversations: authenticated can insert"
ON public.conversations FOR INSERT
WITH CHECK (auth.uid() IS NOT NULL);
CREATE OR REPLACE FUNCTION public.is_conversation_member(p_conversation_id uuid)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.conversation_members m
    WHERE m.conversation_id = p_conversation_id
      AND m.user_id = auth.uid()
  );
$$;

REVOKE ALL ON FUNCTION public.is_conversation_member(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.is_conversation_member(uuid) TO authenticated;

DROP POLICY IF EXISTS "Conversation members: members can view" ON public.conversation_members;
CREATE POLICY "Conversation members: members can view"
ON public.conversation_members FOR SELECT
USING (
  public.is_conversation_member(conversation_id)
);
DROP POLICY IF EXISTS "Conversation members: user can join" ON public.conversation_members;
CREATE POLICY "Conversation members: user can join"
ON public.conversation_members FOR INSERT
WITH CHECK (auth.uid() = user_id);
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
DROP POLICY IF EXISTS "Messages: members can send" ON public.messages;
CREATE POLICY "Messages: members can send"
ON public.messages FOR INSERT
WITH CHECK (
  auth.uid() = sender_id
  AND EXISTS (
    SELECT 1
    FROM public.conversation_members m
    WHERE m.conversation_id = conversation_id
      AND m.user_id = auth.uid()
  )
);
DROP POLICY IF EXISTS "Messages: sender can update" ON public.messages;
CREATE POLICY "Messages: sender can update"
ON public.messages FOR UPDATE
USING (auth.uid() = sender_id)
WITH CHECK (auth.uid() = sender_id);
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

ALTER PUBLICATION supabase_realtime ADD TABLE public.conversations;
ALTER PUBLICATION supabase_realtime ADD TABLE public.conversation_members;
ALTER PUBLICATION supabase_realtime ADD TABLE public.messages;
ALTER PUBLICATION supabase_realtime ADD TABLE public.message_reactions;
ALTER PUBLICATION supabase_realtime ADD TABLE public.message_user_state;
CREATE OR REPLACE FUNCTION public.get_or_create_dm(p_other_user_id UUID)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_me UUID;
  v_conversation UUID;
BEGIN
  v_me := auth.uid();
  IF v_me IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  IF p_other_user_id IS NULL OR p_other_user_id = v_me THEN
    RAISE EXCEPTION 'Invalid other user';
  END IF;
  SELECT c.id
  INTO v_conversation
  FROM public.conversations c
  WHERE EXISTS (
    SELECT 1 FROM public.conversation_members m
    WHERE m.conversation_id = c.id AND m.user_id = v_me
  )
  AND EXISTS (
    SELECT 1 FROM public.conversation_members m
    WHERE m.conversation_id = c.id AND m.user_id = p_other_user_id
  )
  AND (
    SELECT count(*)
    FROM public.conversation_members m
    WHERE m.conversation_id = c.id
  ) = 2
  ORDER BY c.updated_at DESC
  LIMIT 1;

  IF v_conversation IS NOT NULL THEN
    RETURN v_conversation;
  END IF;

  INSERT INTO public.conversations DEFAULT VALUES
  RETURNING id INTO v_conversation;

  INSERT INTO public.conversation_members (conversation_id, user_id)
  VALUES (v_conversation, v_me), (v_conversation, p_other_user_id)
  ON CONFLICT DO NOTHING;

  RETURN v_conversation;
END;
$$;

REVOKE ALL ON FUNCTION public.get_or_create_dm(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_or_create_dm(UUID) TO authenticated;
CREATE OR REPLACE FUNCTION public.touch_conversation_on_message()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE public.conversations
  SET last_message_at = NEW.created_at,
      updated_at = now()
  WHERE id = NEW.conversation_id;
  RETURN NEW;
END;
$$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'messages_touch_conversation') THEN
    CREATE TRIGGER messages_touch_conversation
      AFTER INSERT ON public.messages
      FOR EACH ROW
      EXECUTE FUNCTION public.touch_conversation_on_message();
  END IF;
END $$;

COMMIT;
