import { Link, useLocation } from "react-router-dom";
import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Home, User, LogOut, Search, Bell, MessageCircle, PanelLeft } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { PWAInstallButton } from "./PWAInstallButton";
import { useSidebar } from "@/hooks/useSidebar";
import { useUnreadContext } from "@/contexts/UnreadMessagesContext";
import { useUnreadNotificationsContext } from "@/contexts/UnreadNotificationsContext";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";

const AppSidebar = () => {
  const { user, signOut } = useAuth();
  const { isCollapsed, toggleSidebar } = useSidebar();
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
    { to: "/feed", icon: Home, label: "Feed" },
    { to: "/search", icon: Search, label: "Search" },
    { to: "/inbox", icon: MessageCircle, label: "Inbox", showBadge: totalUnreadMessages > 0, count: totalUnreadMessages },
    ...(user?.id && profile?.username ? [{ to: `/profile/${profile.username}`, icon: User, label: "Profile" }] : []),
    { to: "/notifications", icon: Bell, label: "Notifications", showBadge: unreadNotificationsCount > 0, count: unreadNotificationsCount },
  ];

  return (
    <aside 
      className={`hidden md:flex flex-col h-[100dvh] border-r border-border bg-background/60 backdrop-blur-xl transition-all duration-300 ease-in-out fixed top-0 left-0 z-50 ${
        isCollapsed ? "w-16 px-2" : "w-64 px-6"
      }`}
    >
      <div className={`flex items-center mb-6 mt-3 ${isCollapsed ? "justify-center" : "justify-between"}`}>
        {!isCollapsed && (
          <Link to="/feed" className="flex items-center gap-2">
            <span className="font-display font-bold text-foreground text-lg truncate tracking-tight">Zeo Matrix</span>
          </Link>
        )}
        <Tooltip>
          <TooltipTrigger asChild>
            <button
              onClick={toggleSidebar}
              className={`p-2 rounded-xl hover:bg-muted transition-all active:scale-95 text-muted-foreground hover:text-foreground ${
                isCollapsed ? "bg-muted/50" : ""
              }`}
            >
              <PanelLeft className={`w-5 h-5 transition-transform duration-300 ${isCollapsed ? "rotate-180" : ""}`} />
            </button>
          </TooltipTrigger>
          <TooltipContent side="right">
            {isCollapsed ? "Open sidebar" : "Hide sidebar"}
          </TooltipContent>
        </Tooltip>
      </div>

      <nav className="flex flex-col gap-2 flex-1 pt-2">
        {links.map((l) => {
          const active = location.pathname === l.to;
          const linkContent = (
            <Link
              key={l.to}
              to={l.to}
              className={`flex items-center rounded-xl text-sm font-medium transition-all group relative ${
                isCollapsed ? "justify-center p-3" : "gap-3 px-4 py-3"
              } ${
                active 
                  ? "bg-primary/15 text-primary shadow-sm" 
                  : "text-muted-foreground hover:text-foreground hover:bg-muted/80"
              }`}
            >
              <span className="relative">
                <l.icon className={`transition-all ${isCollapsed ? "w-6 h-6" : "w-5 h-5"} ${active ? "scale-110" : "group-hover:scale-110"}`} />
                {(l as any).showBadge && (
                  <span className="absolute -top-1.5 -right-1.5 flex h-3.5 w-3.5">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-500 opacity-75" />
                    <span className="relative inline-flex rounded-full h-3.5 w-3.5 bg-red-500 border-2 border-card" />
                  </span>
                )}
              </span>
              {!isCollapsed && (
                <span className="truncate flex-1">{l.label}</span>
              )}
              {!isCollapsed && (l as any).showBadge && (
                <span className="ml-auto bg-red-500 text-white text-[10px] font-bold rounded-full min-w-[20px] h-5 flex items-center justify-center px-1.5">
                  {(l as any).count > 99 ? "99+" : (l as any).count}
                </span>
              )}
            </Link>
          );

          if (isCollapsed) {
            return (
              <Tooltip key={l.to}>
                <TooltipTrigger asChild>
                  {linkContent}
                </TooltipTrigger>
                <TooltipContent side="right">
                  {l.label}
                </TooltipContent>
              </Tooltip>
            );
          }

          return linkContent;
        })}
      </nav>

      <div className={`mt-auto mb-6 flex flex-col gap-3 ${isCollapsed ? "items-center" : ""}`}>
        {!isCollapsed && <PWAInstallButton />}
        <Tooltip>
          <TooltipTrigger asChild>
            <button 
              onClick={signOut} 
              className={`flex items-center rounded-xl text-sm font-medium text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-all ${
                isCollapsed ? "justify-center p-3" : "gap-3 px-4 py-3"
              }`}
            >
              <LogOut className={isCollapsed ? "w-6 h-6" : "w-5 h-5"} />
              {!isCollapsed && <span>Log out</span>}
            </button>
          </TooltipTrigger>
          {isCollapsed && <TooltipContent side="right">Log out</TooltipContent>}
        </Tooltip>
      </div>
    </aside>
  );
};

export default AppSidebar;
