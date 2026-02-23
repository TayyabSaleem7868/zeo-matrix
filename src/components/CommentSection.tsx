import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { formatDistanceToNow } from "date-fns";
import { Trash2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface Comment {
    id: string;
    user_id: string;
    post_id: string;
    content: string;
    created_at: string;
    parent_id: string | null;
    profile: {
        username: string;
        display_name: string | null;
        avatar_url: string | null;
    } | null;
}

interface CommentSectionProps {
    postId: string;
}

const CommentSection = ({ postId }: CommentSectionProps) => {
    const { user } = useAuth();
    const { toast } = useToast();
    const [comments, setComments] = useState<Comment[]>([]);
    const [newComment, setNewComment] = useState("");
    const [replyTo, setReplyTo] = useState<string | null>(null);
    const [replyContent, setReplyContent] = useState("");
    const [loading, setLoading] = useState(false);

    const getWarningsCount = async () => {
        if (!user) return 0;
        const { data, error } = await (supabase as any).rpc("get_my_spam_warnings_count", { p_window_hours: 24 });
        if (error) return 0;
        return (data as number) ?? 0;
    };

    const fetchComments = async () => {
                const { data, error } = await (supabase
                        .from("comments" as any) as any)
            .select(`
        *,
        profiles (
          username,
          display_name,
          avatar_url
        )
      `)
            .eq("post_id", postId)
            .order("created_at", { ascending: true });

        if (error) {
            console.error("Error fetching comments:", error);
        } else {
            const mappedData = (data as any[]).map(c => ({
                ...c,
                profile: c.profiles
            }));
            setComments(mappedData);
        }
    };

    useEffect(() => {
        fetchComments();
        const channel = supabase
            .channel(`comments-${postId}`)
            .on(
                "postgres_changes",
                { event: "*", schema: "public", table: "comments", filter: `post_id=eq.${postId}` },
                () => fetchComments()
            )
            .subscribe();

        return () => {
            supabase.removeChannel(channel);
        };
    }, [postId]);

    const handleSubmit = async (e: React.FormEvent, parentId: string | null = null) => {
        e.preventDefault();
        const content = parentId ? replyContent : newComment;
        if (!user || !content.trim() || loading) return;

        setLoading(true);
        const beforeWarnings = await getWarningsCount();

        const { data: inserted, error } = await (supabase
            .from("comments" as any) as any)
            .insert({
                user_id: user.id,
                post_id: postId,
                content: content.trim(),
                parent_id: parentId
            })
            .select("id")
            .maybeSingle();

        if (error) {
            toast({ title: "Error", description: error.message, variant: "destructive" });
        } else {
            let wasDeletedByGuard = false;
            if (!inserted?.id) {
                wasDeletedByGuard = true;
            } else {
                const { data: stillThere } = await (supabase
                    .from("comments" as any) as any)
                    .select("id")
                    .eq("id", inserted.id)
                    .maybeSingle();

                if (!stillThere?.id) wasDeletedByGuard = true;
            }

            if (wasDeletedByGuard) {
                const afterWarnings = await getWarningsCount();
                const effectiveWarnings = Math.min(3, Math.max(beforeWarnings, afterWarnings));
                const remaining = Math.max(0, 3 - effectiveWarnings);

                toast({
                    title: "Spam warning",
                    description:
                        remaining > 0
                            ? `Your comment was removed as spam. Warning ${effectiveWarnings}/3. ${remaining} left.`
                            : `Your comment was removed as spam. Warning ${effectiveWarnings}/3. You’ve been flagged for admin review.`,
                    variant: "destructive",
                });
            }

            if (parentId) {
                setReplyContent("");
                setReplyTo(null);
            } else {
                setNewComment("");
            }
            fetchComments(); // Manual refresh in case realtime is slow
        }
        setLoading(false);
    };

    const handleDelete = async (commentId: string) => {
        const { error } = await (supabase
            .from("comments" as any) as any)
            .delete()
            .eq("id", commentId);

        if (error) {
            toast({ title: "Error", description: error.message, variant: "destructive" });
        } else {
            toast({ title: "Success", description: "Comment deleted" });
            fetchComments(); // Manual refresh
        }
    };

    const renderComment = (comment: Comment, isReply = false) => (
        <div key={comment.id} className={`${isReply ? "ml-8 mt-3" : "mt-4"} first:mt-0 animate-fade-in`}>
            <div className="flex gap-3 group">
                <div className={`${isReply ? "w-6 h-6" : "w-8 h-8"} rounded-full gradient-bg flex-shrink-0 flex items-center justify-center overflow-hidden`}>
                    {comment.profile?.avatar_url ? (
                        <img src={comment.profile.avatar_url} alt="" className="w-full h-full object-cover" />
                    ) : (
                        <span className={`text-primary-foreground font-display font-bold ${isReply ? "text-[8px]" : "text-[10px]"}`}>
                            {(comment.profile?.display_name || comment.profile?.username || "?")[0].toUpperCase()}
                        </span>
                    )}
                </div>
                <div className="flex-1 min-w-0">
                    <div className="bg-muted/50 p-3 rounded-2xl">
                        <div className="flex items-center justify-between mb-1">
                            <p className="font-display font-medium text-foreground text-[12px] sm:text-[13px]">
                                {comment.profile?.display_name || comment.profile?.username || "Unknown"}
                            </p>
                            <p className="text-[10px] text-muted-foreground">
                                {formatDistanceToNow(new Date(comment.created_at), { addSuffix: true })}
                            </p>
                        </div>
                        <p className="text-foreground text-[12px] sm:text-[13px] leading-relaxed break-words">
                            {comment.content}
                        </p>
                    </div>
                    <div className="flex gap-3 mt-1 px-2">
                        {!isReply && user && (
                            <button
                                onClick={() => setReplyTo(replyTo === comment.id ? null : comment.id)}
                                className="text-[10px] text-muted-foreground hover:text-primary transition-colors"
                            >
                                Reply
                            </button>
                        )}
                        {user?.id === comment.user_id && (
                            <button
                                onClick={() => handleDelete(comment.id)}
                                className="text-[10px] text-muted-foreground hover:text-destructive transition-colors"
                            >
                                Delete
                            </button>
                        )}
                    </div>

                    {replyTo === comment.id && (
                        <form onSubmit={(e) => handleSubmit(e, comment.id)} className="mt-3 flex gap-2 items-start">
                            <Textarea
                                autoFocus
                                value={replyContent}
                                onChange={(e) => setReplyContent(e.target.value)}
                                placeholder={`Reply to ${comment.profile?.display_name || comment.profile?.username}...`}
                                className="min-h-[36px] text-[12px] rounded-xl bg-muted/30 resize-none border-none focus-visible:ring-1 focus-visible:ring-primary"
                                rows={1}
                                onKeyDown={(e) => {
                                    if (e.key === "Enter" && !e.shiftKey) {
                                        e.preventDefault();
                                        handleSubmit(e, comment.id);
                                    }
                                }}
                            />
                            <Button type="submit" size="sm" variant="hero" disabled={!replyContent.trim() || loading} className="h-9 px-3 rounded-xl text-[12px]">
                                Post
                            </Button>
                        </form>
                    )}

                    {}
                    {comments.filter(c => c.parent_id === comment.id).map(reply => renderComment(reply, true))}
                </div>
            </div>
        </div>
    );

    const rootComments = comments.filter(c => !c.parent_id);

    return (
        <div className="mt-4 pt-4 border-t border-border animate-fade-in">
            <div className="space-y-4 mb-6">
                {rootComments.map((comment) => renderComment(comment))}
                {rootComments.length === 0 && (
                    <p className="text-center py-4 text-muted-foreground text-[12px]">No comments yet. Be the first!</p>
                )}
            </div>

            {user ? (
                <form onSubmit={handleSubmit} className="flex gap-2 items-start">
                    <Textarea
                        value={newComment}
                        onChange={(e) => setNewComment(e.target.value)}
                        placeholder="Write a comment..."
                        className="min-h-[40px] text-[13px] rounded-xl bg-muted/30 resize-none border-none focus-visible:ring-1 focus-visible:ring-primary"
                        rows={1}
                        onKeyDown={(e) => {
                            if (e.key === "Enter" && !e.shiftKey) {
                                e.preventDefault();
                                handleSubmit(e);
                            }
                        }}
                    />
                    <Button
                        type="submit"
                        size="sm"
                        variant="hero"
                        disabled={!newComment.trim() || loading}
                        className="h-10 rounded-xl"
                    >
                        Post
                    </Button>
                </form>
            ) : (
                <p className="text-center text-sm text-muted-foreground italic">Sign in to leave a comment</p>
            )}
        </div>
    );
};

export default CommentSection;
