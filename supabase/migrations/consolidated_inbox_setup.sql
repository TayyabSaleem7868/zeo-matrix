-- ==========================================
-- ALL-IN-ONE INBOX UPGRADE BACKEND SETUP
-- ==========================================

BEGIN;

-- 1. ENHANCE MESSAGES TABLE
-- Add support for media attachments (images, video, audio)
ALTER TABLE public.messages 
ADD COLUMN IF NOT EXISTS attachment_url TEXT,
ADD COLUMN IF NOT EXISTS attachment_type TEXT,
ADD COLUMN IF NOT EXISTS reply_to_message_id UUID REFERENCES public.messages(id) ON DELETE SET NULL,
ADD COLUMN IF NOT EXISTS deleted_for_user_ids UUID[] NOT NULL DEFAULT '{}'::uuid[],
ADD COLUMN IF NOT EXISTS edited_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS is_deleted BOOLEAN NOT NULL DEFAULT false;

-- 2. ENHANCE CONVERSATION MEMBERS
-- Add support for pinning and muting conversations
ALTER TABLE public.conversation_members
ADD COLUMN IF NOT EXISTS pinned_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS muted_until TIMESTAMPTZ;

-- 3. MESSAGE REACTIONS
-- Create table for emoji reactions
CREATE TABLE IF NOT EXISTS public.message_reactions (
  message_id UUID REFERENCES public.messages(id) ON DELETE CASCADE NOT NULL,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  emoji TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (message_id, user_id, emoji)
);

-- 4. MESSAGE USER STATE (READ RECEIPTS)
-- Track last read message and cleared chat history
CREATE TABLE IF NOT EXISTS public.message_user_state (
  conversation_id UUID REFERENCES public.conversations(id) ON DELETE CASCADE NOT NULL,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  cleared_at TIMESTAMPTZ,
  last_read_message_id UUID REFERENCES public.messages(id) ON DELETE SET NULL,
  last_read_at TIMESTAMPTZ,
  PRIMARY KEY (conversation_id, user_id)
);

-- 5. REAL-TIME TYPING INDICATORS
-- Create table for typing status
CREATE TABLE IF NOT EXISTS public.conversation_typing (
  conversation_id UUID REFERENCES public.conversations(id) ON DELETE CASCADE NOT NULL,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  is_typing BOOLEAN NOT NULL DEFAULT false,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (conversation_id, user_id)
);

-- 6. RPC: SET TYPING
-- Function to efficiently update typing status
CREATE OR REPLACE FUNCTION public.set_typing(p_conversation_id uuid, p_is_typing boolean)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.conversation_typing (conversation_id, user_id, is_typing, updated_at)
  VALUES (p_conversation_id, auth.uid(), p_is_typing, now())
  ON CONFLICT (conversation_id, user_id)
  DO UPDATE SET is_typing = EXCLUDED.is_typing, updated_at = EXCLUDED.updated_at;
END;
$$;

-- 7. PERMISSIONS & RLS
ALTER TABLE public.message_reactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.message_user_state ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.conversation_typing ENABLE ROW LEVEL SECURITY;

-- Reactions: Viewable by conversation members
DROP POLICY IF EXISTS "Reactions: members can view" ON public.message_reactions;
CREATE POLICY "Reactions: members can view" ON public.message_reactions FOR SELECT
USING (EXISTS (SELECT 1 FROM public.messages m WHERE m.id = message_id AND public.is_conversation_member(m.conversation_id)));

-- Reactions: User can react/unreact
DROP POLICY IF EXISTS "Reactions: user can react" ON public.message_reactions;
CREATE POLICY "Reactions: user can react" ON public.message_reactions FOR INSERT WITH CHECK (auth.uid() = user_id);
DROP POLICY IF EXISTS "Reactions: user can delete own" ON public.message_reactions;
CREATE POLICY "Reactions: user can delete own" ON public.message_reactions FOR DELETE USING (auth.uid() = user_id);

-- User State: Only user can see/update their own state
DROP POLICY IF EXISTS "User state: select own" ON public.message_user_state;
CREATE POLICY "User state: select own" ON public.message_user_state FOR SELECT USING (auth.uid() = user_id);
DROP POLICY IF EXISTS "User state: upsert own" ON public.message_user_state;
CREATE POLICY "User state: upsert own" ON public.message_user_state FOR ALL USING (auth.uid() = user_id);

-- Typing: Viewable by members, only user can update own
DROP POLICY IF EXISTS "Typing: viewable by members" ON public.conversation_typing;
CREATE POLICY "Typing: viewable by members" ON public.conversation_typing FOR SELECT USING (public.is_conversation_member(conversation_id));
DROP POLICY IF EXISTS "Typing: upsert own" ON public.conversation_typing;
CREATE POLICY "Typing: upsert own" ON public.conversation_typing FOR ALL USING (auth.uid() = user_id);

-- 8. REALTIME CONFIGURATION
-- Ensure tables are in the realtime publication
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname = 'supabase_realtime' AND tablename = 'messages') THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.messages;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname = 'supabase_realtime' AND tablename = 'message_reactions') THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.message_reactions;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname = 'supabase_realtime' AND tablename = 'conversation_typing') THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.conversation_typing;
  END IF;
END $$;

-- 9. GRANTS
GRANT EXECUTE ON FUNCTION public.set_typing(uuid, boolean) TO authenticated;

COMMIT;
