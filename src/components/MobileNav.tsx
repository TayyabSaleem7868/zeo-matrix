import { Link, useLocation } from "react-router-dom";
import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Home, Search, User, Bell, LogOut, MessageCircle } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { PWAInstallButton } from "./PWAInstallButton";
import { useUnreadContext } from "@/contexts/UnreadMessagesContext";
import { useUnreadNotificationsContext } from "@/contexts/UnreadNotificationsContext";

const MobileNav = () => {
  const { user, signOut } = useAuth();
  const location = useLocation();
  const { totalUnread: totalUnreadMessages } = useUnreadContext();
  const { unreadCount: unreadNotificationsCount } = useUnreadNotificationsContext();
  const [profile, setProfile] = useState<{ username: string } | null>(null);

  useEffect(() => {
    const fetchProfile = async () => {
      if (!user) return;
      const { data } = await supabase
        .from("profiles")
        .select("username")
        .eq("user_id", user.id)
        .maybeSingle();
      if (data) setProfile(data as any);
    };
    fetchProfile();
  }, [user]);

  const links = [
    { to: "/feed", icon: Home },
    { to: "/search", icon: Search },
    { to: "/inbox", icon: MessageCircle, showBadge: totalUnreadMessages > 0 },
    ...(user?.id && profile?.username ? [{ to: `/profile/${profile.username}`, icon: User }] : []),
    { to: "/notifications", icon: Bell, showBadge: unreadNotificationsCount > 0 },
  ];

  return (
    <nav className="md:hidden fixed bottom-0 left-0 right-0 bg-background/60 backdrop-blur-xl border-t border-border/50 flex justify-around items-center py-3 z-50">
      {links.map((l) => {
        const active = location.pathname === l.to;
        return (
          <Link key={l.to} to={l.to} className={`p-2 rounded-xl transition-colors relative ${active ? "text-primary" : "text-muted-foreground"}`}>
            <l.icon className="w-6 h-6" />
            {(l as any).showBadge && (
              <span className="absolute top-0.5 right-0 flex h-3 w-3">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-500 opacity-75" />
                <span className="relative inline-flex rounded-full h-3 w-3 bg-red-500 border-2 border-background" />
              </span>
            )}
          </Link>
        );
      })}
      <button onClick={signOut} className="p-2 text-muted-foreground hover:text-destructive transition-colors">
        <LogOut className="w-6 h-6" />
      </button>
    </nav>
  );
};

export default MobileNav;

