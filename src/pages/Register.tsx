import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

const Register = () => {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [username, setUsername] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();
  const { toast } = useToast();

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    if (username.length < 3) {
      toast({ title: "Username too short", description: "At least 3 characters.", variant: "destructive" });
      return;
    }
    setLoading(true);
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: { username, display_name: displayName || username },
        emailRedirectTo: window.location.origin,
      },
    });

    // Safety net: some DB/RLS/trigger setups can fail to create the profile row during signup.
    // If we immediately have a session + user, ensure the profile exists.
    if (!error && data?.user && data?.session) {
      const profilePayload = {
        user_id: data.user.id,
        username,
        display_name: displayName || username,
      };

      const { error: profileError } = await supabase
        .from("profiles")
        .upsert(profilePayload, { onConflict: "user_id" });

      if (profileError) {
        // Don't hard-fail signup; surface a message that points to the real issue.
        console.error("Profile upsert failed after signup:", profileError);
      }
    }
    setLoading(false);
    if (error) {
      toast({ title: "Signup failed", description: error.message, variant: "destructive" });
    } else {
      navigate("/feed");
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-background relative">
      <div className="absolute inset-0 overflow-hidden">
        <div className="absolute bottom-1/3 right-1/3 w-96 h-96 rounded-full bg-accent/10 blur-[120px]" />
      </div>
      <div className="w-full max-w-md mx-4 p-8 rounded-2xl bg-card border border-border relative z-10">
        <div className="text-center mb-8">
          <h1 className="text-2xl font-display font-bold text-foreground">Join the network</h1>
          <p className="text-sm text-muted-foreground mt-1">Create your Zeo Matrix account</p>
        </div>
        <form onSubmit={handleRegister} className="space-y-4">
          <div>
            <Label htmlFor="username">Username</Label>
            <Input id="username" value={username} onChange={(e) => setUsername(e.target.value)} placeholder="johndoe" required />
          </div>
          <div>
            <Label htmlFor="displayName">Display Name</Label>
            <Input id="displayName" value={displayName} onChange={(e) => setDisplayName(e.target.value)} placeholder="John Doe" />
          </div>
          <div>
            <Label htmlFor="email">Email</Label>
            <Input id="email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@example.com" required />
          </div>
          <div>
            <Label htmlFor="password">Password</Label>
            <Input id="password" type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="••••••••" required minLength={6} />
          </div>
          <Button type="submit" variant="hero" className="w-full" disabled={loading}>
            {loading ? "Creating account..." : "Create account"}
          </Button>
        </form>
        <p className="text-center text-sm text-muted-foreground mt-6">
          Already have an account?{" "}
          <Link to="/login" className="text-primary hover:underline">Log in</Link>
        </p>
      </div>
    </div>
  );
};

export default Register;
