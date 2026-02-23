import { useEffect, useMemo, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import CreatePost from "@/components/CreatePost";
import PostCard from "@/components/PostCard";
import { useToast } from "@/hooks/use-toast";
import { useInfiniteQuery, useQueryClient } from "@tanstack/react-query";

interface PostWithProfile {
  id: string;
  user_id: string;
  content: string;
  image_url: string;
  media?: any;
  created_at: string;
  profile: { username: string; display_name: string | null; avatar_url: string | null; is_verified?: boolean } | null;
  likeCount: number;
  isLiked: boolean;
}

type FeedRow = {
  id: string;
  user_id: string;
  content: string;
  image_url: string | null;
  media: any;
  created_at: string;
  username: string;
  display_name: string | null;
  avatar_url: string | null;
  is_verified: boolean;
};

const Feed = () => {
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const loadMoreRef = useRef<HTMLDivElement | null>(null);

  const pageSize = 15;

  const fetchPage = async (cursor?: { created_at: string; id: string } | null) => {
    if (!user) return { rows: [] as PostWithProfile[], nextCursor: null as any };
    const { data, error } = await (supabase as any).rpc("get_feed_page", {
      p_limit: pageSize,
      p_cursor_created_at: cursor?.created_at ?? null,
      p_cursor_id: cursor?.id ?? null,
    });

    if (error) throw error;
    const rows = (data || []) as FeedRow[];

    const postIds = rows.map((r) => r.id);
    const { data: likes } = await supabase.from("likes").select("post_id, user_id").in("post_id", postIds);

    const likeCountsMap = new Map<string, number>();
    const userLikesSet = new Set<string>();

    likes?.forEach((l: any) => {
      likeCountsMap.set(l.post_id, (likeCountsMap.get(l.post_id) || 0) + 1);
      if (user && l.user_id === user.id) userLikesSet.add(l.post_id);
    });

    const posts: PostWithProfile[] = rows.map((r) => ({
      id: r.id,
      user_id: r.user_id,
      content: r.content,
      image_url: (r.image_url as any) || "",
      media: r.media,
      created_at: r.created_at,
      profile: {
        username: r.username,
        display_name: r.display_name,
        avatar_url: r.avatar_url,
        is_verified: r.is_verified,
      },
      likeCount: likeCountsMap.get(r.id) || 0,
      isLiked: userLikesSet.has(r.id),
    }));

    const last = rows[rows.length - 1];
    return {
      rows: posts,
      nextCursor: last ? { created_at: last.created_at, id: last.id } : null,
    };
  };

  const {
    data,
    isLoading,
    isFetchingNextPage,
    hasNextPage,
    fetchNextPage,
    refetch,
    error,
  } = useInfiniteQuery({
    queryKey: ["feed"],
    queryFn: ({ pageParam }) => fetchPage(pageParam ?? null),
    initialPageParam: null as any,
    getNextPageParam: (lastPage) => lastPage.nextCursor,
    enabled: !!user,
    staleTime: 10_000,
  });

  const posts = useMemo(() => data?.pages.flatMap((p) => p.rows) ?? [], [data]);

  useEffect(() => {
    if (!error) return;
    console.error("Error fetching feed:", error);
    toast({ title: "Error", description: "Failed to load feed", variant: "destructive" });
  }, [error, toast]);

  useEffect(() => {
    if (!hasNextPage) return;
    const el = loadMoreRef.current;
    if (!el) return;

    const obs = new IntersectionObserver(
      (entries) => {
        const first = entries[0];
        if (first.isIntersecting && !isFetchingNextPage) {
          fetchNextPage();
        }
      },
      { rootMargin: "600px" }
    );

    obs.observe(el);
    return () => obs.disconnect();
  }, [fetchNextPage, hasNextPage, isFetchingNextPage]);
  useEffect(() => {
    const channel = supabase
      .channel("posts-realtime")
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "posts" }, () => {
        queryClient.invalidateQueries({ queryKey: ["feed"] });
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [queryClient]);

  return (
    <div className="max-w-2xl mx-auto px-4 py-8">
      <div className="mb-10">
        <h1 className="text-3xl font-display font-bold text-foreground mb-2">Home Feed</h1>
        <p className="text-muted-foreground">Discover what's happening in your network.</p>
      </div>

      <div className="space-y-8">
        <CreatePost onPostCreated={() => refetch()} />

        <div className="space-y-6">
          {isLoading ? (
            <div className="flex justify-center py-20">
              <div className="w-8 h-8 rounded-full border-2 border-primary border-t-transparent animate-spin" />
            </div>
          ) : posts.length === 0 ? (
            <div className="text-center py-20 bg-card/30 rounded-3xl border border-dashed border-border/50">
              <p className="font-display text-lg text-muted-foreground">No posts yet</p>
              <p className="text-sm text-muted-foreground/60 mt-1">Be the first to share something!</p>
            </div>
          ) : (
            <>
              {posts.map((post) => (
                <PostCard
                  key={post.id}
                  post={post}
                  profile={post.profile}
                  onDelete={() => refetch()}
                  initialLiked={post.isLiked}
                  initialLikeCount={post.likeCount}
                />
              ))}
              <div ref={loadMoreRef} className="h-8" />
              {isFetchingNextPage && (
                <div className="flex justify-center py-6">
                  <div className="w-6 h-6 rounded-full border-2 border-primary border-t-transparent animate-spin" />
                </div>
              )}
              {!hasNextPage && posts.length > 0 && (
                <p className="text-center py-8 text-muted-foreground text-sm">You’re all caught up.</p>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
};

export default Feed;
