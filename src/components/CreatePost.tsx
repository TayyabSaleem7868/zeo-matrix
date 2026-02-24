import { useEffect, useMemo, useState, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { ImagePlus, Send, X, Film, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import VideoPlayer from "./VideoPlayer";


type MediaType = "image" | "video" | "pdf" | "doc" | "docx" | "zip" | "rar" | "other";
interface MediaFile {
  file: File;
  preview: string;
  type: MediaType;
}

interface CreatePostProps {
  onPostCreated: () => void;
}

type MentionCandidate = {
  user_id: string;
  username: string;
  display_name: string | null;
  avatar_url: string | null;
};

const CreatePost = ({ onPostCreated }: CreatePostProps) => {
  const [content, setContent] = useState("");
  const [mediaFiles, setMediaFiles] = useState<MediaFile[]>([]);
  const [loading, setLoading] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const { user } = useAuth();
  const { toast } = useToast();

  const [mentionOpen, setMentionOpen] = useState(false);
  const [mentionQuery, setMentionQuery] = useState("");
  const [mentionCandidates, setMentionCandidates] = useState<MentionCandidate[]>([]);
  const [mentionLoading, setMentionLoading] = useState(false);
  const [mentionIndex, setMentionIndex] = useState(0);

  const findActiveMention = (text: string, cursor: number) => {
    const before = text.slice(0, cursor);
    const at = before.lastIndexOf("@");
    if (at < 0) return null;

    const between = text.slice(at + 1, cursor);
    if (/\s/.test(between)) return null;

    if (at > 0 && /[A-Za-z0-9_]/.test(before[at - 1])) return null;

    const query = between;
    if (query.length > 24) return null;
    if (!/^[A-Za-z0-9_]*$/.test(query)) return null;
    return { start: at, end: cursor, query };
  };

  const extractMentionUsernames = (text: string) => {
    const matches = text.match(/(^|[^A-Za-z0-9_])@([A-Za-z0-9_]{1,24})/g) || [];
    const usernames = matches
      .map((m) => {
        const at = m.lastIndexOf("@");
        return m.slice(at + 1);
      })
      .filter(Boolean);
    return [...new Set(usernames.map((u) => u.toLowerCase()))];
  };

  const searchUsers = async (q: string) => {
    const query = q.trim();
    if (!query) {
      setMentionCandidates([]);
      return;
    }
    setMentionLoading(true);
    try {
      const { data, error } = await (supabase
        .from("profiles")
        .select("user_id, username, display_name, avatar_url") as any)
        .ilike("username", `${query}%`)
        .order("username", { ascending: true })
        .limit(8);
      if (error) throw error;
      setMentionCandidates((data || []) as MentionCandidate[]);
      setMentionIndex(0);
    } catch {
      setMentionCandidates([]);
    } finally {
      setMentionLoading(false);
    }
  };

  useEffect(() => {
    if (!mentionOpen) return;
    const t = setTimeout(() => {
      searchUsers(mentionQuery);
    }, 150);
    return () => clearTimeout(t);
  }, [mentionQuery, mentionOpen]);

  const getMediaType = (file: File): MediaType => {
    if (file.type.startsWith("image/")) return "image";
    if (file.type.startsWith("video/")) return "video";
    if (file.type === "application/pdf") return "pdf";
    if (
      file.name.match(/\.(doc|docx)$/i) ||
      file.type === "application/msword" ||
      file.type === "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
    ) return file.name.endsWith("x") ? "docx" : "doc";
    if (file.name.match(/\.(zip)$/i) || file.type === "application/zip") return "zip";
    if (file.name.match(/\.(rar)$/i) || file.type === "application/vnd.rar") return "rar";
    return "other";
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    if (files.length === 0) return;

    const newMedia: MediaFile[] = files.map(file => ({
      file,
      preview: URL.createObjectURL(file),
      type: getMediaType(file)
    }));

    setMediaFiles(prev => [...prev, ...newMedia].slice(0, 10));
  };

  const removeMedia = (index: number) => {
    setMediaFiles(prev => {
      const updated = [...prev];
      URL.revokeObjectURL(updated[index].preview);
      updated.splice(index, 1);
      return updated;
    });
  };

  const handleSubmit = async () => {
    if (!content.trim() && mediaFiles.length === 0) return;
    if (!user) return;
    setLoading(true);

    try {
      const mediaUrls = [];

      for (const item of mediaFiles) {
  const ext = item.file.name.split(".").pop();
  const path = `${user.id}/${Date.now()}-${Math.random().toString(36).substring(7)}.${ext}`;

        const { error: uploadError } = await supabase.storage
          .from("posts")
          .upload(path, item.file);

        if (uploadError) throw uploadError;

        const { data: urlData } = supabase.storage.from("posts").getPublicUrl(path);
  mediaUrls.push({ url: urlData.publicUrl, type: item.type, name: item.file.name });
      }


      const trimmed = content.trim();

      const { data: inserted, error } = await supabase
        .from("posts")
        .insert({
        user_id: user.id,
        content: trimmed,
        image_url: mediaUrls[0]?.type === "image" ? mediaUrls[0].url : "",
        media: mediaUrls
      } as any)
        .select("id")
        .single();

      if (error) throw error;

      try {
        const postId = inserted?.id as string | undefined;
        const usernames = extractMentionUsernames(trimmed);
        if (postId && usernames.length) {
          const { error: rpcErr } = await supabase.rpc("upsert_post_mentions" as any, {
            p_post_id: postId,
            p_usernames: usernames,
          } as any);

          if (rpcErr) {
          }
        }
      } catch {
      }

      setContent("");
      setMediaFiles([]);
      onPostCreated();
      toast({ title: "Success", description: "Your post is live!" });
    } catch (err: any) {
      toast({ title: "Post failed", description: err.message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="p-4 sm:p-6 rounded-[2rem] bg-card/50 border border-border/50 backdrop-blur-sm shadow-sm">
      <div className="mb-4">
        <Textarea
          ref={textareaRef}
          placeholder="What's on your mind?"
          value={content}
          onChange={(e) => {
            const next = e.target.value;
            setContent(next);

            const cursor = e.target.selectionStart ?? next.length;
            const m = findActiveMention(next, cursor);
            if (m) {
              setMentionOpen(true);
              setMentionQuery(m.query);
            } else {
              setMentionOpen(false);
              setMentionQuery("");
              setMentionCandidates([]);
            }
          }}
          onKeyDown={(e) => {
            if (!mentionOpen) return;
            if (e.key === "Escape") {
              e.preventDefault();
              setMentionOpen(false);
              return;
            }
            if (e.key === "ArrowDown") {
              e.preventDefault();
              setMentionIndex((i) => Math.min(i + 1, Math.max(mentionCandidates.length - 1, 0)));
              return;
            }
            if (e.key === "ArrowUp") {
              e.preventDefault();
              setMentionIndex((i) => Math.max(i - 1, 0));
              return;
            }
            if (e.key === "Enter" || e.key === "Tab") {
              if (!mentionCandidates.length) return;
              e.preventDefault();
              const pick = mentionCandidates[mentionIndex] || mentionCandidates[0];
              const el = textareaRef.current;
              if (!el) return;
              const text = el.value;
              const cursor = el.selectionStart ?? text.length;
              const active = findActiveMention(text, cursor);
              if (!active) return;

              const before = text.slice(0, active.start);
              const after = text.slice(active.end);
              const inserted = `@${pick.username} `;
              const next = before + inserted + after;
              setContent(next);
              setMentionOpen(false);
              setMentionQuery("");
              setMentionCandidates([]);

              requestAnimationFrame(() => {
                const pos = (before + inserted).length;
                el.focus();
                el.setSelectionRange(pos, pos);
              });
              return;
            }
          }}
          className="bg-transparent resize-none text-base sm:text-lg text-foreground placeholder:text-muted-foreground/60 min-h-[100px] px-4 py-3 border border-transparent rounded-2xl transition-colors outline-none shadow-none focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-primary/30 focus-visible:ring-offset-0 focus-visible:border-primary"
        />

        {mentionOpen && (
          <div className="relative">
            <div className="absolute left-0 right-0 mt-2 z-50 rounded-2xl border border-border/60 bg-background/90 backdrop-blur-md shadow-lg overflow-hidden">
              <div className="px-3 py-2 text-xs text-muted-foreground border-b border-border/50">
                Tag someone by username
              </div>
              {mentionLoading ? (
                <div className="p-4 flex items-center gap-2 text-sm text-muted-foreground">
                  <Loader2 className="w-4 h-4 animate-spin" /> Searching…
                </div>
              ) : mentionCandidates.length === 0 ? (
                <div className="p-4 text-sm text-muted-foreground">No users found</div>
              ) : (
                <div className="max-h-56 overflow-auto">
                  {mentionCandidates.map((c, idx) => (
                    <button
                      type="button"
                      key={c.user_id}
                      onMouseDown={(e) => {
                        e.preventDefault();
                      }}
                      onClick={() => {
                        const el = textareaRef.current;
                        if (!el) return;
                        const text = el.value;
                        const cursor = el.selectionStart ?? text.length;
                        const active = findActiveMention(text, cursor);
                        if (!active) return;

                        const before = text.slice(0, active.start);
                        const after = text.slice(active.end);
                        const inserted = `@${c.username} `;
                        const next = before + inserted + after;
                        setContent(next);
                        setMentionOpen(false);
                        setMentionQuery("");
                        setMentionCandidates([]);

                        requestAnimationFrame(() => {
                          const pos = (before + inserted).length;
                          el.focus();
                          el.setSelectionRange(pos, pos);
                        });
                      }}
                      className={`w-full flex items-center gap-3 px-3 py-2 text-left transition-colors ${
                        idx === mentionIndex ? "bg-primary/10" : "hover:bg-muted/50"
                      }`}
                    >
                      <div className="w-8 h-8 rounded-full overflow-hidden border border-border/50 flex-shrink-0">
                        {c.avatar_url ? (
                          <img src={c.avatar_url} alt="" className="w-full h-full object-cover" />
                        ) : (
                          <div className="w-full h-full gradient-bg flex items-center justify-center">
                            <span className="text-[11px] font-bold text-white">{(c.username || "?")[0].toUpperCase()}</span>
                          </div>
                        )}
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="text-sm font-semibold text-foreground truncate">{c.display_name || c.username}</div>
                        <div className="text-xs text-muted-foreground truncate">@{c.username}</div>
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {mediaFiles.length > 0 && (
        <div className="mb-4 flex gap-3 overflow-x-auto pb-3 scrollbar-none">
          {mediaFiles.map((item, idx) => (
            <div key={idx} className="relative w-28 h-28 sm:w-36 sm:h-36 rounded-2xl overflow-hidden flex-shrink-0 border border-border/40 bg-muted/30 group">
              {item.type === "image" ? (
                <img src={item.preview} alt="" className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-110" />
              ) : item.type === "video" ? (
                <VideoPlayer url={item.preview} muted playing={false} controls={false} className="w-full h-full object-cover" />
              ) : item.type === "pdf" ? (
                <div className="flex flex-col items-center justify-center h-full w-full bg-background/70 backdrop-blur-md">
                  <span className="text-xs font-semibold">PDF</span>
                  <a href={item.preview} target="_blank" rel="noopener noreferrer" className="text-blue-600 underline">Open</a>
                </div>
              ) : item.type === "doc" || item.type === "docx" ? (
                <div className="flex flex-col items-center justify-center h-full w-full bg-background/70 backdrop-blur-md">
                  <span className="text-xs font-semibold">DOC{item.type === "docx" ? "X" : ""}</span>
                  <a href={`https://docs.google.com/gview?url=${encodeURIComponent(item.preview)}&embedded=true`} target="_blank" rel="noopener noreferrer" className="text-blue-600 underline">View</a>
                  <a href={item.preview} target="_blank" rel="noopener noreferrer" className="text-gray-600 underline text-xs mt-1">Download</a>
                </div>
              ) : item.type === "zip" || item.type === "rar" ? (
                <div className="flex flex-col items-center justify-center h-full w-full bg-background/70 backdrop-blur-md">
                  <span className="text-xs font-semibold">{item.type.toUpperCase()}</span>
                  <a href={item.preview} target="_blank" rel="noopener noreferrer" className="text-blue-600 underline">Download</a>
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center h-full w-full bg-background/70 backdrop-blur-md">
                  <span className="text-xs font-semibold">File</span>
                  <a href={item.preview} target="_blank" rel="noopener noreferrer" className="text-blue-600 underline">Download</a>
                </div>
              )}
              <button
                onClick={() => removeMedia(idx)}
                className="absolute top-2 right-2 w-7 h-7 rounded-full bg-black/70 text-white flex items-center justify-center hover:bg-black transition-all transform hover:scale-110 z-10"
              >
                <X className="w-4 h-4" />
              </button>
              {item.type === "video" && (
                <div className="absolute inset-0 flex items-center justify-center pointer-events-none bg-black/20">
                  <Film className="w-8 h-8 text-white/90 drop-shadow-lg" />
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      <div className="flex items-center justify-between pt-4 border-t border-border/40">
        <div className="flex items-center gap-1">
          <button
            disabled={loading}
            onClick={() => fileRef.current?.click()}
            className="flex items-center gap-2.5 px-4 py-2 rounded-xl text-sm font-semibold text-muted-foreground hover:bg-primary/10 hover:text-primary transition-all active:scale-95 group"
          >
            <ImagePlus className="w-5 h-5 transition-transform group-hover:rotate-6" />
            <span className="hidden sm:inline">Media</span>
            <span className="sm:hidden">Photo</span>
          </button>
        </div>

        <input
          ref={fileRef}
          type="file"
          multiple
          accept="image/*,video/*,.pdf,.doc,.docx,.zip,.rar,application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document,application/zip,application/vnd.rar"
          className="hidden"
          onChange={handleFileSelect}
        />

        <Button
          variant="hero"
          size="default"
          onClick={handleSubmit}
          disabled={loading || (!content.trim() && mediaFiles.length === 0)}
          className="rounded-2xl px-8 h-11 font-bold tracking-wide transition-all active:scale-[0.98] shadow-glow"
        >
          {loading ? (
            <><Loader2 className="w-5 h-5 mr-2 animate-spin" /> Posting...</>
          ) : (
            <><Send className="w-5 h-5 mr-2" /> Post</>
          )}
        </Button>
      </div>
    </div>
  );
};
export default CreatePost;
