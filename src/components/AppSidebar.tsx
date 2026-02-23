import { Link, useLocation } from "react-router-dom";
import { Home, User, LogOut, Search, Bell } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";

const AppSidebar = () => {
  const { user, signOut } = useAuth();
  const location = useLocation();

  const links = [
    { to: "/feed", icon: Home, label: "Feed" },
    { to: "/search", icon: Search, label: "Search" },
    { to: `/profile/${user?.id}`, icon: User, label: "Profile" },
    { to: "/notifications", icon: Bell, label: "Notifications" },
  ];

  return (
    <aside className="hidden md:flex flex-col w-64 h-screen border-r border-border bg-card p-6 sticky top-0">
      <Link to="/feed" className="flex items-center gap-2 mb-10">
        <span className="font-display font-bold text-foreground text-lg">Zeo Matrix</span>
      </Link>

      <nav className="flex flex-col gap-1 flex-1">
        {links.map((l) => {
          const active = location.pathname === l.to;
          return (
            <Link
              key={l.to}
              to={l.to}
              className={`flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium transition-all ${active ? "bg-primary/10 text-primary" : "text-muted-foreground hover:text-foreground hover:bg-muted"}`}
            >
              <l.icon className="w-5 h-5" />
              {l.label}
            </Link>
          );
        })}
      </nav>

      <button onClick={signOut} className="flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium text-muted-foreground hover:text-destructive hover:bg-muted transition-all">
        <LogOut className="w-5 h-5" />
        Log out
      </button>
    </aside>
  );
};

export default AppSidebar;
