import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Rocket, Heart, User, Shield, Smartphone, Zap } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";

const stats = [
  { value: "12+", label: "FEATURES" },
  { value: "100%", label: "YOUR DATA" },
  { value: "24/7", label: "CONNECTION" },
];

const features = [
  { icon: Rocket, title: "Share Moments", desc: "Create posts with images and descriptions. Connect with friends through your stories." },
  { icon: Heart, title: "Engage & Interact", desc: "Like posts, follow friends, and build your community with real-time updates." },
  { icon: User, title: "Expressive Profiles", desc: "Customize with cover images, profile pictures, and your unique bio." },
  { icon: Shield, title: "Private & Secure", desc: "Your data is protected with authentication. Only you control your content." },
  { icon: Smartphone, title: "Fully Responsive", desc: "A seamless experience on desktop, tablet, and mobile. Stay connected anywhere." },
  { icon: Zap, title: "Real-Time Feed", desc: "See posts from people you follow with infinite scroll and instant updates." },
];

const Landing = () => {
  const { user } = useAuth();
  return (
    <div className="min-h-screen bg-background overflow-hidden">
      {/* Hero */}
      <section className="relative min-h-screen flex items-center">
        {/* Background effects */}
        <div className="absolute inset-0 overflow-hidden">
          <div className="absolute top-1/4 left-1/4 w-96 h-96 rounded-full bg-primary/10 blur-[120px]" />
          <div className="absolute bottom-1/4 right-1/4 w-96 h-96 rounded-full bg-accent/10 blur-[120px]" />
        </div>

        <div className="container mx-auto px-6 relative z-10">
          <div className="grid lg:grid-cols-2 gap-12 items-center">
            <div className="space-y-8">
              <div className="flex items-center gap-3">
                <h1 className="text-3xl sm:text-4xl md:text-5xl lg:text-6xl font-display font-bold gradient-text leading-tight">
                  Zeo Matrix
                </h1>
              </div>

              <p className="text-base sm:text-lg text-muted-foreground max-w-md">
                Connect with family and friends. Share your world, securely.
              </p>

              <div className="flex flex-wrap gap-4">
                {user ? (
                  <Button asChild variant="hero" size="lg" className="px-8 shadow-glow">
                    <Link to="/feed">Go to Feed →</Link>
                  </Button>
                ) : (
                  <>
                    <Button asChild variant="hero" size="lg">
                      <Link to="/register">Create account →</Link>
                    </Button>
                    <Button asChild variant="outline" size="lg">
                      <Link to="/login">Log in</Link>
                    </Button>
                  </>
                )}
              </div>

              <div className="flex gap-6 sm:gap-10 pt-4">
                {stats.map((s) => (
                  <div key={s.label}>
                    <div className="text-xl sm:text-2xl font-display font-bold gradient-text">{s.value}</div>
                    <div className="text-[10px] sm:text-xs text-muted-foreground tracking-widest">{s.label}</div>
                  </div>
                ))}
              </div>
            </div>

            {/* Floating cards */}
            <div className="hidden lg:flex justify-center relative h-[400px]">
              <div className="absolute top-0 left-8 w-64 rounded-2xl bg-card border border-border p-4 shadow-lg animate-float">
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-full overflow-hidden border border-border">
                      <img
                        src="/profile1.jpg"
                        alt=""
                        className="w-full h-full object-cover select-none pointer-events-none"
                        onContextMenu={(e) => e.preventDefault()}
                        draggable="false"
                      />
                    </div>
                    <span className="font-display font-medium text-foreground">Alex</span>
                  </div>
                  <span className="text-[10px] text-muted-foreground uppercase tracking-wider">2h ago</span>
                </div>
                <div className="w-full h-36 rounded-xl overflow-hidden mb-3">
                  <img
                    src="/post1.jpg"
                    alt="Post"
                    className="w-full h-full object-cover select-none pointer-events-none"
                    onContextMenu={(e) => e.preventDefault()}
                    draggable="false"
                  />
                </div>
                <p className="text-[11px] text-muted-foreground mb-3 line-clamp-1">Exploring the peaks 🏔️ #nature</p>
                <div className="flex items-center gap-2">
                  <Heart className="w-4 h-4 text-accent fill-accent" />
                  <span className="text-[10px] font-bold text-foreground">2.4k</span>
                </div>
              </div>
              <div className="absolute top-16 right-0 w-64 rounded-2xl bg-card border border-border p-4 shadow-lg animate-float" style={{ animationDelay: '1s' }}>
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-full overflow-hidden border border-border">
                      <img
                        src="/profile2.jpg"
                        alt=""
                        className="w-full h-full object-cover select-none pointer-events-none"
                        onContextMenu={(e) => e.preventDefault()}
                        draggable="false"
                      />
                    </div>
                    <span className="font-display font-medium text-foreground">Jordan</span>
                  </div>
                  <span className="text-[10px] text-muted-foreground uppercase tracking-wider">5h ago</span>
                </div>
                <div className="w-full h-36 rounded-xl overflow-hidden mb-3">
                  <img
                    src="/post2.jpg"
                    alt="Post"
                    className="w-full h-full object-cover select-none pointer-events-none"
                    onContextMenu={(e) => e.preventDefault()}
                    draggable="false"
                  />
                </div>
                <p className="text-[11px] text-muted-foreground mb-3 line-clamp-1">Finally settled in! 💻 #workspace</p>
                <div className="flex items-center gap-2">
                  <Heart className="w-4 h-4 text-accent fill-accent" />
                  <span className="text-[10px] font-bold text-foreground">1.8k</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Features */}
      <section className="py-24">
        <div className="container mx-auto px-6">
          <h2 className="text-3xl md:text-4xl font-display font-bold text-center mb-4">
            Everything you need in a <span className="gradient-text">social space</span>
          </h2>
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6 mt-16">
            {features.map((f, i) => (
              <div
                key={f.title}
                className="group p-6 rounded-2xl bg-card border border-border hover:border-primary/30 transition-all duration-300 hover:glow"
                style={{ animationDelay: `${i * 0.1}s` }}
              >
                <div className="w-12 h-12 rounded-xl gradient-bg flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
                  <f.icon className="w-6 h-6 text-primary-foreground" />
                </div>
                <h3 className="text-lg font-display font-semibold text-foreground mb-2">{f.title}</h3>
                <p className="text-sm text-muted-foreground leading-relaxed">{f.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="py-24">
        <div className="container mx-auto px-6 text-center">
          <div className="max-w-2xl mx-auto p-12 rounded-3xl border border-border bg-card relative overflow-hidden">
            <div className="absolute inset-0 bg-gradient-to-br from-primary/5 to-accent/5" />
            <div className="relative z-10">
              <h2 className="text-3xl font-display font-bold text-foreground mb-4">
                {user ? "Jump back into Matrix" : "Ready to connect?"}
              </h2>
              <p className="text-muted-foreground mb-8">
                {user
                  ? "Your network is waiting for you. See what's new."
                  : "Join Zeo Matrix today and start sharing your journey."}
              </p>
              <Button asChild variant="hero" size="lg" className="px-10 shadow-glow">
                <Link to={user ? "/feed" : "/register"}>
                  {user ? "Go to Feed" : "Create your free account"}
                </Link>
              </Button>
              {!user && (
                <p className="mt-6 text-sm text-muted-foreground">
                  Already have an account?{" "}
                  <Link to="/login" className="text-primary hover:underline">Log in</Link>
                </p>
              )}
            </div>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="py-8 border-t border-border">
        <div className="container mx-auto px-6 text-center text-sm text-muted-foreground">
          © 2026 Zeo Matrix. All rights reserved.
        </div>
      </footer>
    </div>
  );
};

export default Landing;
