import { useEffect } from "react";
import { Outlet, useNavigate } from "react-router-dom";
import AppSidebar from "@/components/AppSidebar";
import MobileNav from "@/components/MobileNav";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";

const AppLayout = () => {
  const { user } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    const checkBanStatus = async () => {
      if (!user) return;

      const { data, error } = await supabase
        .from("profiles")
        .select("is_banned")
        .eq("user_id", user.id)
        .maybeSingle();

      if (!error && (data as any)?.is_banned) {
        navigate("/banned");
      }
    };

    checkBanStatus();
  }, [user, navigate]);

  return (
    <div className="flex min-h-screen bg-background text-foreground">
      <AppSidebar />
      <main className="flex-1 pb-20 md:pb-0 min-w-0">
        <div className="max-w-[1400px] mx-auto">
          <Outlet />
        </div>
      </main>
      <MobileNav />
    </div>
  );
};

export default AppLayout;
