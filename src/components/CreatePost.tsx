import { useState, useRef } from "react";
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

const CreatePost = ({ onPostCreated }: CreatePostProps) => {
  const [content, setContent] = useState("");
  const [mediaFiles, setMediaFiles] = useState<MediaFile[]>([]);
  const [loading, setLoading] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const { user } = useAuth();
  const { toast } = useToast();

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

    setMediaFiles(prev => [...prev, ...newMedia].slice(0, 10)); // Limit to 10 items
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
      const { error } = await supabase.from("posts").insert({
        user_id: user.id,
        content: content.trim(),
        image_url: mediaUrls[0]?.type === "image" ? mediaUrls[0].url : "",
        media: mediaUrls // JSONB column, now includes name/type
      } as any);

      if (error) throw error;

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
          placeholder="What's on your mind?"
          value={content}
          onChange={(e) => setContent(e.target.value)}
          className="border-0 bg-transparent resize-none text-base sm:text-lg text-foreground placeholder:text-muted-foreground/60 focus-visible:ring-2 focus-visible:ring-primary/20 focus-visible:ring-offset-0 min-h-[100px] p-1 transition-all"
        />
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
