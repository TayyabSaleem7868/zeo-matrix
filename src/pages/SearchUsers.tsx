import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Input } from "@/components/ui/input";
import { Search } from "lucide-react";
import { Link } from "react-router-dom";

// Suggestions section for recently registered users (shown as "Suggested For You")
const SuggestionsSection = () => {
  const [suggestions, setSuggestions] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchSuggestions = async () => {
      setLoading(true);
      const { data } = await supabase
        .from("profiles")
        .select("user_id, username, display_name, avatar_url")
        .order("created_at", { ascending: false })
        .limit(5);
      setSuggestions(data || []);
      setLoading(false);
    };
    fetchSuggestions();
  }, []);

  if (loading || suggestions.length === 0) return null;

  return (
    <div className="bg-card/50 backdrop-blur-md border border-border rounded-3xl p-5 mb-6">
      <div className="flex items-center gap-2 mb-4 ml-1">
        <h3 className="text-lg font-display font-bold text-foreground">Suggested For You</h3>
      </div>
      <div className="space-y-4">
        {suggestions.map((profile) => (
          <Link
            key={profile.user_id}
            to={`/profile/${profile.user_id}`}
            className="flex items-center gap-3 min-w-0 group p-2 hover:bg-muted/30 rounded-2xl transition-all duration-300"
          >
            <div className="w-12 h-12 rounded-full gradient-bg flex-shrink-0 flex items-center justify-center overflow-hidden border-2 border-primary/20 group-hover:border-primary transition-colors">
              {profile.avatar_url ? (
                <img src={profile.avatar_url} alt="" className="w-full h-full object-cover" />
              ) : (
                <span className="text-primary-foreground font-display font-bold text-sm">
                  {(profile.display_name || profile.username || "?")[0].toUpperCase()}
                </span>
              )}
            </div>
            <div className="min-w-0">
              <p className="font-display font-bold text-foreground truncate text-[14px]">{profile.display_name || profile.username}</p>
              <p className="text-[12px] text-muted-foreground truncate">@{profile.username}</p>
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
};
interface ProfileResult {
  user_id: string;
  username: string;
  display_name: string | null;
  avatar_url: string | null;
  bio: string | null;
}

const SearchUsers = () => {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<ProfileResult[]>([]);

  const handleSearch = async (q: string) => {
    setQuery(q);
    if (q.trim().length < 2) { setResults([]); return; }
    const { data } = await supabase
      .from("profiles")
      .select("user_id, username, display_name, avatar_url, bio")
      .or(`username.ilike.%${q}%,display_name.ilike.%${q}%`)
      .limit(20);
    setResults(data || []);
  };

  return (
    <div className="max-w-2xl mx-auto px-4 py-6">
      <h1 className="text-2xl font-display font-bold text-foreground mb-6">Search</h1>
      <div className="relative mb-6">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
        <Input
          value={query}
          onChange={(e) => handleSearch(e.target.value)}
          placeholder="Search users..."
          className="pl-10"
        />
      </div>

      {/* Suggestions section */}
      <SuggestionsSection />

      <div className="space-y-2 mt-8">
        {results.map((r) => (
          <Link
            key={r.user_id}
            to={`/profile/${r.user_id}`}
            className="flex items-center gap-3 p-3 sm:p-4 rounded-xl bg-card border border-border hover:border-primary/30 transition-all"
          >
            <div className="w-10 h-10 rounded-full gradient-bg flex items-center justify-center overflow-hidden flex-shrink-0">
              {r.avatar_url ? (
                <img src={r.avatar_url} alt="" className="w-full h-full object-cover" />
              ) : (
                <span className="text-primary-foreground font-display font-bold text-sm">
                  {(r.display_name || r.username)[0].toUpperCase()}
                </span>
              )}
            </div>
            <div className="min-w-0">
              <p className="font-display font-medium text-foreground text-sm truncate">{r.display_name || r.username}</p>
              <p className="text-xs text-muted-foreground truncate">@{r.username}</p>
            </div>
          </Link>
        ))}
        {query.length >= 2 && results.length === 0 && (
          <p className="text-center py-8 text-muted-foreground">No users found.</p>
        )}
      </div>
    </div>
  );
}

export default SearchUsers;
