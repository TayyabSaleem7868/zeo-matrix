import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { MessageCircle, Search } from "lucide-react";

type ConversationRow = {
  id: string;
  updated_at: string;
  last_message_at: string | null;
};

type MemberRow = {
  conversation_id: string;
  user_id: string;
};

type Profile = {
  user_id: string;
  username: string;
  display_name: string | null;
  avatar_url: string | null;
  is_verified?: boolean | null;
};

type MessageRow = {
  id: string;
  conversation_id: string;
  sender_id: string | null;
  content: string;
  created_at: string;
};

type ThreadItem = {
  conversationId: string;
  other: Profile;
  lastMessage: MessageRow | null;
  updatedAt: string;
};

export default function Inbox() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [q, setQ] = useState("");
  const [threads, setThreads] = useState<ThreadItem[]>([]);
  const [loading, setLoading] = useState(true);

  const filtered = useMemo(() => {
    const query = q.trim().toLowerCase();
    if (!query) return threads;
    return threads.filter((t) => {
      const name = (t.other.display_name || t.other.username || "").toLowerCase();
      const usern = (t.other.username || "").toLowerCase();
      return name.includes(query) || usern.includes(query);
    });
  }, [threads, q]);

  const loadInbox = async () => {
    if (!user) return;
    setLoading(true);
    try {
      const { data: mems, error: memErr } = await supabase
        .from("conversation_members")
        .select("conversation_id, user_id")
        .eq("user_id", user.id);
      if (memErr) throw memErr;

      const conversationIds = [...new Set((mems || []).map((m: MemberRow) => m.conversation_id))];
      if (conversationIds.length === 0) {
        setThreads([]);
        return;
      }

      const { data: convs, error: convErr } = await supabase
        .from("conversations")
        .select("id, updated_at, last_message_at")
        .in("id", conversationIds)
        .order("updated_at", { ascending: false });
      if (convErr) throw convErr;

      const { data: allMembers, error: amErr } = await supabase
        .from("conversation_members")
        .select("conversation_id, user_id")
        .in("conversation_id", conversationIds);
      if (amErr) throw amErr;

      const otherIds = [...new Set(
        (allMembers || [])
          .filter((m: MemberRow) => m.user_id !== user.id)
          .map((m: MemberRow) => m.user_id)
      )];

      const { data: profs, error: pErr } = await (supabase
        .from("profiles")
        .select("user_id, username, display_name, avatar_url, is_verified") as any)
        .in("user_id", otherIds);
      if (pErr) throw pErr;

      const profMap = new Map<string, Profile>();
      (profs || []).forEach((p: Profile) => profMap.set(p.user_id, p));

      const { data: msgs, error: msgErr } = await supabase
        .from("messages")
        .select("id, conversation_id, sender_id, content, created_at")
        .in("conversation_id", conversationIds)
        .order("created_at", { ascending: false })
        .limit(200);
      if (msgErr) throw msgErr;

      const lastByConv = new Map<string, MessageRow>();
      (msgs || []).forEach((m: any) => {
        if (!lastByConv.has(m.conversation_id)) lastByConv.set(m.conversation_id, m as MessageRow);
      });

      const items: ThreadItem[] = (convs || []).flatMap((c: any) => {
        const otherId = (allMembers || []).find((m: MemberRow) => m.conversation_id === c.id && m.user_id !== user.id)?.user_id;
        if (!otherId) return [];
        const other = profMap.get(otherId);
        if (!other) return [];
        return [{
          conversationId: c.id,
          other,
          lastMessage: lastByConv.get(c.id) || null,
          updatedAt: c.last_message_at || c.updated_at,
        }];
      });

      setThreads(items.sort((a, b) => (new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime())));
    } catch (e: any) {
      console.error(e);
      toast({ title: "Inbox error", description: e?.message || "Failed to load inbox", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadInbox();
  }, [user?.id]);

  useEffect(() => {
    if (!user) return;

    const channel = supabase
      .channel(`inbox-${user.id}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "messages" },
        () => loadInbox()
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "conversation_members", filter: `user_id=eq.${user.id}` },
        () => loadInbox()
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user?.id]);

  return (
    <div className="max-w-2xl mx-auto px-4 py-6">
      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3 sm:gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-display font-bold text-foreground flex items-center gap-2">
            <MessageCircle className="w-6 h-6" /> Inbox
          </h1>
          <p className="text-sm text-muted-foreground mt-1">Your direct messages</p>
        </div>
        <Button asChild variant="outline" size="sm" className="w-full sm:w-auto">
          <Link to="/search">New chat</Link>
        </Button>
      </div>

      <div className="relative mb-4">
        <Search className="w-4 h-4 text-muted-foreground absolute left-3 top-1/2 -translate-y-1/2" />
        <Input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Search messages"
          className="pl-9 rounded-2xl"
        />
      </div>

      {loading ? (
        <div className="flex justify-center py-20">
          <div className="w-8 h-8 rounded-full border-2 border-primary border-t-transparent animate-spin" />
        </div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-20 bg-card/30 rounded-3xl border border-dashed border-border/50">
          <p className="font-display text-lg text-muted-foreground">No conversations yet</p>
          <p className="text-sm text-muted-foreground/60 mt-1">Start a new chat from search.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map((t) => (
            <Link
              key={t.conversationId}
              to={`/inbox/${t.conversationId}`}
              className="block p-5 sm:p-4 rounded-2xl border bg-card border-border hover:border-primary/30 transition-all"
            >
              <div className="flex items-start sm:items-center gap-4 sm:gap-3">
                <div className="w-14 h-14 sm:w-12 sm:h-12 rounded-full overflow-hidden border border-white/10 flex-shrink-0">
                  {t.other.avatar_url ? (
                    <img src={t.other.avatar_url} alt="" className="w-full h-full object-cover" />
                  ) : (
                    <div className="w-full h-full gradient-bg flex items-center justify-center">
                      <span className="text-[12px] font-bold text-white">
                        {(t.other.display_name || t.other.username || "?")[0].toUpperCase()}
                      </span>
                    </div>
                  )}
                </div>

                <div className="min-w-0 flex-1">
                  <p className="text-base sm:text-sm font-semibold text-foreground leading-snug truncate">
                    {t.other.display_name || t.other.username}
                    <span className="text-xs text-muted-foreground ml-2 hidden sm:inline">@{t.other.username}</span>
                  </p>
                  <p className="text-sm sm:text-sm text-muted-foreground leading-relaxed mt-1 overflow-hidden text-ellipsis">
                    {t.lastMessage ? t.lastMessage.content : "Say hi 👋"}
                  </p>
                </div>

                <p className="text-xs text-muted-foreground flex-shrink-0 hidden sm:block">
                  {new Date(t.updatedAt).toLocaleDateString()}
                </p>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
