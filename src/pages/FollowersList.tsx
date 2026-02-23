import { useEffect, useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { Input } from "@/components/ui/input";
import { Users } from "lucide-react";

type ProfileRow = {
  user_id: string;
  username: string;
  display_name: string | null;
  avatar_url: string | null;
  is_verified?: boolean | null;
  is_private?: boolean | null;
};

export default function FollowersList() {
  const { userId } = useParams();
  const { user } = useAuth();
  const { toast } = useToast();
  const [owner, setOwner] = useState<ProfileRow | null>(null);
  const [rows, setRows] = useState<ProfileRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState("");

  const filtered = useMemo(() => {
    const s = q.trim().toLowerCase();
    if (!s) return rows;
    return rows.filter(
      (p) =>
        p.username.toLowerCase().includes(s) ||
        (p.display_name || "").toLowerCase().includes(s)
    );
  }, [q, rows]);

  const canView = useMemo(() => {
    if (!owner) return true;
    if (!owner.is_private) return true;
    if (user?.id === owner.user_id) return true;
    return false;
  }, [owner, user?.id]);

  useEffect(() => {
    const run = async () => {
      if (!userId) return;
      setLoading(true);
      try {
        const { data: ownerProfile, error: oErr } = await supabase
          .from("profiles")
          .select("user_id, username, display_name, avatar_url, is_verified, is_private")
          .eq("user_id", userId)
          .maybeSingle();
        if (oErr) throw oErr;
        setOwner((ownerProfile || null) as any);

        const { data: followerRows, error } = await supabase
          .from("follows")
          .select("follower_id")
          .eq("following_id", userId)
          .order("created_at", { ascending: false })
          .limit(200);
        if (error) throw error;

        const followerIds = [...new Set((followerRows || []).map((r: any) => r.follower_id))];
        if (!followerIds.length) {
          setRows([]);
          return;
        }

        const { data: profiles, error: pErr } = await (supabase
          .from("profiles")
          .select("user_id, username, display_name, avatar_url, is_verified, is_private") as any).in("user_id", followerIds);
        if (pErr) throw pErr;

        const map = new Map((profiles || []).map((p: any) => [p.user_id, p]));
        setRows(followerIds.map((id) => map.get(id)).filter(Boolean));
      } catch (e: any) {
        console.error(e);
        toast({ title: "Error", description: e?.message || "Failed to load followers", variant: "destructive" });
      } finally {
        setLoading(false);
      }
    };
    run();
  }, [toast, userId]);

  if (!canView) {
    return (
      <div className="max-w-2xl mx-auto px-4 py-10">
        <div className="bg-card/40 border border-border rounded-3xl p-6 text-center">
          <h2 className="text-xl font-display font-bold text-foreground">Private account</h2>
          <p className="text-sm text-muted-foreground mt-2">Followers list is hidden.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto px-4 py-6">
      <div className="flex items-start justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-display font-bold text-foreground flex items-center gap-2">
            <Users className="w-6 h-6" /> Followers
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            {owner ? `@${owner.username}` : ""}
          </p>
        </div>
        <div className="w-[220px]">
          <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search followers..." />
        </div>
      </div>

      {loading ? (
        <div className="flex justify-center py-20">
          <div className="w-8 h-8 rounded-full border-2 border-primary border-t-transparent animate-spin" />
        </div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-20 bg-card/30 rounded-3xl border border-dashed border-border/50">
          <p className="font-display text-lg text-muted-foreground">No followers</p>
        </div>
      ) : (
        <div className="space-y-2">
          {filtered.map((p) => (
            <Link
              key={p.user_id}
              to={`/profile/${p.user_id}`}
              className="flex items-center gap-3 p-3 rounded-2xl bg-card border border-border hover:border-primary/30 transition-all"
            >
              <div className="w-10 h-10 rounded-full gradient-bg overflow-hidden flex items-center justify-center flex-shrink-0">
                {p.avatar_url ? (
                  <img src={p.avatar_url} alt="" className="w-full h-full object-cover" />
                ) : (
                  <span className="text-primary-foreground font-display font-bold text-sm">
                    {(p.display_name || p.username || "?")[0].toUpperCase()}
                  </span>
                )}
              </div>
              <div className="min-w-0">
                <p className="font-display font-medium text-foreground text-sm truncate">{p.display_name || p.username}</p>
                <p className="text-xs text-muted-foreground truncate">@{p.username}</p>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
