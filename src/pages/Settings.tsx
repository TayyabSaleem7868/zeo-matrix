import { useState, useEffect } from "react";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { useTheme } from "next-themes";
import { useToast } from "@/hooks/use-toast";
import { 
  Settings as SettingsIcon, 
  User, 
  Lock, 
  Eye, 
  Moon, 
  Sun, 
  Bell, 
  ShieldAlert,
  Trash2,
  ChevronRight,
  Monitor
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { 
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";

const Settings = () => {
  const { user } = useAuth();
  const { theme, setTheme } = useTheme();
  const { toast } = useToast();
  const [profile, setProfile] = useState<any>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchProfile = async () => {
      if (!user) return;
      const { data } = await supabase
        .from("profiles")
        .select("*")
        .eq("user_id", user.id)
        .single();
      setProfile(data);
      setLoading(false);
    };
    fetchProfile();
  }, [user]);

  const togglePrivate = async (checked: boolean) => {
    if (!user) return;
    try {
      const { error } = await supabase
        .from("profiles")
        .update({ is_private: checked } as any)
        .eq("user_id", user.id);
      if (error) throw error;
      setProfile({ ...profile, is_private: checked });
      toast({ title: checked ? "Account is now private" : "Account is now public" });
    } catch (e: any) {
      toast({ title: "Error", description: e?.message || "Failed to update privacy", variant: "destructive" });
    }
  };

  const toggleHideFollowers = async (checked: boolean) => {
    if (!user) return;
    try {
      const { error } = await supabase
        .from("profiles")
        .update({ hide_followers: checked } as any)
        .eq("user_id", user.id);
      if (error) throw error;
      setProfile({ ...profile, hide_followers: checked });
      toast({ title: checked ? "Followers hidden" : "Followers visible" });
    } catch (e: any) {
      toast({ title: "Error", description: e?.message || "Failed to update followers privacy", variant: "destructive" });
    }
  };

  const toggleHideFollowing = async (checked: boolean) => {
    if (!user) return;
    try {
      const { error } = await supabase
        .from("profiles")
        .update({ hide_following: checked } as any)
        .eq("user_id", user.id);
      if (error) throw error;
      setProfile({ ...profile, hide_following: checked });
      toast({ title: checked ? "Following hidden" : "Following visible" });
    } catch (e: any) {
      toast({ title: "Error", description: e?.message || "Failed to update following privacy", variant: "destructive" });
    }
  };

  const handleDeleteAccount = async () => {
    setIsDeleting(true);
    try {
      const { error } = await supabase.rpc("delete_user_account");
      if (error) throw error;

      await supabase.auth.signOut();
      toast({ title: "Account Deleted", description: "Your account has been successfully removed." });
      window.location.href = "/";
    } catch (error: any) {
      toast({ title: "Deletion failed", description: error.message, variant: "destructive" });
      setIsDeleting(false);
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center py-20">
        <div className="w-8 h-8 rounded-full border-2 border-primary border-t-transparent animate-spin" />
      </div>
    );
  }

  return (
    <div className="max-w-3xl mx-auto px-4 py-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="flex items-center gap-3 mb-8">
        <div className="p-2.5 rounded-2xl bg-primary/20 border border-primary/20">
          <SettingsIcon className="w-6 h-6 text-primary" />
        </div>
        <div>
          <h1 className="text-3xl font-display font-bold text-foreground tracking-tight">Settings</h1>
          <p className="text-muted-foreground text-sm">Manage your account preferences and security</p>
        </div>
      </div>

      <div className="space-y-6">
        {/* Account Section */}
        <section className="bg-background/60 backdrop-blur-xl border-2 border-border/50 rounded-3xl overflow-hidden shadow-xl">
          <div className="px-6 py-4 border-b border-border/50 bg-muted/30">
            <h2 className="flex items-center gap-2 font-display font-bold text-foreground">
              <User className="w-4 h-4 text-primary" /> Account
            </h2>
          </div>
          <div className="p-6 space-y-4">
            <div className="flex items-center justify-between p-4 rounded-2xl bg-muted/20 border border-border/30">
              <div className="min-w-0">
                <p className="text-sm font-bold text-foreground">Username</p>
                <p className="text-xs text-muted-foreground truncate">@{profile?.username}</p>
              </div>
              <Button variant="outline" size="sm" className="rounded-xl h-8 text-[11px] font-bold" disabled>
                Claimed
              </Button>
            </div>
            <div className="flex items-center justify-between p-4 rounded-2xl bg-muted/20 border border-border/30">
              <div className="min-w-0">
                <p className="text-sm font-bold text-foreground">Email Address</p>
                <p className="text-xs text-muted-foreground truncate">{user?.email}</p>
              </div>
              <Lock className="w-4 h-4 text-muted-foreground/50" />
            </div>
          </div>
        </section>

        {/* Privacy Section */}
        <section className="bg-background/60 backdrop-blur-xl border-2 border-border/50 rounded-3xl overflow-hidden shadow-xl">
          <div className="px-6 py-4 border-b border-border/50 bg-muted/30">
            <h2 className="flex items-center gap-2 font-display font-bold text-foreground">
              <Eye className="w-4 h-4 text-primary" /> Privacy
            </h2>
          </div>
          <div className="p-6">
            <div className="flex items-center justify-between">
              <div className="max-w-[80%]">
                <p className="text-sm font-bold text-foreground">Private Account</p>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Only people you approve can see your posts and followers.
                </p>
              </div>
              <Switch 
                checked={profile?.is_private || false} 
                onCheckedChange={togglePrivate}
              />
            </div>
            
            <div className="flex items-center justify-between pt-6 border-t border-border/20 mt-6">
              <div className="max-w-[80%]">
                <p className="text-sm font-bold text-foreground">Hide Followers List</p>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Prevent others from seeing who follows you.
                </p>
              </div>
              <Switch 
                checked={profile?.hide_followers || false} 
                onCheckedChange={toggleHideFollowers}
              />
            </div>

            <div className="flex items-center justify-between pt-6 border-t border-border/20 mt-6">
              <div className="max-w-[80%]">
                <p className="text-sm font-bold text-foreground">Hide Following List</p>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Prevent others from seeing who you follow.
                </p>
              </div>
              <Switch 
                checked={profile?.hide_following || false} 
                onCheckedChange={toggleHideFollowing}
                className="data-[state=checked]:bg-primary"
              />
            </div>
          </div>
        </section>

        {/* Appearance Section */}
        <section className="bg-background/60 backdrop-blur-xl border-2 border-border/50 rounded-3xl overflow-hidden shadow-xl">
          <div className="px-6 py-4 border-b border-border/50 bg-muted/30">
            <h2 className="flex items-center gap-2 font-display font-bold text-foreground">
              <Moon className="w-4 h-4 text-primary" /> Appearance
            </h2>
          </div>
          <div className="p-6">
            <div className="grid grid-cols-3 gap-3">
              <button 
                onClick={() => setTheme("light")}
                className={`p-4 rounded-2xl border-2 transition-all flex flex-col items-center gap-2 ${theme === "light" ? "border-primary bg-primary/5 shadow-glow" : "border-border/50 bg-muted/20 hover:border-border"}`}
              >
                <Sun className={`w-6 h-6 ${theme === "light" ? "text-primary" : "text-muted-foreground"}`} />
                <span className={`text-[11px] font-bold uppercase tracking-wider ${theme === "light" ? "text-primary" : "text-muted-foreground"}`}>Light</span>
              </button>
              <button 
                onClick={() => setTheme("dark")}
                className={`p-4 rounded-2xl border-2 transition-all flex flex-col items-center gap-2 ${theme === "dark" ? "border-primary bg-primary/5 shadow-glow" : "border-border/50 bg-muted/20 hover:border-border"}`}
              >
                <Moon className={`w-6 h-6 ${theme === "dark" ? "text-primary" : "text-muted-foreground"}`} />
                <span className={`text-[11px] font-bold uppercase tracking-wider ${theme === "dark" ? "text-primary" : "text-muted-foreground"}`}>Dark</span>
              </button>
              <button 
                onClick={() => setTheme("system")}
                className={`p-4 rounded-2xl border-2 transition-all flex flex-col items-center gap-2 ${theme === "system" ? "border-primary bg-primary/5 shadow-glow" : "border-border/50 bg-muted/20 hover:border-border"}`}
              >
                <Monitor className={`w-6 h-6 ${theme === "system" ? "text-primary" : "text-muted-foreground"}`} />
                <span className={`text-[11px] font-bold uppercase tracking-wider ${theme === "system" ? "text-primary" : "text-muted-foreground"}`}>System</span>
              </button>
            </div>
          </div>
        </section>

        {/* Notifications Section */}
        <section className="bg-background/60 backdrop-blur-xl border-2 border-border/50 rounded-3xl overflow-hidden shadow-xl">
          <div className="px-6 py-4 border-b border-border/50 bg-muted/30">
            <h2 className="flex items-center gap-2 font-display font-bold text-foreground">
              <Bell className="w-4 h-4 text-primary" /> Notifications
            </h2>
          </div>
          <div className="p-6 space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-bold text-foreground">Push Notifications</p>
                <p className="text-xs text-muted-foreground mt-0.5">Receive alerts for new followers and mentions.</p>
              </div>
              <Switch defaultChecked className="data-[state=checked]:bg-primary" />
            </div>
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-bold text-foreground">Email Digest</p>
                <p className="text-xs text-muted-foreground mt-0.5">Weekly summary of activity you might have missed.</p>
              </div>
              <Switch className="data-[state=checked]:bg-primary" />
            </div>
          </div>
        </section>

        {/* Danger Zone */}
        <section className="bg-destructive/5 backdrop-blur-xl border-2 border-destructive/30 rounded-3xl overflow-hidden shadow-xl shadow-destructive/5">
          <div className="px-6 py-4 border-b border-destructive/20 bg-destructive/10">
            <h2 className="flex items-center gap-2 font-display font-bold text-destructive uppercase tracking-widest text-xs">
              <ShieldAlert className="w-4 h-4" /> Danger Zone
            </h2>
          </div>
          <div className="p-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div>
                <p className="text-sm font-bold text-foreground">Delete Account</p>
                <p className="text-[11px] text-muted-foreground mt-0.5 max-w-[400px]">
                  Permanently remove all your content, followers, and account data. <b>This action is irreversible.</b>
                </p>
              </div>
              
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button variant="destructive" className="rounded-xl h-10 font-bold px-6 shadow-lg shadow-destructive/20 transition-all hover:scale-[1.02] active:scale-[0.98]">
                    <Trash2 className="w-4 h-4 mr-2" /> Delete Account
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent className="bg-background/60 backdrop-blur-xl border-border/50 border-2 rounded-3xl shadow-2xl">
                  <AlertDialogHeader>
                    <AlertDialogTitle className="text-xl font-bold text-foreground flex items-center gap-2">
                      <ShieldAlert className="w-6 h-6 text-destructive" /> Final Warning
                    </AlertDialogTitle>
                    <AlertDialogDescription className="text-muted-foreground text-sm pt-2">
                      Are you absolutely certain? This will purge your entire history, posts, and identity from Zeo Matrix. 
                      You cannot undo this operation.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter className="pt-4 gap-2 sm:gap-0">
                    <AlertDialogCancel className="bg-secondary text-foreground hover:bg-secondary/80 rounded-2xl px-6 border-0">Stay with us</AlertDialogCancel>
                    <AlertDialogAction
                      onClick={handleDeleteAccount}
                      className="bg-destructive text-white hover:bg-destructive/90 transition-all font-bold rounded-2xl px-8"
                      disabled={isDeleting}
                    >
                      {isDeleting ? "Deleting..." : "Delete Permanently"}
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            </div>
          </div>
        </section>
      </div>
      
      <div className="mt-12 text-center">
        <p className="text-[10px] text-muted-foreground font-medium uppercase tracking-[0.2em]">
          Zeo Matrix v1.0.4 • Made with love
        </p>
      </div>
    </div>
  );
};

export default Settings;
