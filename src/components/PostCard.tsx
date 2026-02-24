import { useState, useEffect, useRef } from "react";
import { Heart, Trash2, MessageCircle, ChevronLeft, ChevronRight, Maximize2, MonitorPlay, Share2 } from "lucide-react";
import { VerifiedBadge } from "@/components/VerifiedBadge";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Link } from "react-router-dom";
import { formatDistanceToNow } from "date-fns";
import { useToast } from "@/hooks/use-toast";
import CommentSection from "./CommentSection";
import { formatNumber } from "@/lib/utils";
import MediaViewer from "./MediaViewer";
import { Button } from "@/components/ui/button";
import ShareDialog from "./ShareDialog";
import useEmblaCarousel from "embla-carousel-react";
import VideoPlayer from "./VideoPlayer";
import { useLowEndDevice } from "@/hooks/useLowEndDevice";
import { buildMentionMap, extractMentionUsernames, renderContentWithMentions } from "@/lib/mentions";
import { useQueryClient } from "@tanstack/react-query";

interface PostCardProps {
  post: {
    id: string;
    user_id: string;
    content: string;
    image_url: string;
    media?: { url: string; type: "image" | "video" | "pdf" | "doc" | "docx" | "zip" | "rar" | "other"; name?: string }[];
    created_at: string;
  };
  profile: {
    username: string;
    display_name: string | null;
    avatar_url: string | null;
    is_verified?: boolean;
  } | null;
  onDelete?: () => void;
  initialLiked?: boolean;
  initialLikeCount?: number;
}

const PostCard = ({ post, profile, onDelete, initialLiked = false, initialLikeCount = 0 }: PostCardProps) => {
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [liked, setLiked] = useState(initialLiked);
  const [likeCount, setLikeCount] = useState(initialLikeCount);
  const likeInFlightRef = useRef(false);
  const [showComments, setShowComments] = useState(false);
  const [commentCount, setCommentCount] = useState(0);
  const [isViewerOpen, setIsViewerOpen] = useState(false);
  const [activeMediaIndex, setActiveMediaIndex] = useState(0);
  const [isShareOpen, setIsShareOpen] = useState(false);

  const { isLowEnd } = useLowEndDevice();


  const mediaItems = post.media || (post.image_url ? [{ url: post.image_url, type: "image" }] : []);

  const [emblaRef, emblaApi] = useEmblaCarousel(
    isLowEnd
      ? { loop: false, duration: 22, skipSnaps: false }
      : { loop: true, duration: 30, skipSnaps: false },
  );

  useEffect(() => {
    if (!emblaApi) return;
    emblaApi.on("select", () => {
      setActiveMediaIndex(emblaApi.selectedScrollSnap());
    });
  }, [emblaApi]);

  const handleNext = (e: React.MouseEvent) => {
    e.stopPropagation();
    emblaApi?.scrollNext();
  };

  const handlePrev = (e: React.MouseEvent) => {
    e.stopPropagation();
    emblaApi?.scrollPrev();
  };

  const fetchCommentCount = async () => {
    const { count, error } = await (supabase
      .from("comments" as any) as any)
      .select("*", { count: "exact", head: true })
      .eq("post_id", post.id);

    if (!error) {
      setCommentCount(count || 0);
    }
  };

  useEffect(() => {
    setLiked(initialLiked);
    setLikeCount(initialLikeCount);
  }, [initialLiked, initialLikeCount]);

  useEffect(() => {
    fetchCommentCount();

    const channel = (supabase as any)
      .channel(`comment-count-${post.id}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "comments", filter: `post_id=eq.${post.id}` },
        () => {
          fetchCommentCount();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [post.id]);

  const toggleLike = async () => {
    if (!user) {
      toast({ title: "Login required", description: "Please login to like posts.", variant: "destructive" });
      return;
    }

    // Prevent rapid double taps from racing the UNIQUE(user_id, post_id) constraint.
    if (likeInFlightRef.current) return;
    likeInFlightRef.current = true;

    const prevLiked = liked;
    const prevCount = likeCount;

    // Optimistic UI update.
    if (prevLiked) {
      setLiked(false);
      setLikeCount((c) => Math.max(0, c - 1));
    } else {
      setLiked(true);
      setLikeCount((c) => c + 1);
    }

    try {
      if (prevLiked) {
        const { error } = await supabase.from("likes").delete().eq("post_id", post.id).eq("user_id", user.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("likes").insert({ user_id: user.id, post_id: post.id });
        if (error) throw error;
      }

      // Ensure a refresh doesn't revert the optimistic state due to stale cached pages.
      await queryClient.invalidateQueries({ queryKey: ["feed"] });
      await queryClient.invalidateQueries({ queryKey: ["profile-posts"] });
      await queryClient.invalidateQueries({ queryKey: ["post", post.id] });
    } catch (e: any) {
      console.error("Failed to toggle like", e);
      setLiked(prevLiked);
      setLikeCount(prevCount);
      toast({
        title: "Couldn't update like",
        description: e?.message || "Please try again.",
        variant: "destructive",
      });
    } finally {
      likeInFlightRef.current = false;
    }
  };

  const handleDelete = async () => {
    await supabase.from("posts").delete().eq("id", post.id);
    onDelete?.();
  };

  const isOwner = user?.id === post.user_id;

  const handleShare = () => {
    setIsShareOpen(true);
  };

  const postUrl = `${window.location.origin}/post/${post.id}`;

  const [mentionMap, setMentionMap] = useState<Record<string, string>>({});
  const [contentText, setContentText] = useState(post.content || "");

  useEffect(() => {
    setContentText(post.content || "");
  }, [post.content]);

  useEffect(() => {
    const content = contentText || "";
    const usernames = extractMentionUsernames(content);
    if (!usernames.length) {
      setMentionMap({});
      return;
    }

    let cancelled = false;
    (async () => {
      const { data, error } = await supabase.rpc("resolve_usernames_to_ids" as any, { p_usernames: usernames } as any);
      if (cancelled) return;
      if (error) {
        setMentionMap({});
        return;
      }

      setMentionMap(buildMentionMap(data || []));
    })();

    return () => {
      cancelled = true;
    };
  }, [contentText]);

  const removeMention = async (username: string) => {
    if (!user) return;
    const key = username.toLowerCase();
    setMentionMap((prev) => {
      const next = { ...prev };
      delete next[key];
      return next;
    });
    await supabase.rpc("remove_post_mention" as any, { p_post_id: post.id, p_username: username } as any);
  };

  return (
    <div className="p-4 sm:p-5 rounded-[2rem] bg-card border border-border transition-all hover:bg-card/90 group/card shadow-sm">
      <div className="flex items-center justify-between mb-4">
        <Link to={`/profile/${post.user_id}`} className="flex items-center gap-3 group">
          <div className="w-10 h-10 rounded-full gradient-bg flex items-center justify-center overflow-hidden border border-primary/20 shadow-sm">
            {profile?.avatar_url ? (
              <img src={profile.avatar_url} alt="" className="w-full h-full object-cover" />
            ) : (
              <span className="text-primary-foreground font-display font-bold text-sm">
                {(profile?.display_name || profile?.username || "?")[0].toUpperCase()}
              </span>
            )}
          </div>
          <div>
            <div className="flex items-center gap-1.5">
              <p className="font-display font-bold text-foreground group-hover:text-primary transition-colors text-[13px] sm:text-sm tracking-tight">
                {profile?.display_name || profile?.username?.split("@")[0] || "Unknown"}
              </p>
              {profile?.is_verified && (
                <VerifiedBadge className="w-3.5 h-3.5 text-blue-500" />
              )}
            </div>
            <p className="text-[11px] sm:text-xs text-muted-foreground/70">
              @{profile?.username?.split("@")[0] || "user"} · {formatDistanceToNow(new Date(post.created_at), { addSuffix: true })}
            </p>
          </div>
        </Link>
        {isOwner && (
          <button onClick={handleDelete} className="p-2 rounded-full hover:bg-destructive/10 text-muted-foreground hover:text-destructive transition-all active:scale-95">
            <Trash2 className="w-4 h-4" />
          </button>
        )}
      </div>

      {contentText && (
        <p className="text-foreground/90 mb-4 text-[15px] leading-relaxed whitespace-pre-wrap px-1">
          {renderContentWithMentions(contentText, mentionMap, {
            canRemove: user?.id === post.user_id,
            onRemove: removeMention,
          })}
        </p>
      )}

      {mediaItems.length > 0 && (
        <div className="relative mb-4 group/media overflow-hidden rounded-2xl border border-border/40 shadow-sm bg-black/5">
          <div className="overflow-hidden" ref={emblaRef} style={{ contain: "layout paint" }}>
            <div className="flex touch-pan-y will-change-transform" style={{ transform: "translate3d(0,0,0)" }}>
              {mediaItems.map((item, index) => (
                <div key={index} className="relative flex-[0_0_100%] min-w-0" style={{ contain: "content" }}>
                  <div className="cursor-pointer transition-transform duration-500 active:scale-[0.99] flex items-center justify-center bg-black/20 overflow-hidden">
                    {item.type === "image" ? (
                      <img
                        src={item.url}
                        alt=""
                        className="w-full h-auto max-h-[500px] object-contain select-none"
                        draggable={false}
                        onClick={() => setIsViewerOpen(true)}
                      />
                    ) : item.type === "video" ? (
                      <div onClick={() => setIsViewerOpen(true)} className="w-full">
                        <VideoPlayer
                          url={item.url}
                          controls={false}
                          className="aspect-video"
                        />
                      </div>
                    ) : item.type === "pdf" ? (
                      <div className="flex flex-col items-center justify-center w-full h-40 bg-white" onClick={() => window.open(item.url, '_blank')} style={{cursor:'pointer'}}>
                        <span className="text-xs font-semibold">PDF</span>
                        <a href={item.url} target="_blank" rel="noopener noreferrer" className="text-blue-600 underline">Open</a>
                      </div>
                    ) : item.type === "doc" || item.type === "docx" ? (
                      <div className="flex flex-col items-center justify-center w-full h-40 bg-white">
                        <span className="text-xs font-semibold">DOC{item.type === "docx" ? "X" : ""}</span>
                        <a href={`https://docs.google.com/gview?url=${encodeURIComponent(item.url)}&embedded=true`} target="_blank" rel="noopener noreferrer" className="text-blue-600 underline">View</a>
                        <a href={item.url} target="_blank" rel="noopener noreferrer" className="text-gray-600 underline text-xs mt-1">Download</a>
                      </div>
                    ) : item.type === "zip" || item.type === "rar" ? (
                      <div className="flex flex-col items-center justify-center w-full h-40 bg-white">
                        <span className="text-xs font-semibold">{item.type.toUpperCase()}</span>
                        <a href={item.url} target="_blank" rel="noopener noreferrer" className="text-blue-600 underline">Download</a>
                      </div>
                    ) : (
                      <div className="flex flex-col items-center justify-center w-full h-40 bg-white">
                        <span className="text-xs font-semibold">File</span>
                        <a href={item.url} target="_blank" rel="noopener noreferrer" className="text-blue-600 underline">Download</a>
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="absolute top-3 right-3 flex gap-2 opacity-0 group-hover/media:opacity-100 transition-opacity z-10">
            <Button
              variant="secondary"
              size="icon"
              className="h-8 w-8 rounded-full bg-black/40 backdrop-blur-md border-0 text-white hover:bg-black/60 shadow-lg"
              onClick={(e) => {
                e.stopPropagation();
                setIsViewerOpen(true);
              }}
            >
              <Maximize2 className="w-4 h-4" />
            </Button>
          </div>

          {mediaItems.length > 1 && (
            <>
              <Button
                variant="ghost"
                size="icon"
                onClick={handlePrev}
                className="absolute left-2 top-1/2 -translate-y-1/2 h-9 w-9 rounded-full bg-black/30 backdrop-blur-md text-white hover:bg-black/50 border-0 opacity-0 group-hover/media:opacity-100 transition-all z-10 hover:scale-110 active:scale-90"
              >
                <ChevronLeft className="w-5 h-5" />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                onClick={handleNext}
                className="absolute right-2 top-1/2 -translate-y-1/2 h-9 w-9 rounded-full bg-black/30 backdrop-blur-md text-white hover:bg-black/50 border-0 opacity-0 group-hover/media:opacity-100 transition-all z-10 hover:scale-110 active:scale-90"
              >
                <ChevronRight className="w-5 h-5" />
              </Button>
              <div className="absolute bottom-3 left-1/2 -translate-x-1/2 flex gap-1.5 p-1.5 rounded-full bg-black/20 backdrop-blur-md z-10 pointer-events-none">
                {mediaItems.map((_, i) => (
                  <div key={i} className={`w-1.5 h-1.5 rounded-full transition-all duration-300 ${i === activeMediaIndex ? "bg-white w-3.5 shadow-glow" : "bg-white/40"}`} />
                ))}
              </div>
            </>
          )}
        </div>
      )}

      <div className="flex items-center gap-6 pt-3 border-t border-border/50">
        <button onClick={toggleLike} className={`flex items-center gap-2 text-sm font-semibold transition-all active:scale-90 ${liked ? "text-accent" : "text-muted-foreground hover:text-accent"}`}>
          <Heart className={`w-5 h-5 ${liked ? "fill-accent" : ""}`} />
          {formatNumber(likeCount)}
        </button>
        <button
          onClick={() => setShowComments(!showComments)}
          className={`flex items-center gap-2 text-sm font-semibold transition-all active:scale-90 ${showComments ? "text-primary" : "text-muted-foreground hover:text-primary"}`}
        >
          <MessageCircle className="w-5 h-5" />
          {formatNumber(commentCount)}
        </button>
        <button
          onClick={handleShare}
          className="flex items-center gap-2 text-sm font-semibold text-muted-foreground hover:text-foreground transition-all active:scale-90 ml-auto"
        >
          <Share2 className="w-5 h-5" />
          Share
        </button>
      </div>

      {showComments && <CommentSection postId={post.id} />}

      <MediaViewer
        media={mediaItems}
        isOpen={isViewerOpen}
        initialIndex={activeMediaIndex}
        onClose={() => setIsViewerOpen(false)}
      />

      <ShareDialog
        isOpen={isShareOpen}
        onClose={() => setIsShareOpen(false)}
        postUrl={postUrl}
        postTitle={post.content?.slice(0, 50) || "Check out this post on Zeo Matrix!"}
      />
    </div>
  );
};

export default PostCard;
