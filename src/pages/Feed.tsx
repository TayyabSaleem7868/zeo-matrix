import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import CreatePost from "@/components/CreatePost";
import PostCard from "@/components/PostCard";
import { useToast } from "@/hooks/use-toast";

interface PostWithProfile {
  id: string;
  user_id: string;
  content: string;
  image_url: string;
  created_at: string;
  profile: { username: string; display_name: string | null; avatar_url: string | null } | null;
  likeCount: number;
  isLiked: boolean;
}

const Feed = () => {
  const { user } = useAuth();
  const { toast } = useToast();
  const [posts, setPosts] = useState<PostWithProfile[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchPosts = useCallback(async () => {
    try {
      const { data, error } = await supabase
        .from("posts")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(50);

      if (error) throw error;

      if (data) {
        const postIds = data.map((p) => p.id);
        const userIds = [...new Set(data.map((p) => p.user_id))];

        const [profilesRes, likesRes] = await Promise.all([
          (supabase.from("profiles").select("user_id, username, display_name, avatar_url, is_verified") as any).in("user_id", userIds),
          supabase.from("likes").select("post_id, user_id").in("post_id", postIds)
        ]);

        const profileMap = new Map(profilesRes.data?.map((p) => [p.user_id, p]));
        const likeCountsMap = new Map();
        const userLikesSet = new Set();

        likesRes.data?.forEach(like => {
          likeCountsMap.set(like.post_id, (likeCountsMap.get(like.post_id) || 0) + 1);
          if (user && like.user_id === user.id) {
            userLikesSet.add(like.post_id);
          }
        });

        setPosts(data.map((p) => ({
          ...p,
          profile: profileMap.get(p.user_id) || null,
          likeCount: likeCountsMap.get(p.id) || 0,
          isLiked: userLikesSet.has(p.id)
        })));
      }
    } catch (error) {
      console.error("Error fetching posts:", error);
      toast({ title: "Error", description: "Failed to load posts", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  }, [user, toast]);

  useEffect(() => {
    fetchPosts();

    const channel = supabase
      .channel("posts-realtime")
      .on("postgres_changes", { event: "*", schema: "public", table: "posts" }, () => {
        fetchPosts();
      })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [fetchPosts]);

  return (
    <div className="max-w-2xl mx-auto px-4 py-8">
      <div className="mb-10">
        <h1 className="text-3xl font-display font-bold text-foreground mb-2">Home Feed</h1>
        <p className="text-muted-foreground">Discover what's happening in your network.</p>
      </div>

      <div className="space-y-8">
        <CreatePost onPostCreated={fetchPosts} />

        <div className="space-y-6">
          {loading ? (
            <div className="flex justify-center py-20">
              <div className="w-8 h-8 rounded-full border-2 border-primary border-t-transparent animate-spin" />
            </div>
          ) : posts.length === 0 ? (
            <div className="text-center py-20 bg-card/30 rounded-3xl border border-dashed border-border/50">
              <p className="font-display text-lg text-muted-foreground">No posts yet</p>
              <p className="text-sm text-muted-foreground/60 mt-1">Be the first to share something!</p>
            </div>
          ) : (
            posts.map((post) => (
              <PostCard
                key={post.id}
                post={post}
                profile={post.profile}
                onDelete={fetchPosts}
                initialLiked={post.isLiked}
                initialLikeCount={post.likeCount}
              />
            ))
          )}
        </div>
      </div>
    </div>
  );
};

export default Feed;
