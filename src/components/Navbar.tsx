import { Link, useLocation } from "react-router-dom";
import { Home, PlusSquare, User, LogOut, Layout, CheckCircle } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";

const Navbar = () => {
    const { user, signOut } = useAuth();
    const location = useLocation();
    const [profile, setProfile] = useState<{ username: string; display_name: string | null; avatar_url: string | null; is_verified?: boolean } | null>(null);

    useEffect(() => {
        const fetchProfile = async () => {
            if (!user) return;
            const { data } = await supabase.from("profiles").select("username, display_name, avatar_url, is_verified").eq("user_id", user.id).single();
            setProfile(data as any);
        };
        fetchProfile();
    }, [user]);

    const links = [
        { to: "/feed", icon: Home, label: "Home" },
        { to: "/feed", icon: PlusSquare, label: "Create" }, // For now, points to feed where CreatePost is
        { to: `/profile/${user?.id}`, icon: User, label: "Profile" },
    ];

    return (
        <nav className="fixed top-0 left-0 right-0 h-16 bg-[#0a0a0a]/80 backdrop-blur-md border-b border-white/5 z-[100] px-4 md:px-8 flex items-center justify-between">
            {/* Logo Section */}
            <Link to="/feed" className="flex items-center gap-3 group">
                <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-primary to-accent flex items-center justify-center shadow-lg group-hover:scale-105 transition-transform">
                    <Layout className="w-5 h-5 text-white" />
                </div>
                <span className="font-display font-bold text-white text-lg tracking-tight hidden sm:block">
                    Zeo <span className="text-primary/80">Matrix</span>
                </span>
            </Link>

            {/* Centered Links */}
            <div className="hidden md:flex items-center bg-white/5 rounded-full px-2 py-1 border border-white/5">
                {links.map((l) => {
                    const active = location.pathname === l.to;
                    return (
                        <Link
                            key={l.label}
                            to={l.to}
                            className={`flex items-center gap-2 px-5 py-2 rounded-full text-sm font-medium transition-all ${active
                                ? "bg-white/10 text-white shadow-sm"
                                : "text-muted-foreground hover:text-white hover:bg-white/5"
                                }`}
                        >
                            <l.icon className="w-4 h-4" />
                            {l.label}
                        </Link>
                    );
                })}
            </div>

            {/* User Section */}
            <div className="flex items-center gap-4">
                {user && (
                    <div className="flex items-center gap-3 pl-3 pr-1 py-1 bg-white/5 rounded-full border border-white/5">
                        <div className="w-7 h-7 rounded-full overflow-hidden border border-white/10 flex-shrink-0">
                            {profile?.avatar_url ? (
                                <img src={profile.avatar_url} alt="" className="w-full h-full object-cover" />
                            ) : (
                                <div className="w-full h-full gradient-bg flex items-center justify-center">
                                    <span className="text-[10px] font-bold text-white">{(profile?.display_name || profile?.username || "?")[0].toUpperCase()}</span>
                                </div>
                            )}
                        </div>
                        <span className="text-sm font-medium text-white hidden sm:flex items-center gap-1 truncate max-w-[120px]">
                            {profile?.display_name || profile?.username?.split("@")[0] || "User"}
                            {profile?.is_verified && <CheckCircle className="w-3 h-3 text-blue-500 fill-blue-500/20 flex-shrink-0" />}
                        </span>
                        <button
                            onClick={signOut}
                            className="p-1.5 hover:bg-destructive/10 hover:text-destructive text-muted-foreground rounded-full transition-colors"
                            title="Logout"
                        >
                            <LogOut className="w-4 h-4" />
                        </button>
                    </div>
                )}
            </div>
        </nav>
    );
};

export default Navbar;
