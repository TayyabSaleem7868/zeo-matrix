import { useEffect, useRef, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import {
  ArrowLeft,
  Check,
  Eraser,
  Send,
  X,
} from "lucide-react";

function clamp(n: number, min: number, max: number) {
  return Math.max(min, Math.min(max, n));
}

type MessageRow = {
  id: string;
  conversation_id: string;
  sender_id: string | null;
  content: string;
  created_at: string;
  edited_at?: string | null;
  is_deleted?: boolean;
  reply_to_message_id?: string | null;
};

type Profile = {
  user_id: string;
  username: string;
  display_name: string | null;
  avatar_url: string | null;
  is_verified?: boolean | null;
};

type TypingRow = {
  conversation_id: string;
  user_id: string;
  is_typing: boolean;
  updated_at: string;
};

function InlineActions(props: {
  mine: boolean;
  canEdit: boolean;
  onReply: () => void;
  onEdit: () => void;
  onDeleteForMe: () => void;
  onUnsend: () => void;
}) {
  const { mine, canEdit, onReply, onEdit, onDeleteForMe, onUnsend } = props;

  return (
    <div className="flex items-center gap-1 rounded-2xl border border-border/60 bg-background/70 backdrop-blur px-1.5 py-1">
      <Button variant="ghost" size="sm" className="h-8 rounded-xl" onClick={onReply}>
        Reply
      </Button>

      {mine && canEdit && (
        <Button variant="ghost" size="sm" className="h-8 rounded-xl" onClick={onEdit}>
          Edit
        </Button>
      )}

      <Button variant="ghost" size="sm" className="h-8 rounded-xl" onClick={onDeleteForMe}>
        Delete
      </Button>

      {mine && (
        <Button
          variant="ghost"
          size="sm"
          className="h-8 rounded-xl text-destructive hover:text-destructive"
          onClick={onUnsend}
        >
          Unsend
        </Button>
      )}
    </div>
  );
}

export default function ChatThread() {
  const { conversationId } = useParams();
  const { user } = useAuth();
  const { toast } = useToast();
  const navigate = useNavigate();

  const [other, setOther] = useState<Profile | null>(null);
  const [messages, setMessages] = useState<MessageRow[]>([]);
  const [text, setText] = useState("");
  const [sending, setSending] = useState(false);
  const [loading, setLoading] = useState(true);
  const [otherTyping, setOtherTyping] = useState(false);
  const typingTimerRef = useRef<number | null>(null);
  const lastTypingSentRef = useRef<"on" | "off">("off");
  const [lastReadMessageId, setLastReadMessageId] = useState<string | null>(null);

  const [replyTo, setReplyTo] = useState<MessageRow | null>(null);
  const [editingMsg, setEditingMsg] = useState<MessageRow | null>(null);
  const [isTouchLike, setIsTouchLike] = useState(false);
  const [actionsForMessageId, setActionsForMessageId] = useState<string | null>(null);
  const [swipeXById, setSwipeXById] = useState<Record<string, number>>({});
  const swipeStartRef = useRef<{
    id: string;
    x: number;
    y: number;
    active: boolean;
  } | null>(null);

  const endRef = useRef<HTMLDivElement | null>(null);
  const convId = conversationId || "";

  const setTyping = async (isTyping: boolean) => {
    if (!user || !convId) return;
    const next: "on" | "off" = isTyping ? "on" : "off";
    if (lastTypingSentRef.current === next) return;
    lastTypingSentRef.current = next;
    await supabase.rpc("set_typing" as any, { p_conversation_id: convId, p_is_typing: isTyping } as any);
  };

  const markRead = async (msgId: string | null) => {
    if (!user || !convId || !msgId) return;
    setLastReadMessageId(msgId);
    await supabase
      .from("message_user_state")
      .upsert({
        conversation_id: convId,
        user_id: user.id,
        last_read_message_id: msgId,
        last_read_at: new Date().toISOString(),
      } as any);
  };

  useEffect(() => {
    const mq = typeof window !== "undefined" ? window.matchMedia("(hover: none), (pointer: coarse)") : null;
    if (!mq) return;
    const apply = () => setIsTouchLike(!!mq.matches);
    apply();
    mq.addEventListener ? mq.addEventListener("change", apply) : mq.addListener(apply);
    return () => {
      mq.removeEventListener ? mq.removeEventListener("change", apply) : mq.removeListener(apply);
    };
  }, []);

  const scrollToBottom = () => {
    endRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  const beginReply = (m: MessageRow) => {
    setReplyTo(m);
    setEditingMsg(null);
    setActionsForMessageId(null);
    requestAnimationFrame(() => {
      const el = document.getElementById("chat-composer");
      el?.scrollIntoView({ behavior: "smooth", block: "nearest" });
    });
  };

  const loadThread = async () => {
    if (!user || !convId) return;
    setLoading(true);
    try {
      const { data: mems, error: memErr } = await supabase
        .from("conversation_members")
        .select("conversation_id, user_id")
        .eq("conversation_id", convId);
      if (memErr) throw memErr;

      const amMember = (mems || []).some((m: any) => m.user_id === user.id);
      if (!amMember) {
        toast({
          title: "No access",
          description: "You're not a member of this chat",
          variant: "destructive",
        });
        navigate("/inbox");
        return;
      }

      const otherId = (mems || []).find((m: any) => m.user_id !== user.id)?.user_id as string | undefined;
      if (otherId) {
        const { data: prof, error: pErr } = await (supabase
          .from("profiles")
          .select("user_id, username, display_name, avatar_url, is_verified") as any)
          .eq("user_id", otherId)
          .maybeSingle();
        if (!pErr) setOther(prof as any);
      }

      const { data: msgs, error: msgErr } = await supabase
        .from("messages")
        .select("id, conversation_id, sender_id, content, created_at, is_deleted, edited_at, reply_to_message_id")
        .eq("conversation_id", convId)
        .order("created_at", { ascending: true })
        .limit(200);
      if (msgErr) throw msgErr;

      const msgList = (msgs || []) as any as MessageRow[];
      setMessages(msgList);

      const lastMsgId = msgList.length ? msgList[msgList.length - 1].id : null;
      if (lastMsgId) markRead(lastMsgId);

      requestAnimationFrame(() => scrollToBottom());
    } catch (e: any) {
      console.error(e);
      toast({
        title: "Chat error",
        description: e?.message || "Failed to load chat",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadThread();
  }, [user?.id, convId]);

  useEffect(() => {
    if (!user || !convId) return;

    const channel = supabase
      .channel(`thread-${convId}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "messages", filter: `conversation_id=eq.${convId}` },
        () => loadThread()
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "conversation_typing", filter: `conversation_id=eq.${convId}` },
        (payload) => {
          const row = (payload.new || payload.old) as any as TypingRow | null;
          if (!row) return;
          if (row.user_id === user.id) return;
          const fresh = row.updated_at ? new Date(row.updated_at).getTime() > Date.now() - 15000 : false;
          setOtherTyping(!!row.is_typing && fresh);
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user?.id, convId]);

  useEffect(() => {
    return () => {
      if (typingTimerRef.current) window.clearTimeout(typingTimerRef.current);
      setTyping(false);
    };
  }, [user?.id, convId]);

  const unsendMessage = async (m: MessageRow) => {
    if (!user || m.sender_id !== user.id) return;
    try {
      const { error } = await supabase.from("messages").update({ is_deleted: true } as any).eq("id", m.id);
      if (error) throw error;
    } catch (e: any) {
      toast({ title: "Unsend failed", description: e?.message || "Couldn't unsend", variant: "destructive" });
    }
  };

  const deleteForMe = async (m: MessageRow) => {
    if (!user) return;
    try {
      const { data: row, error: selErr } = await supabase
        .from("messages")
        .select("deleted_for_user_ids")
        .eq("id", m.id)
        .maybeSingle();
      if (selErr) throw selErr;

      const arr = ((row as any)?.deleted_for_user_ids || []) as string[];
      if (arr.includes(user.id)) return;

      const { error } = await supabase
        .from("messages")
        .update({ deleted_for_user_ids: [...arr, user.id] } as any)
        .eq("id", m.id);
      if (error) throw error;

      loadThread();
    } catch (e: any) {
      toast({ title: "Delete failed", description: e?.message || "Couldn't delete", variant: "destructive" });
    }
  };

  const clearChat = async () => {
    if (!user || !convId) return;
    try {
      const { error } = await supabase
        .from("message_user_state")
        .upsert({ conversation_id: convId, user_id: user.id, cleared_at: new Date().toISOString() } as any);
      if (error) throw error;

      setMessages([]);
      toast({ title: "Chat cleared", description: "Cleared for you only" });
    } catch (e: any) {
      console.error(e);
      setMessages([]);
      toast({
        title: "Clear failed",
        description:
          (e?.message?.includes("row-level security")
            ? "Server clear blocked by RLS for message_user_state. I cleared this chat locally; apply the RLS policy in Supabase to make it persist."
            : e?.message) || "Couldn't clear chat",
        variant: "destructive",
      });
    }
  };

  const send = async () => {
    if (!user || !convId) return;
    const body = text.trim();
    if (!body) return;

    setSending(true);
    try {
      if (editingMsg) {
        const { error } = await supabase
          .from("messages")
          .update({ content: body, edited_at: new Date().toISOString() } as any)
          .eq("id", editingMsg.id);
        if (error) throw error;

        setEditingMsg(null);
        setText("");
        loadThread();
        return;
      }

      const { error } = await supabase.from("messages").insert({
        conversation_id: convId,
        sender_id: user.id,
        content: body,
        reply_to_message_id: replyTo?.id || null,
      } as any);
      if (error) throw error;

      setText("");
      setReplyTo(null);
      setTyping(false);
      loadThread();
    } catch (e: any) {
      toast({ title: "Send failed", description: e?.message || "Couldn't send message", variant: "destructive" });
    } finally {
      setSending(false);
    }
  };

  const title = other?.display_name || other?.username || "Chat";

  return (
    <div className="max-w-3xl mx-auto px-3 sm:px-4 py-4">
      <div className="flex items-center justify-between gap-3 mb-4">
        <div className="flex items-center gap-2 min-w-0">
          <Button variant="ghost" size="icon" onClick={() => navigate("/inbox")} title="Back">
            <ArrowLeft className="w-5 h-5" />
          </Button>
          <div className="min-w-0">
            <p className="font-semibold text-foreground truncate">{title}</p>
            <div className="flex items-center gap-2">
              {other?.username && <p className="text-xs text-muted-foreground truncate">@{other.username}</p>}
              {otherTyping && <p className="text-xs text-muted-foreground">typing…</p>}
              {lastReadMessageId && <p className="text-xs text-muted-foreground">read</p>}
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Button asChild variant="outline" size="sm">
            <Link to={other?.user_id ? `/profile/${other.user_id}` : "/inbox"}>View profile</Link>
          </Button>

          <Button variant="outline" size="sm" onClick={clearChat} title="Clear chat (for me)">
            <Eraser className="w-4 h-4 mr-2" /> Clear
          </Button>
        </div>
      </div>

      <div className="rounded-3xl border border-border bg-card/40 backdrop-blur-sm overflow-hidden">
        <div
          className="h-[60vh] overflow-auto px-4 py-5 sm:py-4 space-y-4 sm:space-y-2"
          onClick={() => {
            setActionsForMessageId(null);
          }}
        >
          {loading ? (
            <div className="flex justify-center py-16">
              <div className="w-8 h-8 rounded-full border-2 border-primary border-t-transparent animate-spin" />
            </div>
          ) : messages.length === 0 ? (
            <div className="text-center py-16 text-muted-foreground">No messages yet. Say hi.</div>
          ) : (
            messages.map((m) => {
              const mine = m.sender_id === user?.id;
              const replyTarget = m.reply_to_message_id ? messages.find((x) => x.id === m.reply_to_message_id) : null;

              const swipeX = swipeXById[m.id] || 0;
              const showActions = actionsForMessageId === m.id;
              return (
                <div key={m.id} className={`flex ${mine ? "justify-end" : "justify-start"}`}>
                  <div
                    className={
                      "max-w-[85%] relative group rounded-2xl transition-colors"
                    }
                    onClick={(e) => {
                      e.stopPropagation();
                    }}
                    onDoubleClick={(e) => {
                      if (isTouchLike) return;
                      e.stopPropagation();
                      setActionsForMessageId((prev) => (prev === m.id ? null : m.id));
                    }}
                  >
                    {showActions && !m.is_deleted && (
                      <div className={`mb-2 flex ${mine ? "justify-end" : "justify-start"}`}>
                        <InlineActions
                          mine={mine}
                          canEdit={!m.is_deleted}
                          onReply={() => beginReply(m)}
                          onEdit={() => {
                            if (m.is_deleted) return;
                            setEditingMsg(m);
                            setReplyTo(null);
                            setText(m.content);
                            setActionsForMessageId(null);
                          }}
                          onDeleteForMe={() => {
                            deleteForMe(m);
                            setActionsForMessageId(null);
                          }}
                          onUnsend={() => {
                            unsendMessage(m);
                            setActionsForMessageId(null);
                          }}
                        />
                      </div>
                    )}

                    <div className={`flex items-start gap-2 ${mine ? "justify-end" : "justify-start"}`}>
                      <div
                        className={
                          `w-full rounded-2xl px-5 py-3 sm:px-4 sm:py-2 text-sm leading-relaxed transition-transform ` +
                          (mine
                            ? "bg-primary text-primary-foreground"
                            : "bg-muted/60 text-foreground border border-border/60")
                        }
                        style={isTouchLike ? { transform: `translateX(${swipeX}px)` } : undefined}
                        onTouchStart={(e) => {
                          if (!isTouchLike) return;
                          if (m.is_deleted) return;
                          const t = e.touches[0];
                          swipeStartRef.current = { id: m.id, x: t.clientX, y: t.clientY, active: false };
                        }}
                        onTouchMove={(e) => {
                          if (!isTouchLike) return;
                          if (m.is_deleted) return;
                          const start = swipeStartRef.current;
                          if (!start || start.id !== m.id) return;

                          const t = e.touches[0];
                          const dx = t.clientX - start.x;
                          const dy = t.clientY - start.y;

                          if (!start.active) {
                            if (Math.abs(dx) < 8) return;
                            if (Math.abs(dy) > Math.abs(dx)) return;
                            start.active = true;
                          }

                          e.preventDefault();

                          const clamped = clamp(dx, 0, 72);
                          setSwipeXById((prev) => ({ ...prev, [m.id]: clamped }));
                        }}
                        onTouchEnd={() => {
                          if (!isTouchLike) return;
                          const start = swipeStartRef.current;
                          swipeStartRef.current = null;

                          const finalX = swipeXById[m.id] || 0;
                          setSwipeXById((prev) => {
                            const next = { ...prev };
                            delete next[m.id];
                            return next;
                          });

                          if (start?.active && finalX >= 48) {
                            beginReply(m);
                          }
                        }}
                      >
                        {replyTarget && !m.is_deleted && (
                          <div
                            className={`mb-2 rounded-xl px-3 py-2 text-xs ${
                              mine ? "bg-primary-foreground/10" : "bg-background/40"
                            }`}
                          >
                            <div className={`font-semibold ${mine ? "text-primary-foreground/90" : "text-foreground"}`}>
                              Replying to
                            </div>
                            <div className={`truncate ${mine ? "text-primary-foreground/80" : "text-muted-foreground"}`}>
                              {replyTarget.is_deleted ? "Message deleted" : replyTarget.content}
                            </div>
                          </div>
                        )}

                        {m.is_deleted ? <span className="opacity-60 italic">Message deleted</span> : m.content}

                        <div
                          className={`text-[10px] mt-1 flex items-center gap-2 ${
                            mine ? "text-primary-foreground/70" : "text-muted-foreground"
                          }`}
                        >
                          <span>
                            {new Date(m.created_at).toLocaleTimeString([], {
                              hour: "numeric",
                              minute: "2-digit",
                              hour12: true,
                            })}
                          </span>
                          {m.edited_at && !m.is_deleted && <span className="opacity-80">• edited</span>}
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })
          )}
          <div ref={endRef} />
        </div>

  <div id="chat-composer" className="p-4 sm:p-4 border-t border-border/60 bg-background/40">
          {(replyTo || editingMsg) && (
            <div className="mb-3 flex items-start justify-between gap-3 rounded-2xl border border-border/60 bg-card/40 px-3 py-2">
              <div className="min-w-0">
                <p className="text-xs font-semibold text-foreground">{editingMsg ? "Editing message" : "Replying"}</p>
                <p className="text-xs text-muted-foreground truncate">{editingMsg ? editingMsg.content : replyTo?.content}</p>
              </div>
              <Button
                variant="ghost"
                size="icon"
                onClick={() => {
                  setReplyTo(null);
                  setEditingMsg(null);
                }}
                title="Cancel"
              >
                <X className="w-4 h-4" />
              </Button>
            </div>
          )}

          <div className="flex gap-3 sm:gap-2 items-center">
            <Textarea
              value={text}
              onChange={(e) => {
                setText(e.target.value);
                setTyping(true);
                if (typingTimerRef.current) window.clearTimeout(typingTimerRef.current);
                typingTimerRef.current = window.setTimeout(() => setTyping(false), 1200);
              }}
              placeholder={editingMsg ? "Edit message…" : "Message…"}
              className="h-12 sm:h-11 min-h-0 max-h-40 resize-none rounded-2xl px-4 py-0 text-[15px] sm:text-sm leading-[44px] sm:leading-[40px]"
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  send();
                }
              }}
            />
            <Button
              onClick={send}
              disabled={sending || !text.trim()}
              className="rounded-2xl h-12 sm:h-11 px-6 sm:px-5"
            >
              {editingMsg ? (
                <>
                  <Check className="w-4 h-4 mr-2" /> Save
                </>
              ) : (
                <>
                  <Send className="w-4 h-4 mr-2" /> Send
                </>
              )}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
