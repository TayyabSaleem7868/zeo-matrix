import { Link, useLocation } from "react-router-dom";
import { Home, Search, User, LogOut } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";

const MobileNav = () => {
  const { user, signOut } = useAuth();
  const location = useLocation();

  const links = [
    { to: "/feed", icon: Home },
    { to: "/search", icon: Search },
    { to: `/profile/${user?.id}`, icon: User },
  ];

  return (
    <nav className="md:hidden fixed bottom-0 left-0 right-0 bg-card border-t border-border flex justify-around items-center py-3 z-50">
      {links.map((l) => {
        const active = location.pathname === l.to;
        return (
          <Link key={l.to} to={l.to} className={`p-2 rounded-xl transition-colors ${active ? "text-primary" : "text-muted-foreground"}`}>
            <l.icon className="w-6 h-6" />
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
