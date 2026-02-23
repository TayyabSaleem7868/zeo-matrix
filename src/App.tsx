import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
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

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <AuthProvider>
          <AdminAuthProvider>
            <Routes>
              <Route path="/" element={<Landing />} />
              <Route path="/login" element={<Login />} />
              <Route path="/register" element={<Register />} />
              <Route element={<ProtectedRoute><AppLayout /></ProtectedRoute>}>
                <Route path="/feed" element={<Feed />} />
                <Route path="/post/:postId" element={<PostDetail />} />
                <Route path="/profile/:userId" element={<Profile />} />
                <Route path="/profile/:userId/followers" element={<FollowersList />} />
                <Route path="/profile/:userId/following" element={<FollowingList />} />
                <Route path="/search" element={<SearchUsers />} />
                <Route path="/notifications" element={<Notifications />} />
              </Route>
              <Route path="/secret-admin-access-x9z" element={<AdminPanel />} />
              <Route path="/banned" element={<Banned />} />
              <Route path="*" element={<NotFound />} />
            </Routes>
          </AdminAuthProvider>
        </AuthProvider>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
