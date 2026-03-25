import { Link, useLocation } from "react-router-dom";
import { Home, User, LogOut, Search, Bell, MessageCircle, PanelLeft } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { PWAInstallButton } from "./PWAInstallButton";
import { useSidebar } from "@/hooks/useSidebar";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";

const AppSidebar = () => {
  const { user, signOut } = useAuth();
  const { isCollapsed, toggleSidebar } = useSidebar();
  const location = useLocation();

  const links = [
    { to: "/feed", icon: Home, label: "Feed" },
    { to: "/search", icon: Search, label: "Search" },
    { to: "/inbox", icon: MessageCircle, label: "Inbox" },
    ...(user?.id ? [{ to: `/profile/${user.id}`, icon: User, label: "Profile" }] : []),
    { to: "/notifications", icon: Bell, label: "Notifications" },
  ];

  return (
    <aside 
      className={`hidden md:flex flex-col h-[100dvh] border-r border-border bg-card transition-all duration-300 ease-in-out fixed top-0 left-0 z-50 ${
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
              className={`flex items-center rounded-xl text-sm font-medium transition-all group ${
                isCollapsed ? "justify-center p-3" : "gap-3 px-4 py-3"
              } ${
                active 
                  ? "bg-primary/15 text-primary shadow-sm" 
                  : "text-muted-foreground hover:text-foreground hover:bg-muted/80"
              }`}
            >
              <l.icon className={`transition-all ${isCollapsed ? "w-6 h-6" : "w-5 h-5"} ${active ? "scale-110" : "group-hover:scale-110"}`} />
              {!isCollapsed && <span className="truncate">{l.label}</span>}
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
