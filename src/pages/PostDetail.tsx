import { useState, useEffect } from "react";
import { useParams, Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import PostCard from "@/components/PostCard";
import { ChevronLeft } from "lucide-react";
import { Button } from "@/components/ui/button";

const PostDetail = () => {
    const { postId } = useParams();
    const [post, setPost] = useState<any>(null);
    const [profile, setProfile] = useState<any>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const fetchPost = async () => {
            if (!postId) return;
            setLoading(true);
            const { data: postData, error: postError } = await supabase
                .from("posts")
                .select("*")
                .eq("id", postId)
                .single();

            if (postError) {
                console.error("Error fetching post:", postError);
                setLoading(false);
                return;
            }
            const { data: likesData } = await supabase
                .from("likes")
                .select("user_id")
                .eq("post_id", postId);

            const { data: userData } = await supabase.auth.getUser();

            const postWithLikes = {
                ...postData,
                likeCount: likesData?.length || 0,
                isLiked: likesData?.some(l => l.user_id === userData.user?.id)
            };
            const { data: profileData } = await (supabase
                .from("profiles")
                .select("*, is_verified") as any)
                .eq("user_id", postData.user_id)
                .single();

            setPost(postWithLikes);
            setProfile(profileData);
            setLoading(false);
        };

        fetchPost();
    }, [postId]);

    if (loading) {
        return (
            <div className="flex justify-center py-20">
                <div className="w-8 h-8 rounded-full border-2 border-primary border-t-transparent animate-spin" />
            </div>
        );
    }

    if (!post) {
        return (
            <div className="max-w-2xl mx-auto px-4 py-20 text-center">
                <h2 className="text-2xl font-display font-bold text-foreground mb-4">Post not found</h2>
                <Link to="/feed">
                    <Button variant="hero" className="rounded-full shadow-glow">Go back to Feed</Button>
                </Link>
            </div>
        );
    }

    return (
        <div className="max-w-2xl mx-auto px-4 py-6">
            <Link to="/feed" className="inline-flex items-center gap-2 text-muted-foreground hover:text-primary mb-6 transition-colors font-medium">
                <ChevronLeft className="w-5 h-5" />
                Back to Feed
            </Link>

            <PostCard
                post={post}
                profile={profile}
                onDelete={() => window.location.href = "/feed"}
                initialLiked={post.isLiked}
                initialLikeCount={post.likeCount}
            />
        </div>
    );
};

export default PostDetail;
