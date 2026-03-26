import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { ThemeProvider } from "@/components/ThemeProvider";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { useEffect } from "react";
import { AuthProvider } from "@/hooks/useAuth";
import { AdminAuthProvider } from "@/hooks/useAdminAuth";
import ProtectedRoute from "@/components/ProtectedRoute";
import Landing from "./pages/Landing";
import Login from "./pages/Login";
import Register from "./pages/Register";
import Feed from "./pages/Feed";
import Profile from "./pages/Profile";
import SearchUsers from "./pages/SearchUsers";
import AppLayout from "./layouts/AppLayout";
import AdminPanel from "./pages/AdminPanel";
import Banned from "./pages/Banned";
import PostDetail from "./pages/PostDetail";
import NotFound from "./pages/NotFound";
import Notifications from "./pages/Notifications";
import FollowersList from "./pages/FollowersList";
import FollowingList from "./pages/FollowingList";
import Inbox from "./pages/Inbox";
import ChatThread from "./pages/ChatThread";
import Settings from "./pages/Settings";
import { UnreadMessagesProvider } from "@/contexts/UnreadMessagesContext";
import { UnreadNotificationsProvider } from "@/contexts/UnreadNotificationsContext";

const queryClient = new QueryClient();

const ADMIN_ROUTE = import.meta.env.VITE_ADMIN_ROUTE || "secret-admin-access-x9z";

const AppContent = () => {
  useEffect(() => {
    // Determine if we are on a mobile-sized screen
    const isMobile = window.innerWidth <= 768;
    if (!isMobile) return;

    // We only want to attempt fullscreen once per session, but we must wait for a successful gesture
    const attemptFullscreen = () => {
      try {
        const docEl = document.documentElement as any;
        const requestFullScreen = docEl.requestFullscreen || docEl.webkitRequestFullscreen || docEl.msRequestFullscreen;

        // Only request if supported and not already in fullscreen
        if (requestFullScreen && !document.fullscreenElement && !(document as any).webkitFullscreenElement) {
          const promise = requestFullScreen.call(docEl);
          if (promise !== undefined) {
            promise
              .then(() => {
                // Success! We are in fullscreen. Remove the listener permanently.
                document.removeEventListener('click', attemptFullscreen);
              })
              .catch((err: any) => {
                // Failed (likely because the browser didn't register this specific click as a strong enough gesture).
                // We keep the listener active to try again on the next click.
                console.log(`Fullscreen request delayed: ${err.message}`);
              });
          } else {
             // For older browsers that don't return a promise, just assume it worked and remove.
             document.removeEventListener('click', attemptFullscreen);
          }
        } else if (document.fullscreenElement || (document as any).webkitFullscreenElement) {
           // Already in fullscreen, tidy up the listener.
           document.removeEventListener('click', attemptFullscreen);
        }
      } catch (e) {
        // Ignore errors on platforms where this is strictly forbidden (like iOS Safari)
        document.removeEventListener('click', attemptFullscreen);
      }
    };

    // Listen to 'click' (more reliable than touchstart for requesting fullscreen)
    document.addEventListener('click', attemptFullscreen);

    return () => {
      document.removeEventListener('click', attemptFullscreen);
    };
  }, []);

  return (
    <Routes>
      <Route path="/" element={<Landing />} />
      <Route path="/login" element={<Login />} />
      <Route path="/register" element={<Register />} />
      <Route element={<ProtectedRoute><AppLayout /></ProtectedRoute>}>
        <Route path="/feed" element={<Feed />} />
        <Route path="/post/:postId" element={<PostDetail />} />
        <Route path="/profile/:username" element={<Profile />} />
        <Route path="/profile/:username/followers" element={<FollowersList />} />
        <Route path="/profile/:username/following" element={<FollowingList />} />
        <Route path="/search" element={<SearchUsers />} />
        <Route path="/notifications" element={<Notifications />} />
        <Route path="/inbox" element={<Inbox />} />
        <Route path="/inbox/:conversationId" element={<ChatThread />} />
        <Route path="/settings" element={<Settings />} />
      </Route>
      <Route path={`/${ADMIN_ROUTE}`} element={<AdminPanel />} />
      <Route path="/banned" element={<Banned />} />
      <Route path="*" element={<NotFound />} />
    </Routes>
  );
};

const App = () => (
  <QueryClientProvider client={queryClient}>
    <ThemeProvider defaultTheme="dark" storageKey="vite-ui-theme" attribute="class">
      <TooltipProvider>
        <Toaster />
        <Sonner />
        <BrowserRouter>
          <AuthProvider>
            <AdminAuthProvider>
              <UnreadMessagesProvider>
                <UnreadNotificationsProvider>
                  <AppContent />
                </UnreadNotificationsProvider>
              </UnreadMessagesProvider>
            </AdminAuthProvider>
          </AuthProvider>
        </BrowserRouter>
      </TooltipProvider>
    </ThemeProvider>
  </QueryClientProvider>
);

export default App;
