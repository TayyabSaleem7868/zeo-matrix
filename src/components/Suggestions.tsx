import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { UserPlus, UserMinus, Users } from "lucide-react";
import { Link } from "react-router-dom";
import { useToast } from "@/hooks/use-toast";

interface SuggestionProfile {
    user_id: string;
    username: string;
    display_name: string | null;
    avatar_url: string | null;
}

const Suggestions = () => {
    const { user } = useAuth();
    const { toast } = useToast();
    const [suggestions, setSuggestions] = useState<SuggestionProfile[]>([]);
    const [followingIds, setFollowingIds] = useState<Set<string>>(new Set());
    const [loading, setLoading] = useState(true);

    const fetchData = async () => {
        if (!user) return;
        setLoading(true);

        try {
            // 1. Fetch people I already follow
            const { data: follows } = await supabase
                .from("follows")
                .select("following_id")
                .eq("follower_id", user.id);

            const followedSet = new Set(follows?.map(f => f.following_id) || []);
            setFollowingIds(followedSet);

            // 2. Fetch recent profiles (limit 5) excluding current user
            const { data: profiles } = await supabase
                .from("profiles")
                .select("user_id, username, display_name, avatar_url")
                .neq("user_id", user.id)
                .order("created_at", { ascending: false })
                .limit(10);

            // Filter out people already followed and limit to 5
            const filtered = (profiles || [])
                .filter(p => !followedSet.has(p.user_id))
                .slice(0, 5);

            setSuggestions(filtered);
        } catch (error) {
            console.error("Error fetching suggestions:", error);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchData();
    }, [user]);

    const toggleFollow = async (targetUserId: string) => {
        if (!user) return;

        const isFollowing = followingIds.has(targetUserId);

        if (isFollowing) {
            const { error } = await supabase
                .from("follows")
                .delete()
                .eq("follower_id", user.id)
                .eq("following_id", targetUserId);

            if (!error) {
                const newSet = new Set(followingIds);
                newSet.delete(targetUserId);
                setFollowingIds(newSet);
                toast({ title: "Unfollowed", description: "User removed from your feed" });
            }
        } else {
            const { error } = await supabase
                .from("follows")
                .insert({ follower_id: user.id, following_id: targetUserId });

            if (!error) {
                const newSet = new Set(followingIds);
                newSet.add(targetUserId);
                setFollowingIds(newSet);
                toast({ title: "Following", description: "You are now following this user" });
            }
        }
    };

    if (loading && suggestions.length === 0) return null;
    if (!loading && suggestions.length === 0) return null;

    return (
        <div className="bg-card/50 backdrop-blur-md border border-border rounded-3xl p-5 sticky top-24">
            <div className="flex items-center gap-2 mb-6 ml-1">
                <Users className="w-5 h-5 text-primary" />
                <h3 className="text-lg font-display font-bold text-foreground">Suggestions</h3>
            </div>

            <div className="space-y-4">
                {suggestions.map((profile) => (
                    <div
                        key={profile.user_id}
                        className="flex items-center justify-between group p-2 hover:bg-muted/30 rounded-2xl transition-all duration-300"
                    >
                        <Link to={`/profile/${profile.user_id}`} className="flex items-center gap-3 min-w-0 flex-1">
                            <div className="w-12 h-12 rounded-full gradient-bg flex-shrink-0 flex items-center justify-center overflow-hidden border-2 border-primary/20 group-hover:border-primary transition-colors">
                                {profile.avatar_url ? (
                                    <img src={profile.avatar_url} alt="" className="w-full h-full object-cover" />
                                ) : (
                                    <span className="text-primary-foreground font-display font-bold text-sm">
                                        {(profile.display_name || profile.username || "?")[0].toUpperCase()}
                                    </span>
                                )}
                            </div>
                            <div className="min-w-0">
                                <p className="font-display font-bold text-foreground truncate text-[14px]">
                                    {profile.display_name || profile.username}
                                </p>
                                <p className="text-[12px] text-muted-foreground truncate">
                                    @{profile.username}
                                </p>
                            </div>
                        </Link>

                        <button
                            onClick={() => toggleFollow(profile.user_id)}
                            className={`w-10 h-10 rounded-full flex items-center justify-center transition-all duration-300 ${followingIds.has(profile.user_id)
                                    ? "bg-muted text-muted-foreground hover:bg-destructive hover:text-destructive-foreground"
                                    : "gradient-bg text-white shadow-lg shadow-primary/20 hover:scale-110 active:scale-95"
                                }`}
                        >
                            {followingIds.has(profile.user_id) ? <UserMinus className="w-5 h-5" /> : <UserPlus className="w-5 h-5" />}
                        </button>
                    </div>
                ))}
            </div>
        </div>
    );
};

export default Suggestions;
