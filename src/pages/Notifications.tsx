import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { Link } from "react-router-dom";
import { Bell, CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";

type NotificationRow = {
  id: string;
  user_id: string;
  actor_id: string | null;
  type: "like" | "comment" | "reply" | "follow" | "follow_request" | "follow_request_accepted" | string;
  post_id: string | null;
  follow_request_id: string | null;
  is_read: boolean;
  created_at: string;
};

type ActorProfile = {
  user_id: string;
  username: string;
  display_name: string | null;
  avatar_url: string | null;
  is_verified?: boolean | null;
};

const formatText = (n: NotificationRow, actor?: ActorProfile | null) => {
  const name = actor?.display_name || actor?.username || "Someone";
  switch (n.type) {
    case "admin_post_deleted":
      return n.message ? `Your post was removed: ${n.message}` : "Your post was removed by an admin";
    case "tag":
      return `${name} tagged you in their post`;
    case "like":
      return `${name} liked your post`;
    case "comment":
      return `${name} commented on your post`;
    case "reply":
      return `${name} replied to your comment`;
    case "follow":
      return `${name} started following you`;
    case "follow_request":
      return `${name} requested to follow you`;
    case "follow_request_accepted":
      return `${name} accepted your follow request`;
    default:
      return `${name} sent you a notification`;
  }
};

export default function Notifications() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [items, setItems] = useState<NotificationRow[]>([]);
  const [actors, setActors] = useState<Map<string, ActorProfile>>(new Map());
  const [loading, setLoading] = useState(true);
  const [debugMe, setDebugMe] = useState<{ userId: string; latestTagForMe: number } | null>(null);

  const unreadCount = useMemo(() => items.filter((i) => !i.is_read).length, [items]);

  const fetchAll = async () => {
    if (!user) return;
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from("notifications")
        .select("id, user_id, actor_id, type, post_id, follow_request_id, is_read, created_at")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false })
        .limit(50);

      if (error) throw error;
      const rows = (data || []) as NotificationRow[];
      setItems(rows);

      try {
        const { count: tagCount } = await supabase
          .from("notifications")
          .select("id", { count: "exact", head: true })
          .eq("user_id", user.id)
          .eq("type", "tag");
        setDebugMe({ userId: user.id, latestTagForMe: tagCount || 0 });
      } catch {
        setDebugMe(null);
      }

      const actorIds = [...new Set(rows.map((r) => r.actor_id).filter(Boolean) as string[])];
      if (actorIds.length) {
        const { data: profs, error: pErr } = await (supabase
          .from("profiles")
          .select("user_id, username, display_name, avatar_url, is_verified") as any).in("user_id", actorIds);

        if (pErr) throw pErr;
        const map = new Map<string, ActorProfile>();
        (profs || []).forEach((p: ActorProfile) => map.set(p.user_id, p));
        setActors(map);
      } else {
        setActors(new Map());
      }
    } catch (e: any) {
      console.error(e);
      toast({ title: "Error", description: e?.message || "Failed to load notifications", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAll();

    if (!user) return;
    const channel = supabase
      .channel(`notifications-${user.id}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "notifications", filter: `user_id=eq.${user.id}` },
        () => fetchAll()
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };

  }, [user?.id]);

  const markAllRead = async () => {
    if (!user) return;
    try {
      const { error } = await supabase
        .from("notifications")
        .update({ is_read: true })
        .eq("user_id", user.id)
        .eq("is_read", false);
      if (error) throw error;
      await fetchAll();
    } catch (e: any) {
      toast({ title: "Error", description: e?.message || "Failed to mark read", variant: "destructive" });
    }
  };

  const markOneRead = async (id: string) => {
    try {
      const { error } = await supabase.from("notifications").update({ is_read: true }).eq("id", id);
      if (error) throw error;
      setItems((prev) => prev.map((p) => (p.id === id ? { ...p, is_read: true } : p)));
    } catch {

    }
  };

  return (
    <div className="max-w-2xl mx-auto px-4 py-6">
      <div className="flex items-start justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-display font-bold text-foreground flex items-center gap-2">
            <Bell className="w-6 h-6" /> Notifications
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            {unreadCount > 0 ? `${unreadCount} unread` : "All caught up"}
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={markAllRead} disabled={unreadCount === 0}>
          <CheckCircle2 className="w-4 h-4 mr-2" /> Mark all read
        </Button>
      </div>

      {loading ? (
        <div className="flex justify-center py-20">
          <div className="w-8 h-8 rounded-full border-2 border-primary border-t-transparent animate-spin" />
        </div>
      ) : items.length === 0 ? (
        <div className="text-center py-20 bg-card/30 rounded-3xl border border-dashed border-border/50">
          <p className="font-display text-lg text-muted-foreground">No notifications yet</p>
          <p className="text-sm text-muted-foreground/60 mt-1">Likes, comments, follows will show up here.</p>
          {debugMe && (
            <p className="text-xs text-muted-foreground/60 mt-4">
              Debug: user_id={debugMe.userId.slice(0, 8)}… • tag_for_me={debugMe.latestTagForMe}
            </p>
          )}
        </div>
      ) : (
        <div className="space-y-3">
          {items.map((n) => {
            const actor = n.actor_id ? actors.get(n.actor_id) : null;
            const to = n.post_id ? `/post/${n.post_id}` : actor?.user_id ? `/profile/${actor.user_id}` : "#";
            return (
              <Link
                key={n.id}
                to={to}
                onClick={() => markOneRead(n.id)}
                className={`block p-4 rounded-2xl border transition-all ${
                  n.is_read
                    ? "bg-card border-border hover:border-primary/30"
                    : "bg-primary/10 border-primary/30 hover:bg-primary/15"
                }`}
              >
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full overflow-hidden border border-white/10 flex-shrink-0">
                    {actor?.avatar_url ? (
                      <img src={actor.avatar_url} alt="" className="w-full h-full object-cover" />
                    ) : (
                      <div className="w-full h-full gradient-bg flex items-center justify-center">
                        <span className="text-[11px] font-bold text-white">
                          {(actor?.display_name || actor?.username || "?")[0].toUpperCase()}
                        </span>
                      </div>
                    )}
                  </div>

                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium text-foreground truncate">{formatText(n, actor)}</p>
                    <p className="text-xs text-muted-foreground mt-1">{new Date(n.created_at).toLocaleString()}</p>
                  </div>

                  {!n.is_read && <span className="w-2 h-2 rounded-full bg-primary flex-shrink-0" />}
                </div>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
