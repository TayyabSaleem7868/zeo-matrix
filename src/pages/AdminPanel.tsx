import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { Shield, Users, Ban, CheckCircle, Search, Mail, User, Clock } from "lucide-react";
import { formatDistanceToNow } from "date-fns";

const ADMIN_CREDENTIALS = {
    NAME: "ZAROON",
    SECRET: "ZAROON_IS_TRUE_ADMIN",
};

const AdminPanel = () => {
    const { user } = useAuth();
    const { toast } = useToast();
    const [isAuthorized, setIsAuthorized] = useState(false);
    const [adminName, setAdminName] = useState("");
    const [adminSecret, setAdminSecret] = useState("");
    const [profiles, setProfiles] = useState<any[]>([]);
    const [loading, setLoading] = useState(false);
    const [searchTerm, setSearchTerm] = useState("");

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


    const filteredProfiles = profiles.filter(
        (p) =>
            p.username.toLowerCase().includes(searchTerm.toLowerCase()) ||
            (p.display_name && p.display_name.toLowerCase().includes(searchTerm.toLowerCase()))
    );

    if (!isAuthorized) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-background px-4">
                <div className="w-full max-w-md p-8 rounded-3xl bg-card border border-border shadow-2xl relative overflow-hidden">
                    <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-primary to-accent" />
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
                <header className="flex flex-col sm:flex-row sm:items-center justify-between mb-10 gap-4">
                    <div>
                        <div className="flex items-center gap-2 mb-1">
                            <Shield className="w-5 h-5 text-primary" />
                            <span className="text-primary font-bold tracking-widest text-xs uppercase">Management Console</span>
                        </div>
                        <h1 className="text-3xl font-display font-bold text-foreground">Zeo Admin</h1>
                    </div>
                    <div className="relative group">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground group-focus-within:text-primary transition-colors" />
                        <Input
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            placeholder="Search users..."
                            className="pl-10 h-11 w-full sm:w-64 bg-card border-border rounded-xl focus-visible:ring-1 focus-visible:ring-primary shadow-sm"
                        />
                    </div>
                </header>

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
                                                        <CheckCircle className="w-3.5 h-3.5 text-blue-500 fill-blue-500/20" />
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
                                                className={`rounded-xl h-8 text-[11px] font-bold ${p.is_verified ? "bg-blue-500/10 text-blue-500 border-blue-500/20 hover:bg-blue-500/20" : ""}`}
                                            >
                                                <CheckCircle className={`w-3 h-3 mr-1 ${p.is_verified ? "fill-blue-500" : ""}`} />
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
            </div>
        </div>
    );
};

export default AdminPanel;
