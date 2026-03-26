import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";

export function useUnreadMessages() {
  const { user } = useAuth();
  const [unreadCounts, setUnreadCounts] = useState<Map<string, number>>(new Map());
  const [mutedConversations, setMutedConversations] = useState<Set<string>>(new Set());
  const [lastIncomingMessage, setLastIncomingMessage] = useState<any>(null);

  const loadUnread = useCallback(async () => {
    if (!user) {
      setUnreadCounts(new Map());
      return;
    }

    try {
      const { data: members, error: memErr } = await supabase
        .from("conversation_members")
        .select("conversation_id, muted_until")
        .eq("user_id", user.id);
      if (memErr) throw memErr;

      const muted = new Set<string>();
      (members || []).forEach((m: any) => {
        if (m.muted_until && new Date(m.muted_until).getTime() > Date.now()) {
          muted.add(m.conversation_id);
        }
      });
      setMutedConversations(muted);

      const convIds = [...new Set((members || []).map((m: any) => m.conversation_id))];
      if (convIds.length === 0) {
        setUnreadCounts(new Map());
        return;
      }

      const { data: readStates, error: rsErr } = await (supabase
        .from("message_user_state")
        .select("conversation_id, last_read_at")
        .eq("user_id", user.id)
        .in("conversation_id", convIds) as any);
      if (rsErr) throw rsErr;

      const readMap = new Map<string, string>();
      (readStates || []).forEach((rs: any) => {
        readMap.set(rs.conversation_id, rs.last_read_at);
      });

      const counts = new Map<string, number>();
      for (const cid of convIds) {
        const lastReadAt = readMap.get(cid);
        let query = supabase
          .from("messages")
          .select("id", { count: "exact", head: true })
          .eq("conversation_id", cid)
          .neq("sender_id", user.id);

        if (lastReadAt) {
          query = query.gt("created_at", lastReadAt);
        }

        const { count, error } = await query;
        if (!error && count && count > 0) {
          counts.set(cid, count);
        }
      }

      setUnreadCounts(counts);
    } catch (e) {
      console.error("useUnreadMessages error:", e);
    }
  }, [user?.id]);

  useEffect(() => {
    loadUnread();
  }, [loadUnread]);

  useEffect(() => {
    if (!user) return;

    const channel = supabase
      .channel(`unread-global-${user.id}`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "messages" },
        (payload) => {
          const newMsg = payload.new as any;
          if (newMsg.sender_id && newMsg.sender_id !== user.id) {
            // Update unread counts
            setUnreadCounts((prev) => {
              const next = new Map(prev);
              next.set(newMsg.conversation_id, (prev.get(newMsg.conversation_id) || 0) + 1);
              return next;
            });
            // Signal the message arrival globally
            setLastIncomingMessage(newMsg);
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user?.id]);

  const markConversationRead = useCallback((conversationId: string) => {
    setUnreadCounts((prev) => {
      if (!prev.has(conversationId)) return prev;
      const next = new Map(prev);
      next.delete(conversationId);
      return next;
    });
  }, []);

  const unreadConversationIds = new Set(unreadCounts.keys());
  const totalUnread = Array.from(unreadCounts.keys()).filter(cid => !mutedConversations.has(cid)).length;

  return {
    unreadCounts,
    mutedConversations,
    lastIncomingMessage,
    unreadConversationIds,
    totalUnread,
    markConversationRead,
    refreshUnread: loadUnread,
  };
}
