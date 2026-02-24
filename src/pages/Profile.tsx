import { useState, useEffect, useCallback } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import PostCard from "@/components/PostCard";
import { useToast } from "@/hooks/use-toast";
import { Camera, Trash2, AlertTriangle } from "lucide-react";
import { VerifiedBadge } from "@/components/VerifiedBadge";
import { useRef } from "react";
import AvatarCropper from "@/components/AvatarCropper";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";

interface ProfileData {
  user_id: string;
  username: string;
  display_name: string | null;
  bio: string | null;
  avatar_url: string | null;
  cover_url: string | null;
  is_verified?: boolean;
  is_private?: boolean;
}

const Profile = () => {
  const { userId } = useParams();
  const { user } = useAuth();
  const { toast } = useToast();
  const navigate = useNavigate();
  const [profile, setProfile] = useState<ProfileData | null>(null);
  const [posts, setPosts] = useState<any[]>([]);
  const [isFollowing, setIsFollowing] = useState(false);
  const [followState, setFollowState] = useState<"none" | "following" | "requested">("none");
  const [followersCount, setFollowersCount] = useState(0);
  const [followingCount, setFollowingCount] = useState(0);
  const [editing, setEditing] = useState(false);
  const [editBio, setEditBio] = useState("");
  const [editDisplayName, setEditDisplayName] = useState("");
  const [loading, setLoading] = useState(true);
  const [isDeleting, setIsDeleting] = useState(false);
  const [startingDm, setStartingDm] = useState(false);
  const avatarRef = useRef<HTMLInputElement>(null);
  const coverRef = useRef<HTMLInputElement>(null);
  const [cropSrc, setCropSrc] = useState<string | null>(null);
  const isOwner = user?.id === userId;
  const canViewPrivateContent = !profile?.is_private || isOwner || isFollowing;

  useEffect(() => {
    if (!userId) return;
    if (userId === "undefined" || userId === "null") {
      if (user?.id) navigate(`/profile/${user.id}`, { replace: true });
      else navigate("/login", { replace: true });
    }
  }, [userId, user?.id, navigate]);

  const startDm = async () => {
    if (!user || !userId) return;
    if (user.id === userId) return;

    setStartingDm(true);
    try {
      const { data, error } = await (supabase as any).rpc("get_or_create_dm", {
        p_other_user_id: userId,
      });
      if (error) throw error;

      const conversationId = data as string | null;
      if (!conversationId) throw new Error("Couldn't start chat");
      navigate(`/inbox/${conversationId}`);
    } catch (e: any) {
      console.error(e);
      toast({
        title: "Couldn't start chat",
        description: e?.message || "Please try again",
        variant: "destructive",
      });
    } finally {
      setStartingDm(false);
    }
  };

  const fetchData = useCallback(async () => {
    if (!userId) {
      setLoading(false);
      return;
    }

    setLoading(true);
    try {

      const [profileRes, postsRes, followersRes, followingRes] = await Promise.all([
        supabase.from("profiles").select("*").eq("user_id", userId).maybeSingle(),
        supabase.from("posts").select("*").eq("user_id", userId).order("created_at", { ascending: false }),
        supabase.from("follows").select("*", { count: "exact", head: true }).eq("following_id", userId),
        supabase.from("follows").select("*", { count: "exact", head: true }).eq("follower_id", userId)
      ]);

      if (profileRes.data) {
        setProfile(profileRes.data);
        setEditBio(profileRes.data.bio || "");
        setEditDisplayName(profileRes.data.display_name || "");
      }

      setFollowersCount(followersRes.count ?? 0);
      setFollowingCount(followingRes.count ?? 0);

      if (postsRes.data) {
        const postData = postsRes.data;
        const postIds = postData.map(p => p.id);

        if (postIds.length > 0) {
          const { data: likesData } = await supabase.from("likes").select("post_id, user_id").in("post_id", postIds);

          const likeCountsMap = new Map();
          const userLikesSet = new Set();

          likesData?.forEach(like => {
            likeCountsMap.set(like.post_id, (likeCountsMap.get(like.post_id) || 0) + 1);
            if (user && like.user_id === user.id) {
              userLikesSet.add(like.post_id);
            }
          });

          setPosts(postData.map(p => ({
            ...p,
            likeCount: likeCountsMap.get(p.id) || 0,
            isLiked: userLikesSet.has(p.id)
          })));
        } else {
          setPosts([]);
        }
      }

      if (user && user.id !== userId) {
        const { data } = await supabase.from("follows").select("id").eq("follower_id", user.id).eq("following_id", userId).maybeSingle();
        setIsFollowing(!!data);

        const isPrivate = (profileRes.data as any)?.is_private;
        if (isPrivate && !data) {
          const { data: req } = await supabase
            .from("follow_requests")
            .select("id, status")
            .eq("requester_id", user.id)
            .eq("target_id", userId)
            .eq("status", "pending")
            .maybeSingle();
          setFollowState(req ? "requested" : "none");
        } else {
          setFollowState(data ? "following" : "none");
        }
      }
    } catch (error) {
      console.error("Error fetching profile data:", error);
      toast({ title: "Error", description: "Failed to load profile data", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  }, [userId, user, toast]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const toggleFollow = async () => {
    if (!user || !userId) return;

    if (profile?.is_private && user.id !== userId) {
      try {
        if (followState === "requested") {
          const { error } = await supabase
            .from("follow_requests")
            .delete()
            .eq("requester_id", user.id)
            .eq("target_id", userId)
            .eq("status", "pending");
          if (error) throw error;
          setFollowState("none");
          toast({ title: "Request cancelled" });
          return;
        }

        const { data, error } = await (supabase as any).rpc("request_follow", { target_user_id: userId });
        if (error) throw error;

        if (data === "followed") {
          setIsFollowing(true);
          setFollowState("following");
          setFollowersCount((c) => c + 1);
          toast({ title: "Following" });
        } else {
          setFollowState("requested");
          toast({ title: "Request sent", description: "This account is private." });
        }
        return;
      } catch (error: any) {
        console.error("Failed to request follow:", error);
        toast({ title: "Follow failed", description: error?.message || "Please try again", variant: "destructive" });
        return;
      }
    }

    try {
      if (isFollowing) {
        const { error } = await supabase
          .from("follows")
          .delete()
          .eq("follower_id", user.id)
          .eq("following_id", userId);

        if (error) throw error;

        setIsFollowing(false);
        setFollowersCount((c) => Math.max(0, c - 1));
      } else {
        const { error } = await supabase
          .from("follows")
          .insert({ follower_id: user.id, following_id: userId });

        if (error) throw error;

        setIsFollowing(true);
        setFollowersCount((c) => c + 1);
      }

      const [followRes, followersRes] = await Promise.all([
        supabase
          .from("follows")
          .select("id")
          .eq("follower_id", user.id)
          .eq("following_id", userId)
          .maybeSingle(),
        supabase
          .from("follows")
          .select("*", { count: "exact", head: true })
          .eq("following_id", userId),
      ]);

      setIsFollowing(!!followRes.data);
  setFollowState(followRes.data ? "following" : "none");
      setFollowersCount(followersRes.count ?? 0);
    } catch (error: any) {
      console.error("Failed to toggle follow:", error);
      toast({
        title: "Follow failed",
        description:
          error?.message || "Couldn't update follow status. Please try again.",
        variant: "destructive",
      });

      if (user && userId) {
        const [{ data }, followersRes] = await Promise.all([
          supabase
            .from("follows")
            .select("id")
            .eq("follower_id", user.id)
            .eq("following_id", userId)
            .maybeSingle(),
          supabase
            .from("follows")
            .select("*", { count: "exact", head: true })
            .eq("following_id", userId),
        ]);
        setIsFollowing(!!data);
        setFollowState(!!data ? "following" : "none");
        setFollowersCount(followersRes.count ?? 0);
      }
    }
  };

  const togglePrivate = async () => {
    if (!user || !isOwner) return;
    try {
      const next = !profile?.is_private;
      const { error } = await supabase
        .from("profiles")
        .update({ is_private: next } as any)
        .eq("user_id", user.id);
      if (error) throw error;
      toast({ title: next ? "Account is now private" : "Account is now public" });
      await fetchData();
    } catch (e: any) {
      toast({ title: "Error", description: e?.message || "Failed to update privacy", variant: "destructive" });
    }
  };

  const saveProfile = async () => {
    if (!user) return;
    const { error } = await supabase.from("profiles").update({ display_name: editDisplayName, bio: editBio }).eq("user_id", user.id);
    if (error) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    } else {
      setEditing(false);
      fetchData();
    }
  };

  const handleDeleteAccount = async () => {
    setIsDeleting(true);
    try {
      const { error } = await supabase.rpc("delete_user_account");
      if (error) throw error;

      await supabase.auth.signOut();
      toast({ title: "Account Deleted", description: "Your account has been successfully removed." });
      window.location.href = "/";
    } catch (error: any) {
      toast({ title: "Deletion failed", description: error.message, variant: "destructive" });
      setIsDeleting(false);
    }
  };

  const handleCoverUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !user) return;

    try {
      const ext = file.name.split(".").pop() || "jpg";
      const path = `${user.id}/cover.${ext}`;

      const { error: uploadError } = await supabase.storage
        .from("avatars")
        .upload(path, file, { upsert: true });
      if (uploadError) throw uploadError;

      const { data: urlData } = supabase.storage.from("avatars").getPublicUrl(path);
      const url = `${urlData.publicUrl}?t=${Date.now()}`;

      // Quick sanity fetch: if this fails we likely have bucket/policy/CORS issues.
      try {
        await fetch(url, { method: "HEAD", cache: "no-store" });
      } catch {
        // ignore; we still store the URL, but error toast below will help.
      }

      const { error: updateError } = await supabase
        .from("profiles")
        .update({ cover_url: url })
        .eq("user_id", user.id);
      if (updateError) throw updateError;

      fetchData();
    } catch (err: any) {
      console.error("Cover upload failed:", err);
      toast({
        title: "Cover upload failed",
        description: err?.message || err?.error_description || "Please try again",
        variant: "destructive",
      });
    }
  };

  const handleAvatarUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => setCropSrc(reader.result as string);
    reader.readAsDataURL(file);

    e.target.value = "";
  };

  const handleCropDone = async (blob: Blob) => {
    if (!user) return;
    setCropSrc(null);

    try {
      const path = `${user.id}/avatar.jpg`;

      const { error: uploadError } = await supabase.storage
        .from("avatars")
        .upload(path, blob, { upsert: true, contentType: "image/jpeg" });
      if (uploadError) throw uploadError;

      const { data: urlData } = supabase.storage.from("avatars").getPublicUrl(path);
      const url = `${urlData.publicUrl}?t=${Date.now()}`;

      // Quick sanity fetch to detect 403/404 early.
      try {
        const r = await fetch(url, { method: "HEAD", cache: "no-store" });
        if (!r.ok) {
          console.warn("Avatar public URL not reachable:", r.status, url);
        }
      } catch (e) {
        console.warn("Avatar public URL HEAD request failed", e);
      }

      const { error: updateError } = await supabase
        .from("profiles")
        .update({ avatar_url: url })
        .eq("user_id", user.id);
      if (updateError) throw updateError;

      fetchData();
    } catch (err: any) {
      console.error("Avatar upload failed:", err);
      toast({
        title: "Avatar upload failed",
        description: err?.message || err?.error_description || "Please try again",
        variant: "destructive",
      });
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center py-20">
        <div className="w-8 h-8 rounded-full border-2 border-primary border-t-transparent animate-spin" />
      </div>
    );
  }

  if (!profile) {
    return (
      <div className="max-w-2xl mx-auto px-4 py-20 text-center">
        <h2 className="text-2xl font-display font-bold text-foreground mb-2">Profile not found</h2>
        <p className="text-muted-foreground">The user you are looking for doesn't exist.</p>
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto px-4 py-6">
      {cropSrc && (
        <AvatarCropper
          imageSrc={cropSrc}
          onCropDone={handleCropDone}
          onCancel={() => setCropSrc(null)}
        />
      )}
      <div className="relative mb-8 sm:mb-12">
        <div className="h-40 sm:h-48 md:h-52 rounded-2xl overflow-hidden relative group/cover bg-gradient-to-br from-primary/30 to-accent/30 shadow-inner">
          {profile.cover_url ? (
            <img src={profile.cover_url} alt="" className="w-full h-full object-cover" />
          ) : (
            <div className="w-full h-full" />
          )}

          {isOwner && (
            <button
              onClick={() => coverRef.current?.click()}
              className="absolute inset-0 bg-black/40 opacity-0 group-hover/cover:opacity-100 flex items-center justify-center transition-all duration-300 z-10"
            >
              <div className="p-3 rounded-full bg-white/20 backdrop-blur-md border border-white/30 shadow-xl">
                <Camera className="w-6 h-6 text-white" />
              </div>
            </button>
          )}
          <input ref={coverRef} type="file" accept="image/*" className="hidden" onChange={handleCoverUpload} />
        </div>

        <div className="absolute -bottom-6 sm:-bottom-8 left-4 sm:left-6 z-30">
          <div className="relative w-24 h-24 sm:w-32 sm:h-32 rounded-full border-[5px] border-background bg-background overflow-hidden shadow-xl flex items-center justify-center">
            {profile.avatar_url ? (
              <img src={profile.avatar_url} alt="" className="w-full h-full object-cover" />
            ) : (
              <div className="w-full h-full gradient-bg flex items-center justify-center">
                <span className="text-primary-foreground font-display font-bold text-2xl sm:text-3xl">
                  {(profile.display_name || profile.username || "Z")[0].toUpperCase()}
                </span>
              </div>
            )}
            {isOwner && (
              <button
                onClick={() => avatarRef.current?.click()}
                className="absolute inset-0 bg-black/50 opacity-0 hover:opacity-100 flex items-center justify-center transition-all duration-300 group/avatar"
              >
                <div className="p-2 rounded-full bg-white/20 backdrop-blur-sm border border-white/30">
                  <Camera className="w-5 h-5 text-white" />
                </div>
              </button>
            )}
            <input ref={avatarRef} type="file" accept="image/*" className="hidden" onChange={handleAvatarUpload} />
          </div>
        </div>
      </div>

      <div className="mb-8 pt-2">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div className="space-y-0.5 min-w-0">
            {editing ? (
              <Input value={editDisplayName} onChange={(e) => setEditDisplayName(e.target.value)} className="mb-2 max-w-xs h-10 font-bold" />
            ) : (
              <div className="flex items-center gap-2">
                <h1 className="text-2xl sm:text-3xl font-display font-bold text-white tracking-tight">
                  {profile.display_name || profile.username?.split("@")[0]}
                </h1>
                {profile.is_verified && (
                  <VerifiedBadge className="w-5 h-5 sm:w-6 sm:h-6 text-blue-500" />
                )}
              </div>
            )}
            <p className="text-[15px] font-medium text-muted-foreground">
              @{profile.username?.split("@")[0]}
            </p>
          </div>
          <div className="pt-2 w-full sm:w-auto">
            {isOwner ? (
              editing ? (
                <div className="flex flex-wrap gap-2 justify-start sm:justify-end">
                  <Button variant="outline" size="sm" onClick={() => setEditing(false)} className="rounded-full px-4 border-border/60">Cancel</Button>
                  <Button variant="hero" size="sm" onClick={saveProfile} className="rounded-full px-6 shadow-glow">Save</Button>
                </div>
              ) : (
                <div className="flex flex-wrap gap-2 justify-start sm:justify-end">
                  <Button variant="outline" size="sm" onClick={() => setEditing(true)} className="rounded-full px-5 border-border/60 font-bold hover:bg-secondary/50">Edit Profile</Button>
                  <Button
                    variant={profile?.is_private ? "outline" : "hero"}
                    size="sm"
                    onClick={togglePrivate}
                    className="rounded-full px-5 font-bold"
                    title="Toggle private account"
                  >
                    {profile?.is_private ? "Private" : "Public"}
                  </Button>
                </div>
              )
            ) : (
              <div className="flex flex-col sm:flex-row gap-2 w-full sm:w-auto">
                <Button
                  variant={isFollowing ? "outline" : "hero"}
                  size="sm"
                  onClick={toggleFollow}
                  className="rounded-full px-8 font-bold w-full sm:w-auto"
                >
                  {isFollowing
                    ? "Unfollow"
                    : profile?.is_private && followState === "requested"
                      ? "Requested"
                      : profile?.is_private
                        ? "Request"
                        : "Follow"}
                </Button>

                <Button
                  variant="outline"
                  size="sm"
                  onClick={startDm}
                  disabled={startingDm}
                  className="rounded-full px-6 font-bold w-full sm:w-auto"
                >
                  {startingDm ? "Opening…" : "Message"}
                </Button>
              </div>
            )}
          </div>
        </div>

        {editing ? (
          <div className="space-y-4 mt-4">
            <Textarea value={editBio} onChange={(e) => setEditBio(e.target.value)} placeholder="Tell us about yourself..." className="rounded-xl border-border/40 focus:border-primary/50" />

            <div className="p-4 rounded-2xl border border-destructive/20 bg-destructive/5">
              <h3 className="text-xs font-bold text-destructive mb-2 uppercase tracking-widest flex items-center gap-2">
                <AlertTriangle className="w-3.5 h-3.5" /> Danger Zone
              </h3>
              <p className="text-[11px] text-muted-foreground mb-4">Deleting your account is permanent and cannot be undone.</p>

              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button
                    variant="destructive"
                    size="sm"
                    className="w-full sm:w-auto h-9 font-bold rounded-xl"
                  >
                    <Trash2 className="w-4 h-4 mr-2" /> Delete Account
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent className="bg-card border-border/40 border-2 rounded-3xl">
                  <AlertDialogHeader>
                    <AlertDialogTitle className="text-xl font-bold text-foreground flex items-center gap-2">
                      <AlertTriangle className="w-6 h-6 text-destructive" /> Permanent Deletion
                    </AlertDialogTitle>
                    <AlertDialogDescription className="text-muted-foreground text-sm pt-2">
                      Are you absolutely sure? This will permanently remove your
                      entire presence, posts, and data from Zeo Matrix.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter className="pt-4 gap-2 sm:gap-0">
                    <AlertDialogCancel className="bg-secondary text-foreground hover:bg-secondary/80 rounded-2xl px-6 border-0">Cancel</AlertDialogCancel>
                    <AlertDialogAction
                      onClick={handleDeleteAccount}
                      className="bg-destructive text-white hover:bg-destructive/90 transition-all font-bold rounded-2xl px-8"
                      disabled={isDeleting}
                    >
                      {isDeleting ? "Deleting..." : "Delete Permanently"}
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            </div>
          </div>
        ) : (
          profile.bio ? (
            <p className="text-sm sm:text-[15px] leading-relaxed text-foreground mt-4 max-w-lg">{profile.bio}</p>
          ) : (
            isOwner && <p className="text-sm text-muted-foreground mt-4 italic">No bio added yet.</p>
          )
        )}

        <div className="flex flex-wrap gap-6 mt-6 pb-2">
          <Link to={`/profile/${userId}/following`} className="flex gap-1.5 items-baseline hover:opacity-80 transition-opacity">
            <span className="text-base font-bold text-foreground tracking-tight">{followingCount}</span>
            <span className="text-sm text-muted-foreground font-medium">Following</span>
          </Link>
          <Link to={`/profile/${userId}/followers`} className="flex gap-1.5 items-baseline hover:opacity-80 transition-opacity">
            <span className="text-base font-bold text-foreground tracking-tight">{followersCount}</span>
            <span className="text-sm text-muted-foreground font-medium">Followers</span>
          </Link>
          <div className="flex gap-1.5 items-baseline">
            <span className="text-base font-bold text-foreground tracking-tight">{posts.length}</span>
            <span className="text-sm text-muted-foreground font-medium">Posts</span>
          </div>
        </div>
      </div>

      <div className="space-y-4">
        {!canViewPrivateContent ? (
          <div className="text-center py-20 bg-card/30 rounded-3xl border border-dashed border-border/50">
            <p className="font-display text-lg text-muted-foreground">This account is private</p>
            {!isOwner && (
              <p className="text-sm text-muted-foreground/60 mt-1">Follow to see posts.</p>
            )}
          </div>
        ) : (
          <>
            {posts.map((post) => (
              <PostCard
                key={post.id}
                post={post}
                profile={profile}
                onDelete={fetchData}
                initialLiked={post.isLiked}
                initialLikeCount={post.likeCount}
              />
            ))}
            {posts.length === 0 && (
              <p className="text-center py-12 text-muted-foreground">No posts yet.</p>
            )}
          </>
        )}
      </div>
    </div>
  );
};

export default Profile;
