import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { Shield, Users, Ban, CheckCircle, Search, Mail, User, Clock } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { Link } from "react-router-dom";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useQueryClient } from "@tanstack/react-query";
import {
    AlertDialog,
    AlertDialogAction,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
    Bar,
    BarChart,
    CartesianGrid,
    ResponsiveContainer,
    Tooltip,
    XAxis,
    YAxis,
} from "recharts";

const ChartTooltip = ({ active, payload, label }: any) => {
    if (!active || !payload?.length) return null;
    const val = payload[0]?.value;
    return (
        <div className="rounded-2xl border border-border/60 bg-background/60 backdrop-blur-md px-3 py-2 shadow-xl">
            <p className="text-xs text-muted-foreground">{label}</p>
            <p className="text-sm font-bold text-foreground">posts: {val}</p>
        </div>
    );
};

const ADMIN_CREDENTIALS = {
    NAME: import.meta.env.VITE_ADMIN_NAME || "",
    SECRET: import.meta.env.VITE_ADMIN_SECRET || "",
};

const AdminPanel = () => {
    const { user } = useAuth();
    const { toast } = useToast();
    const queryClient = useQueryClient();
    const [isAuthorized, setIsAuthorized] = useState(false);
    const [adminName, setAdminName] = useState("");
    const [adminSecret, setAdminSecret] = useState("");
    const [profiles, setProfiles] = useState<any[]>([]);
    const [loading, setLoading] = useState(false);
    const [searchTerm, setSearchTerm] = useState("");

    const [activeTab, setActiveTab] = useState<"users" | "analytics" | "spammers">("users");

    const [analyticsLoading, setAnalyticsLoading] = useState(false);
    const [analyticsError, setAnalyticsError] = useState<string | null>(null);
    const [overview, setOverview] = useState<any | null>(null);
    const [topUsersByPosts, setTopUsersByPosts] = useState<any[]>([]);
    const [topPostsByLikes, setTopPostsByLikes] = useState<any[]>([]);

    const [spammersLoading, setSpammersLoading] = useState(false);
    const [spammersError, setSpammersError] = useState<string | null>(null);
    const [spammers, setSpammers] = useState<any[]>([]);

    const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
    const [pendingDeletePostId, setPendingDeletePostId] = useState<string | null>(null);

    const handleLogin = (e: React.FormEvent) => {
        e.preventDefault();
        if (
            adminName === ADMIN_CREDENTIALS.NAME &&
            adminSecret === ADMIN_CREDENTIALS.SECRET
        ) {
            setIsAuthorized(true);
            toast({ title: "Welcome ZAROON", description: "Admin access granted." });
            fetchProfiles();
        } else {
            toast({
                title: "Access Denied",
                description: "Invalid credentials.",
                variant: "destructive",
            });
        }
    };

    const fetchProfiles = async () => {
        setLoading(true);
        const { data, error } = await supabase
            .from("profiles")
            .select("*");

        if (error) {
            toast({ title: "Error", description: error.message, variant: "destructive" });
        } else {
            setProfiles(data || []);
        }
        setLoading(false);
    };

    const fetchAnalytics = async () => {
        setAnalyticsLoading(true);
        setAnalyticsError(null);

        const [{ data: overviewData, error: overviewError }, { data: usersData, error: usersError }, { data: postsData, error: postsError }] =
            await Promise.all([
                (supabase as any).rpc("admin_analytics_overview"),
                (supabase as any).rpc("admin_top_users_by_posts", { p_limit: 10 }),
                (supabase as any).rpc("admin_top_posts_by_likes", { p_limit: 10 }),
            ]);

        const err = overviewError || usersError || postsError;
        if (err) {
            setAnalyticsError(err.message || "Failed to load analytics");
            setOverview(null);
            setTopUsersByPosts([]);
            setTopPostsByLikes([]);
        } else {
            setOverview(overviewData);
            setTopUsersByPosts(usersData || []);
            setTopPostsByLikes(postsData || []);
        }

        setAnalyticsLoading(false);
    };

    const requestDeletePost = (postId: string) => {
        setPendingDeletePostId(postId);
        setDeleteDialogOpen(true);
    };

    const confirmDeletePost = async () => {
        if (!pendingDeletePostId) return;

        const postId = pendingDeletePostId;
        setDeleteDialogOpen(false);
        setPendingDeletePostId(null);

        const { data, error } = await (supabase as any).rpc("admin_delete_post", {
            p_post_id: postId,
            p_reason: "Your post was removed due to a violation of our community guidelines.",
        });
        if (error) {
            toast({ title: "Error", description: error.message, variant: "destructive" });
            return;
        }
        if (data !== "ok") {
            toast({ title: "Error", description: "Post not found", variant: "destructive" });
            return;
        }

        toast({ title: "Deleted", description: "Post removed from the site." });

        fetchAnalytics();
        queryClient.invalidateQueries({ queryKey: ["feed"] });
    };

    const fetchSpammers = async () => {
        setSpammersLoading(true);
        setSpammersError(null);

        const { data, error } = await (supabase as any).rpc("admin_list_spammers", { p_limit: 50 });

        if (error) {
            setSpammersError(error.message || "Failed to load spammers");
            setSpammers([]);
        } else {
            setSpammers(data || []);
        }
        setSpammersLoading(false);
    };

    const updateSpammerStatus = async (userId: string, status: "reviewed" | "ignored") => {
        const { data, error } = await (supabase as any).rpc("admin_update_spammer_status", {
            p_user_id: userId,
            p_status: status,
            p_admin_note: null,
        });

        if (error) {
            toast({ title: "Error", description: error.message, variant: "destructive" });
            return;
        }

        if (data !== "ok") {
            toast({ title: "Error", description: "Could not update status", variant: "destructive" });
            return;
        }

        toast({ title: "Updated", description: `Marked as ${status}` });
        fetchSpammers();
    };

    const toggleBan = async (userId: string, currentStatus: boolean) => {
        const { error } = await supabase
            .from("profiles")
            .update({ is_banned: !currentStatus } as any)
            .eq("user_id", userId);

        if (error) {
            toast({ title: "Error", description: error.message, variant: "destructive" });
        } else {
            toast({
                title: currentStatus ? "User Unbanned" : "User Banned",
                description: `User status updated successfully.`,
            });
            fetchProfiles();
        }
    };

    const toggleVerification = async (userId: string, currentStatus: boolean) => {
        const { error } = await (supabase as any)
            .rpc("set_user_verified", { target_user_id: userId, verified: !currentStatus });

        if (error) {
            toast({ title: "Error", description: error.message, variant: "destructive" });
        } else {
            toast({
                title: currentStatus ? "Verification Removed" : "User Verified",
                description: `User verification status updated.`,
            });
            fetchProfiles();
        }
    };


    const filteredProfiles = useMemo(() => {
        return profiles.filter(
            (p) =>
                p.username.toLowerCase().includes(searchTerm.toLowerCase()) ||
                (p.display_name && p.display_name.toLowerCase().includes(searchTerm.toLowerCase()))
        );
    }, [profiles, searchTerm]);

    useEffect(() => {
        if (!isAuthorized) return;

        if (activeTab === "analytics") {
            fetchAnalytics();
        }

        if (activeTab === "spammers") {
            fetchSpammers();
        }

    }, [activeTab, isAuthorized]);

    if (!isAuthorized) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-background px-4">
                <div className="w-full max-w-md p-8 rounded-3xl bg-card border border-border shadow-2xl relative overflow-hidden">
                    <div className="absolute top-0 left-0 w-full h-1 bg-primary" />
                    <div className="flex flex-col items-center mb-8">
                        <div className="w-16 h-16 rounded-2xl gradient-bg flex items-center justify-center mb-4 shadow-lg shadow-primary/20">
                            <Shield className="w-8 h-8 text-white" />
                        </div>
                        <h1 className="text-2xl font-display font-bold text-foreground">Admin Access</h1>
                        <p className="text-muted-foreground text-sm">Enter secret credentials to proceed</p>
                    </div>

                    <form onSubmit={handleLogin} className="space-y-4">
                        <div className="space-y-2">
                            <label className="text-xs font-medium uppercase tracking-wider text-muted-foreground ml-1">Admin Name</label>
                            <Input
                                value={adminName}
                                onChange={(e) => setAdminName(e.target.value)}
                                placeholder="Enter admin name"
                                className="bg-muted/30 border-none rounded-xl h-12 focus-visible:ring-1 focus-visible:ring-primary"
                            />
                        </div>
                        <div className="space-y-2">
                            <label className="text-xs font-medium uppercase tracking-wider text-muted-foreground ml-1">Admin Secret</label>
                            <Input
                                type="password"
                                value={adminSecret}
                                onChange={(e) => setAdminSecret(e.target.value)}
                                placeholder="Enter admin secret"
                                className="bg-muted/30 border-none rounded-xl h-12 focus-visible:ring-1 focus-visible:ring-primary"
                            />
                        </div>
                        <Button type="submit" className="w-full h-12 rounded-xl gradient-bg text-white font-bold text-lg shadow-lg shadow-primary/20 transition-all hover:scale-[1.02] active:scale-[0.98] mt-4">
                            Unlock Terminal
                        </Button>
                    </form>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-background p-4 sm:p-8">
            <div className="max-w-6xl mx-auto">
                <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
                    <AlertDialogContent className="rounded-3xl">
                        <AlertDialogHeader>
                            <AlertDialogTitle>Delete post?</AlertDialogTitle>
                            <AlertDialogDescription>
                                This will permanently remove the post from the site and notify the user.
                            </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                            <AlertDialogCancel className="rounded-xl">Cancel</AlertDialogCancel>
                            <AlertDialogAction className="rounded-xl bg-destructive text-destructive-foreground hover:bg-destructive/90" onClick={confirmDeletePost}>
                                Delete
                            </AlertDialogAction>
                        </AlertDialogFooter>
                    </AlertDialogContent>
                </AlertDialog>

                <header className="flex flex-col sm:flex-row sm:items-center justify-between mb-6 gap-4">
                    <div>
                        <div className="flex items-center gap-2 mb-1">
                            <Shield className="w-5 h-5 text-primary" />
                            <span className="text-primary font-bold tracking-widest text-xs uppercase">Management Console</span>
                        </div>
                        <h1 className="text-3xl font-display font-bold text-foreground">Zeo Admin</h1>
                    </div>

                    {activeTab === "users" ? (
                        <div className="relative group">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground group-focus-within:text-primary transition-colors" />
                            <Input
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                                placeholder="Search users..."
                                className="pl-10 h-11 w-full sm:w-64 bg-card border-border rounded-xl focus-visible:ring-1 focus-visible:ring-primary shadow-sm"
                            />
                        </div>
                    ) : activeTab === "analytics" ? (
                        <div className="flex items-center gap-2">
                            <Button
                                variant="outline"
                                className="rounded-xl"
                                onClick={() => fetchAnalytics()}
                                disabled={analyticsLoading}
                            >
                                Refresh
                            </Button>
                        </div>
                    ) : (
                        <div className="flex items-center gap-2">
                            <Button
                                variant="outline"
                                className="rounded-xl"
                                onClick={() => fetchSpammers()}
                                disabled={spammersLoading}
                            >
                                Refresh
                            </Button>
                        </div>
                    )}
                </header>

                <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as any)} className="w-full">
                    <TabsList className="rounded-2xl">
                        <TabsTrigger value="users" className="rounded-xl">Users</TabsTrigger>
                        <TabsTrigger value="analytics" className="rounded-xl">Analytics</TabsTrigger>
                        <TabsTrigger value="spammers" className="rounded-xl">Spammers</TabsTrigger>
                    </TabsList>

                    <TabsContent value="users" className="mt-6">
                        <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
                            <div className="bg-card p-6 rounded-3xl border border-border shadow-sm">
                                <p className="text-muted-foreground text-sm mb-1">Total Users</p>
                                <p className="text-3xl font-display font-bold text-foreground">{profiles.length}</p>
                            </div>
                            <div className="bg-card p-6 rounded-3xl border border-border shadow-sm">
                                <p className="text-muted-foreground text-sm mb-1">Banned Users</p>
                                <p className="text-3xl font-display font-bold text-destructive">{profiles.filter(p => p.is_banned).length}</p>
                            </div>
                            <div className="bg-card p-6 rounded-3xl border border-border shadow-sm">
                                <p className="text-muted-foreground text-sm mb-1">Status</p>
                                <div className="flex items-center gap-2 mt-2">
                                    <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
                                    <p className="text-foreground font-medium uppercase tracking-wider text-xs">System Online</p>
                                </div>
                            </div>
                        </div>

                        <div className="bg-card rounded-3xl border border-border shadow-sm overflow-hidden overflow-x-auto">
                            <table className="w-full text-left border-collapse">
                                <thead>
                                    <tr className="bg-muted/30">
                                        <th className="p-4 font-display font-bold text-sm text-foreground">User</th>
                                        <th className="p-4 font-display font-bold text-sm text-foreground">Status</th>
                                        <th className="p-4 font-display font-bold text-sm text-foreground text-right">Actions</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-border">
                                    {loading ? (
                                        <tr>
                                            <td colSpan={3} className="p-10 text-center text-muted-foreground italic">Fetching data...</td>
                                        </tr>
                                    ) : filteredProfiles.map((p) => (
                                        <tr key={p.user_id} className="hover:bg-muted/10 transition-colors">
                                            <td className="p-4">
                                                <div className="flex items-center gap-3">
                                                    <div className="w-10 h-10 rounded-full gradient-bg flex items-center justify-center overflow-hidden flex-shrink-0">
                                                        {p.avatar_url ? (
                                                            <img src={p.avatar_url} alt="" className="w-full h-full object-cover" />
                                                        ) : (
                                                            <span className="text-white text-xs font-bold">{(p.display_name || p.username || "?")[0].toUpperCase()}</span>
                                                        )}
                                                    </div>
                                                    <div className="min-w-0">
                                                        <div className="flex items-center gap-1">
                                                            <p className="text-sm font-bold text-foreground truncate">{p.display_name || p.username}</p>
                                                            {p.is_verified && (
                                                                <CheckCircle className="w-3.5 h-3.5 text-primary fill-primary/20" />
                                                            )}
                                                        </div>
                                                        <p className="text-xs text-muted-foreground truncate">@{p.username}</p>
                                                    </div>
                                                </div>
                                            </td>
                                            <td className="p-4">
                                                <span className={`px-2 py-1 rounded-full text-[10px] uppercase font-bold tracking-wider ${p.is_banned ? "bg-destructive/10 text-destructive border border-destructive/20" : "bg-green-500/10 text-green-500 border border-green-500/20"}`}>
                                                    {p.is_banned ? "Banned" : "Active"}
                                                </span>
                                            </td>
                                            <td className="p-4 text-right">
                                                <div className="flex items-center justify-end gap-2">
                                                    <Button
                                                        variant={p.is_verified ? "secondary" : "outline"}
                                                        size="sm"
                                                        onClick={() => toggleVerification(p.user_id, p.is_verified)}
                                                        className={`rounded-xl h-8 text-[11px] font-bold ${p.is_verified ? "bg-primary/10 text-primary border-primary/20 hover:bg-primary/20" : ""}`}
                                                    >
                                                        <CheckCircle className={`w-3 h-3 mr-1 ${p.is_verified ? "fill-primary" : ""}`} />
                                                        {p.is_verified ? "Verified" : "Verify"}
                                                    </Button>
                                                    <Button
                                                        variant={p.is_banned ? "outline" : "destructive"}
                                                        size="sm"
                                                        onClick={() => toggleBan(p.user_id, p.is_banned)}
                                                        className="rounded-xl h-8 text-[11px] font-bold"
                                                    >
                                                        {p.is_banned ? <CheckCircle className="w-3 h-3 mr-1" /> : <Ban className="w-3 h-3 mr-1" />}
                                                        {p.is_banned ? "Unban" : "Ban"}
                                                    </Button>
                                                </div>
                                            </td>
                                        </tr>
                                    ))}
                                    {filteredProfiles.length === 0 && !loading && (
                                        <tr>
                                            <td colSpan={4} className="p-10 text-center text-muted-foreground">No users found.</td>
                                        </tr>
                                    )}
                                </tbody>
                            </table>
                        </div>
                    </TabsContent>

                    <TabsContent value="analytics" className="mt-6">
                        {analyticsError && (
                            <div className="mb-4 bg-destructive/10 border border-destructive/20 text-destructive rounded-2xl p-4 text-sm">
                                {analyticsError}
                            </div>
                        )}

                        <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
                            <div className="bg-card p-6 rounded-3xl border border-border shadow-sm">
                                <p className="text-muted-foreground text-sm mb-1">Users (total)</p>
                                <p className="text-3xl font-display font-bold text-foreground">{overview?.users_total ?? "—"}</p>
                                <p className="text-xs text-muted-foreground mt-2">+{overview?.users_24h ?? "—"} last 24h</p>
                            </div>
                            <div className="bg-card p-6 rounded-3xl border border-border shadow-sm">
                                <p className="text-muted-foreground text-sm mb-1">Posts (total)</p>
                                <p className="text-3xl font-display font-bold text-foreground">{overview?.posts_total ?? "—"}</p>
                                <p className="text-xs text-muted-foreground mt-2">+{overview?.posts_24h ?? "—"} last 24h</p>
                            </div>
                            <div className="bg-card p-6 rounded-3xl border border-border shadow-sm">
                                <p className="text-muted-foreground text-sm mb-1">Likes (total)</p>
                                <p className="text-3xl font-display font-bold text-foreground">{overview?.likes_total ?? "—"}</p>
                                <p className="text-xs text-muted-foreground mt-2">Follows: {overview?.follows_total ?? "—"}</p>
                            </div>
                            <div className="bg-card p-6 rounded-3xl border border-border shadow-sm">
                                <p className="text-muted-foreground text-sm mb-1">Comments (total)</p>
                                <p className="text-3xl font-display font-bold text-foreground">{overview?.comments_total ?? "—"}</p>
                                <p className="text-xs text-muted-foreground mt-2">+{overview?.posts_7d ?? "—"} posts last 7d</p>
                            </div>
                        </div>

                        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                            <div className="bg-card p-6 rounded-3xl border border-border shadow-sm">
                                <div className="flex items-center justify-between mb-4">
                                    <div>
                                        <p className="text-sm font-bold text-foreground">Top users by posts</p>
                                        <p className="text-xs text-muted-foreground">Most active creators</p>
                                    </div>
                                    {analyticsLoading && <p className="text-xs text-muted-foreground">Loading…</p>}
                                </div>
                                <div className="h-72">
                                    <ResponsiveContainer width="100%" height="100%">
                                        <BarChart data={topUsersByPosts.map((u) => ({
                                            name: u.username || "(no username)",
                                            posts: u.posts_count || 0,
                                        }))}>
                                            <CartesianGrid strokeDasharray="3 3" opacity={0.2} />
                                            <XAxis dataKey="name" tick={{ fontSize: 12 }} interval={0} angle={-20} height={60} />
                                            <YAxis allowDecimals={false} tick={{ fontSize: 12 }} />
                                            <Tooltip content={<ChartTooltip />} cursor={{ fill: "hsl(var(--muted))", opacity: 0.15 }} />
                                            <Bar dataKey="posts" fill="hsl(var(--primary))" radius={[8, 8, 0, 0]} />
                                        </BarChart>
                                    </ResponsiveContainer>
                                </div>
                            </div>

                            <div className="bg-card p-6 rounded-3xl border border-border shadow-sm">
                                <div className="flex items-center justify-between mb-4">
                                    <div>
                                        <p className="text-sm font-bold text-foreground">Top posts by likes</p>
                                        <p className="text-xs text-muted-foreground">Most liked content</p>
                                    </div>
                                    {analyticsLoading && <p className="text-xs text-muted-foreground">Loading…</p>}
                                </div>

                                <div className="space-y-3">
                                    {topPostsByLikes.map((p) => (
                                        <div key={p.post_id} className="p-4 rounded-2xl border border-border bg-muted/10">
                                            <div className="flex items-start justify-between gap-3">
                                                <div className="min-w-0">
                                                    <Link
                                                        to={`/post/${p.post_id}`}
                                                        className="text-sm text-foreground line-clamp-2 hover:text-primary transition-colors"
                                                        title="Open post"
                                                    >
                                                        {p.content || "(no text)"}
                                                    </Link>
                                                    <p className="text-xs text-muted-foreground mt-1">{p.created_at ? formatDistanceToNow(new Date(p.created_at), { addSuffix: true }) : ""}</p>

                                                    <div className="mt-2">
                                                        <Button
                                                            variant="destructive"
                                                            size="sm"
                                                            className="h-8 rounded-xl text-[11px] font-bold"
                                                            onClick={() => requestDeletePost(p.post_id)}
                                                        >
                                                            Delete
                                                        </Button>
                                                    </div>
                                                </div>
                                                <div className="flex-shrink-0 text-right">
                                                    <p className="text-sm font-bold text-foreground">{p.likes_count}</p>
                                                    <p className="text-[10px] uppercase tracking-wider text-muted-foreground">likes</p>
                                                </div>
                                            </div>
                                        </div>
                                    ))}

                                    {!analyticsLoading && topPostsByLikes.length === 0 && (
                                        <p className="text-sm text-muted-foreground">No data yet.</p>
                                    )}
                                </div>
                            </div>
                        </div>
                    </TabsContent>

                    <TabsContent value="spammers" className="mt-6">
                        {spammersError && (
                            <div className="mb-4 bg-destructive/10 border border-destructive/20 text-destructive rounded-2xl p-4 text-sm">
                                {spammersError}
                            </div>
                        )}

                        <div className="bg-card rounded-3xl border border-border shadow-sm overflow-hidden overflow-x-auto">
                            <table className="w-full text-left border-collapse">
                                <thead>
                                    <tr className="bg-muted/30">
                                        <th className="p-4 font-display font-bold text-sm text-foreground">User</th>
                                        <th className="p-4 font-display font-bold text-sm text-foreground">Warnings</th>
                                        <th className="p-4 font-display font-bold text-sm text-foreground">Last warning</th>
                                        <th className="p-4 font-display font-bold text-sm text-foreground text-right">Actions</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-border">
                                    {spammersLoading ? (
                                        <tr>
                                            <td colSpan={4} className="p-10 text-center text-muted-foreground italic">Fetching data...</td>
                                        </tr>
                                    ) : spammers.map((s) => (
                                        <tr key={s.user_id} className="hover:bg-muted/10 transition-colors">
                                            <td className="p-4">
                                                <div className="flex items-center gap-3">
                                                    <div className="w-10 h-10 rounded-full gradient-bg flex items-center justify-center overflow-hidden flex-shrink-0">
                                                        {s.avatar_url ? (
                                                            <img src={s.avatar_url} alt="" className="w-full h-full object-cover" />
                                                        ) : (
                                                            <span className="text-white text-xs font-bold">{(s.display_name || s.username || "?")[0].toUpperCase()}</span>
                                                        )}
                                                    </div>
                                                    <div className="min-w-0">
                                                        <p className="text-sm font-bold text-foreground truncate">{s.display_name || s.username}</p>
                                                        <p className="text-xs text-muted-foreground truncate">@{s.username}</p>
                                                    </div>
                                                </div>
                                            </td>
                                            <td className="p-4">
                                                <span className="px-2 py-1 rounded-full text-[10px] uppercase font-bold tracking-wider bg-destructive/10 text-destructive border border-destructive/20">
                                                    {s.warnings_count}
                                                </span>
                                            </td>
                                            <td className="p-4 text-sm text-muted-foreground">
                                                {s.last_warning_at ? formatDistanceToNow(new Date(s.last_warning_at), { addSuffix: true }) : "—"}
                                            </td>
                                            <td className="p-4 text-right">
                                                <div className="flex items-center justify-end gap-2">
                                                    <Button
                                                        variant="outline"
                                                        size="sm"
                                                        className="rounded-xl h-8 text-[11px] font-bold"
                                                        onClick={() => updateSpammerStatus(s.user_id, "reviewed")}
                                                    >
                                                        Reviewed
                                                    </Button>
                                                    <Button
                                                        variant="secondary"
                                                        size="sm"
                                                        className="rounded-xl h-8 text-[11px] font-bold"
                                                        onClick={() => updateSpammerStatus(s.user_id, "ignored")}
                                                    >
                                                        Ignore
                                                    </Button>
                                                </div>
                                            </td>
                                        </tr>
                                    ))}

                                    {!spammersLoading && spammers.length === 0 && (
                                        <tr>
                                            <td colSpan={4} className="p-10 text-center text-muted-foreground">No spammers right now.</td>
                                        </tr>
                                    )}
                                </tbody>
                            </table>
                        </div>
                    </TabsContent>
                </Tabs>
            </div>
        </div>
    );
};

export default AdminPanel;
