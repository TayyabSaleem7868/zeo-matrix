import { useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Ban, LogOut } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";

const Banned = () => {
    const navigate = useNavigate();
    const { user } = useAuth();

    useEffect(() => {
        const checkStatus = async () => {
            if (!user) {
                navigate("/login");
                return;
            }

            const { data } = await supabase
                .from("profiles")
                .select("is_banned")
                .eq("user_id", user.id)
                .maybeSingle();

            if (!data?.is_banned) {
                navigate("/feed");
            }
        };

        checkStatus();
    }, [user, navigate]);

    const handleLogout = async () => {
        await supabase.auth.signOut();
        navigate("/");
    };

    return (
        <div className="min-h-screen flex items-center justify-center bg-background px-4">
            <div className="w-full max-w-md p-10 rounded-[32px] bg-card border border-border shadow-2xl text-center relative overflow-hidden">
                <div className="absolute top-0 left-0 w-full h-1 bg-destructive" />

                <div className="w-20 h-20 rounded-3xl bg-destructive/10 flex items-center justify-center mx-auto mb-6 shadow-lg shadow-destructive/10">
                    <Ban className="w-10 h-10 text-destructive" />
                </div>

                <h1 className="text-3xl font-display font-bold text-foreground mb-4">Account Banned</h1>

                <p className="text-muted-foreground leading-relaxed mb-8 text-sm">
                    Your access to Zeo Matrix has been suspended due to a violation of our community guidelines.
                    If you believe this is a mistake, please contact support.
                </p>

                <Button
                    onClick={handleLogout}
                    variant="outline"
                    className="w-full h-12 rounded-2xl hover:bg-destructive/5 hover:text-destructive hover:border-destructive transition-all flex items-center justify-center gap-2 font-bold"
                >
                    <LogOut className="w-4 h-4" />
                    Logout from Network
                </Button>
            </div>
        </div>
    );
};

export default Banned;
