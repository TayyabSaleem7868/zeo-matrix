import { useEffect } from "react";
import { Outlet, useNavigate } from "react-router-dom";
import AppSidebar from "@/components/AppSidebar";
import MobileNav from "@/components/MobileNav";
import { PWAInstallButton } from "@/components/PWAInstallButton";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { SidebarProvider, useSidebar } from "@/hooks/useSidebar";
import { UnreadMessagesProvider } from "@/contexts/UnreadMessagesContext";

const AppLayoutContent = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const { isCollapsed } = useSidebar();

  useEffect(() => {
    if (!user) return;

    const checkBanStatus = async () => {
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

    // Subscribe to real-time ban updates
    const channel = supabase
      .channel(`user-profile-${user.id}`)
      .on(
        "postgres_changes",
        { 
          event: "UPDATE", 
          schema: "public", 
          table: "profiles", 
          filter: `user_id=eq.${user.id}` 
        },
        (payload) => {
          if (payload.new.is_banned) {
            navigate("/banned");
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user, navigate]);

  return (
    <div className="flex min-h-[100dvh] bg-background text-foreground overflow-x-hidden">
      <AppSidebar />
      <main 
        className={`flex-1 pb-20 md:pb-0 min-w-0 transition-all duration-300 ease-in-out ${
          isCollapsed ? "md:pl-16" : "md:pl-64"
        }`}
      >
        <div className="max-w-[1400px] mx-auto px-4 md:px-6">
          <Outlet />
        </div>
      </main>
      <div className="md:hidden fixed bottom-20 left-0 right-0 flex justify-center p-2 z-40 pointer-events-none">
        <div className="pointer-events-auto drop-shadow-md">
          <PWAInstallButton />
        </div>
      </div>
      <MobileNav />
    </div>
  );
};

const AppLayout = () => (
  <SidebarProvider>
    <UnreadMessagesProvider>
      <AppLayoutContent />
    </UnreadMessagesProvider>
  </SidebarProvider>
);

export default AppLayout;
