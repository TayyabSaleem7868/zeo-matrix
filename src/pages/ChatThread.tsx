import {
  ArrowLeft,
  Check,
  Eraser,
  Image as ImageIcon,
  Mic,
  Paperclip,
  Pause,
  Play,
  Send,
  Smile,
  X,
} from "lucide-react";
import React, { memo, useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Link, useNavigate, useParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { useUnreadContext } from "@/contexts/UnreadMessagesContext";

function clamp(n: number, min: number, max: number) {
  return Math.max(min, Math.min(max, n));
}

type MessageRow = {
  id: string;
  conversation_id: string;
  sender_id: string | null;
  content: string;
  created_at: string;
  edited_at?: string | null;
  is_deleted?: boolean;
  reply_to_message_id?: string | null;
  attachment_url?: string | null;
  attachment_type?: string | null;
  reactions?: { emoji: string; user_id: string }[];
};

type Profile = {
  user_id: string;
  username: string;
  display_name: string | null;
  avatar_url: string | null;
  is_verified?: boolean | null;
};

type TypingRow = {
  conversation_id: string;
  user_id: string;
  is_typing: boolean;
  updated_at: string;
};

function InlineActions(props: {
  mine: boolean;
  canEdit: boolean;
  onReply: () => void;
  onEdit: () => void;
  onDeleteForMe: () => void;
  onUnsend: () => void;
}) {
  const { mine, canEdit, onReply, onEdit, onDeleteForMe, onUnsend } = props;

  return (
    <div className="flex items-center gap-1 rounded-2xl border-2 border-border/50 bg-background/60 backdrop-blur-xl px-1.5 py-1 shadow-2xl max-w-[calc(100vw-4rem)] overflow-x-auto no-scrollbar">
      <Button variant="ghost" size="sm" className="h-8 rounded-xl shrink-0" onClick={onReply}>
        Reply
      </Button>

      {mine && canEdit && (
        <Button variant="ghost" size="sm" className="h-8 rounded-xl shrink-0" onClick={onEdit}>
          Edit
        </Button>
      )}

      <Button variant="ghost" size="sm" className="h-8 rounded-xl shrink-0" onClick={onDeleteForMe}>
        Delete
      </Button>

      {mine && (
        <Button
          variant="ghost"
          size="sm"
          className="h-8 rounded-xl text-destructive hover:text-destructive shrink-0"
          onClick={onUnsend}
        >
          Unsend
        </Button>
      )}
    </div>
  );
}

// --- Sub-components (Memoized) ---

const ChatHeader = memo(({
  title,
  other,
  otherTyping,
  otherReadAt,
  lastMessage,
  onBack,
  onClear
}: {
  title: string;
  other: Profile | null;
  otherTyping: boolean;
  otherReadAt: string | null;
  lastMessage: MessageRow | null;
  onBack: () => void;
  onClear: () => void;
}) => (
  <div className="flex items-center justify-between gap-3 px-4 py-3 bg-background/60 backdrop-blur-xl border-b border-border/50 shadow-sm first:mt-0">
    <div className="flex items-center gap-2 min-w-0">
      <Button variant="ghost" size="icon" onClick={onBack} title="Back">
        <ArrowLeft className="w-5 h-5" />
      </Button>
      <div className="min-w-0">
        <p className="font-semibold text-foreground truncate">{title}</p>
        <div className="flex items-center gap-2">
          {other?.username && <p className="text-xs text-muted-foreground truncate">@{other.username}</p>}
          {otherTyping && (
            <div className="flex gap-1 ml-1 items-center h-4">
              <span className="w-1 h-1 rounded-full bg-primary animate-bounce [animation-delay:-0.3s]" />
              <span className="w-1 h-1 rounded-full bg-primary animate-bounce [animation-delay:-0.15s]" />
              <span className="w-1 h-1 rounded-full bg-primary animate-bounce" />
            </div>
          )}
          {otherReadAt && lastMessage && lastMessage.created_at <= otherReadAt && (
            <p className="text-xs text-primary font-medium">read</p>
          )}
        </div>
      </div>
    </div>
    <div className="flex items-center gap-2">
      <Button asChild variant="outline" size="sm">
        <Link to={other?.username ? `/profile/${other.username}` : "/inbox"}>View profile</Link>
      </Button>
      <Button variant="outline" size="sm" onClick={onClear} title="Clear chat">
        <Eraser className="w-4 h-4 mr-2" /> Clear
      </Button>
    </div>
  </div>
));

const AudioWaveform = ({ audioRef, mine, isPlaying }: { audioRef: React.RefObject<HTMLAudioElement>, mine: boolean, isPlaying: boolean }) => {
  const [bars, setBars] = useState<number[]>([]);
  const [progress, setProgress] = useState(0);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const audioCtxRef = useRef<AudioContext | null>(null);
  const sourceRef = useRef<MediaElementAudioSourceNode | null>(null);
  const animFrameFreqRef = useRef<number | null>(null);
  const animFrameProgRef = useRef<number | null>(null);

  // Generate a deterministic but random-looking static waveform
  const staticBars = useMemo(() => {
    const b = [];
    const BAR_COUNT = 32;
    for (let i = 0; i < BAR_COUNT; i++) {
      // Use a more "natural" waveform distribution
      const val = Math.abs(Math.sin(i * 0.4) * Math.cos(i * 0.1)) * 0.7 + 0.2;
      b.push(Math.max(4, Math.round(val * 22)));
    }
    return b;
  }, []);

  useEffect(() => {
    if (!audioRef.current) return;
    const audio = audioRef.current;

    const updateProgress = () => {
      if (audio.duration) {
        setProgress((audio.currentTime / audio.duration) * 100);
      }
      if (isPlaying) {
        animFrameProgRef.current = requestAnimationFrame(updateProgress);
      }
    };

    const init = () => {
      if (!audioCtxRef.current && isPlaying) {
        try {
          const AudioContextClass = (window.AudioContext || (window as any).webkitAudioContext);
          const ctx = new AudioContextClass();
          const analyser = ctx.createAnalyser();
          analyser.fftSize = 128;

          const source = ctx.createMediaElementSource(audio);
          source.connect(analyser);
          analyser.connect(ctx.destination);

          audioCtxRef.current = ctx;
          analyserRef.current = analyser;
          sourceRef.current = source;
        } catch (e) {
          console.error("AudioContext init failed:", e);
        }
      }
    };

    const tick = () => {
      if (!analyserRef.current) return;
      const dataArr = new Uint8Array(analyserRef.current.frequencyBinCount);
      analyserRef.current.getByteFrequencyData(dataArr);

      const newBars: number[] = [];
      const BAR_COUNT = 32;
      const step = Math.floor(dataArr.length / BAR_COUNT);
      for (let i = 0; i < BAR_COUNT; i++) {
        const v = dataArr[i * step] / 255;
        const liveVal = Math.max(4, Math.round(v * 24));
        newBars.push(liveVal);
      }
      setBars(newBars);
      animFrameFreqRef.current = requestAnimationFrame(tick);
    };

    if (isPlaying) {
      init();
      if (audioCtxRef.current?.state === 'suspended') {
        audioCtxRef.current.resume();
      }
      tick();
      updateProgress();
    } else {
      if (animFrameFreqRef.current) cancelAnimationFrame(animFrameFreqRef.current);
      if (animFrameProgRef.current) cancelAnimationFrame(animFrameProgRef.current);
      setBars([]);
    }

    return () => {
      if (animFrameFreqRef.current) cancelAnimationFrame(animFrameFreqRef.current);
      if (animFrameProgRef.current) cancelAnimationFrame(animFrameProgRef.current);
    };
  }, [isPlaying, audioRef]);

  const displayBars = bars.length > 0 ? bars : staticBars;

  return (
    <div className="flex items-center gap-[1.5px] h-8 flex-1 justify-center px-1 group/wave">
      {displayBars.map((h, i) => {
        const barProgress = (i / displayBars.length) * 100;
        const isPlayed = barProgress < progress;
        return (
          <div
            key={i}
            className={`rounded-full transition-all duration-75 ${
              isPlayed 
                ? (mine ? 'bg-white' : 'bg-primary') 
                : (mine ? 'bg-white/30' : 'bg-primary/20')
            }`}
            style={{
              width: '2px',
              height: `${h}px`,
              transitionTimingFunction: 'ease-out',
            }}
          />
        );
      })}
    </div>
  );
};

const MicPermissionDialog = memo(({
  isOpen,
  onOpenChange,
  micUnsupported,
  micDenied,
  onRetry
}: {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  micUnsupported: boolean;
  micDenied: boolean;
  onRetry: () => void;
}) => (
  <Dialog open={isOpen} onOpenChange={onOpenChange}>
    <DialogContent className="sm:max-w-md">
      <DialogHeader>
        <DialogTitle>Microphone Access</DialogTitle>
      </DialogHeader>
      <div className="flex flex-col items-center justify-center py-6 gap-4">
        <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center">
          <Mic className="w-8 h-8 text-primary" />
        </div>
        {micUnsupported ? (
          <div className="text-center px-2 space-y-2">
            <p className="text-sm font-semibold text-destructive">Microphone not available</p>
            <p className="text-xs text-muted-foreground">
              Voice messages require a <strong>secure connection (HTTPS)</strong>. Please open the app via <code>https://</code> or on localhost.
            </p>
          </div>
        ) : micDenied ? (
          <div className="text-center px-2 space-y-2">
            <p className="text-sm font-semibold text-destructive">Permission denied</p>
            <p className="text-xs text-muted-foreground">
              Microphone access was blocked. To enable it, click the 🔒 lock icon in your browser address bar → Site settings → Microphone → Allow.
            </p>
          </div>
        ) : (
          <p className="text-center text-sm text-muted-foreground px-2">
            We need access to your microphone to record voice messages. Click <strong>Allow</strong> to proceed.
          </p>
        )}
      </div>
      <div className="flex justify-end gap-3">
        <Button variant="outline" onClick={() => onOpenChange(false)}>Close</Button>
        {!micUnsupported && (
          <Button onClick={onRetry}>
            {micDenied ? "Try Again" : "Allow"}
          </Button>
        )}
      </div>
    </DialogContent>
  </Dialog>
));

const RecordingBar = memo(({
  duration,
  waveBars
}: {
  duration: number;
  waveBars: number[];
}) => {
  const formatDuration = (s: number) => {
    const mins = Math.floor(s / 60);
    const secs = s % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  return (
    <div className="h-11 flex items-center gap-2 sm:gap-3 px-2 sm:px-4 bg-primary/10 border border-primary/20 rounded-2xl flex-1 min-w-0 overflow-hidden">
      <span className="relative flex h-2 w-2 sm:h-3 sm:w-3 shrink-0 ml-1">
        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-500 opacity-75" />
        <span className="relative inline-flex rounded-full h-2 w-2 sm:h-3 sm:w-3 bg-red-500" />
      </span>
      <div className="flex items-center gap-[2px] sm:gap-[3px] flex-1 h-8 overflow-hidden justify-center px-1 sm:px-2">
        {waveBars.map((h, i) => (
          <div
            key={i}
            className="rounded-full bg-primary/60 transition-all shadow-[0_0_8px_rgba(var(--primary),0.1)]"
            style={{
              width: '2px',
              height: `${Math.max(4, h)}px`,
              transitionDuration: '75ms',
              transitionTimingFunction: 'ease-out',
            }}
          />
        ))}
      </div>
      <span className="text-[11px] sm:text-xs font-bold text-primary tabular-nums shrink-0 mr-1">{formatDuration(duration)}</span>
    </div>
  );
});

const ChatComposer = memo(({
  user,
  convId,
  replyTo,
  editingMsg,
  setReplyTo,
  setEditingMsg,
  onLoadThread,
  onShowMicDialog
}: {
  user: any;
  convId: string;
  replyTo: MessageRow | null;
  editingMsg: MessageRow | null;
  setReplyTo: (m: MessageRow | null) => void;
  setEditingMsg: (m: MessageRow | null) => void;
  onLoadThread: (isInitial?: boolean, forceScroll?: boolean) => void;
  onShowMicDialog: () => void;
}) => {
  const [text, setText] = useState("");
  const [sending, setSending] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [recordingDuration, setRecordingDuration] = useState(0);
  const [waveBars, setWaveBars] = useState<number[]>(Array(24).fill(3));
  const [selectedMedia, setSelectedMedia] = useState<{ url: string; type: string; file: File } | null>(null);
  const { toast } = useToast();

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const recordingIntervalRef = useRef<number | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const audioCtxRef = useRef<AudioContext | null>(null);
  const animFrameRef = useRef<number | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const typingTimerRef = useRef<number | null>(null);
  const lastTypingSentRef = useRef<"on" | "off">("off");

  useEffect(() => {
    if (editingMsg) setText(editingMsg.content);
    else setText("");
  }, [editingMsg]);

  const setTypingStatus = async (isTyping: boolean) => {
    if (!user || !convId) return;
    const next: "on" | "off" = isTyping ? "on" : "off";
    if (lastTypingSentRef.current === next) return;
    lastTypingSentRef.current = next;
    await supabase.rpc("set_typing" as any, { p_conversation_id: convId, p_is_typing: isTyping } as any);
  };

  const startRecording = async () => {
    if (!navigator.mediaDevices?.getUserMedia) {
      onShowMicDialog();
      return;
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const recorder = new MediaRecorder(stream);
      mediaRecorderRef.current = recorder;
      audioChunksRef.current = [];

      const AudioContextClass = (window.AudioContext || (window as any).webkitAudioContext);
      const ctx = new AudioContextClass();
      audioCtxRef.current = ctx;
      const source = ctx.createMediaStreamSource(stream);
      const analyser = ctx.createAnalyser();
      analyser.fftSize = 64;
      source.connect(analyser);
      analyserRef.current = analyser;

      const dataArr = new Uint8Array(analyser.frequencyBinCount);
      const BAR_COUNT = 24;

      const tick = () => {
        analyser.getByteFrequencyData(dataArr);
        const bars: number[] = [];
        const step = Math.floor(dataArr.length / BAR_COUNT);
        for (let i = 0; i < BAR_COUNT; i++) {
          const v = dataArr[i * step] / 255;
          bars.push(Math.max(3, Math.round(v * 32)));
        }
        setWaveBars(bars);
        animFrameRef.current = requestAnimationFrame(tick);
      };
      tick();

      recorder.ondataavailable = (e) => audioChunksRef.current.push(e.data);
      recorder.start();
      setIsRecording(true);
      setRecordingDuration(0);
      recordingIntervalRef.current = window.setInterval(() => {
        setRecordingDuration(d => d + 1);
      }, 1000);
    } catch (e: any) {
      onShowMicDialog();
    }
  };

  const stopRecording = (shouldSend = false) => {
    if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
    audioCtxRef.current?.close();
    analyserRef.current = null;
    audioCtxRef.current = null;
    animFrameRef.current = null;
    setWaveBars(Array(24).fill(3));

    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      if (shouldSend) {
        mediaRecorderRef.current.onstop = async () => {
          const blob = new Blob(audioChunksRef.current, { type: "audio/webm" });
          const file = new File([blob], "voice.webm", { type: "audio/webm" });

          if (!user || !convId) return;
          setSending(true);
          try {
            const path = `${user.id}/${Date.now()}.webm`;
            const { error: uploadError } = await supabase.storage.from("chat_media").upload(path, file);
            let attachment_url = "";
            if (uploadError) {
              await supabase.storage.from("avatars").upload(`chat-media/${path}`, file);
              const { data } = supabase.storage.from("avatars").getPublicUrl(`chat-media/${path}`);
              attachment_url = data.publicUrl;
            } else {
              const { data } = supabase.storage.from("chat_media").getPublicUrl(path);
              attachment_url = data.publicUrl;
            }
            await supabase.from("messages").insert({
              conversation_id: convId,
              sender_id: user.id,
              content: "",
              attachment_url,
              attachment_type: "audio/webm",
            } as any);
            onLoadThread(false, true);
          } catch (e) {
            toast({ title: "Upload failed", description: "Could not send voice message", variant: "destructive" });
          } finally { setSending(false); }

          if (mediaRecorderRef.current?.stream) {
            mediaRecorderRef.current.stream.getTracks().forEach(t => t.stop());
          }
        };
      } else {
        mediaRecorderRef.current.onstop = () => {
          if (mediaRecorderRef.current?.stream) {
            mediaRecorderRef.current.stream.getTracks().forEach(t => t.stop());
          }
        };
      }
      mediaRecorderRef.current.stop();
    }

    setIsRecording(false);
    if (recordingIntervalRef.current) window.clearInterval(recordingIntervalRef.current);
  };

  const cancelRecording = () => {
    stopRecording(false);
    setSelectedMedia(null);
  };

  const handleSend = async () => {
    if (!user || !convId) return;
    const body = text.trim();
    if (!body && !selectedMedia) return;

    setSending(true);
    try {
      let attachment_url = selectedMedia?.url || null;
      let attachment_type = selectedMedia?.type || null;

      if (selectedMedia?.file) {
        const file = selectedMedia.file;
        const ext = file.name.split(".").pop();
        const path = `${user.id}/${Date.now()}.${ext}`;
        const { error: uploadError } = await supabase.storage.from("chat_media").upload(path, file);

        if (uploadError) {
          const { error: fallbackError } = await supabase.storage.from("avatars").upload(`chat-media/${path}`, file);
          if (fallbackError) throw fallbackError;
          const { data } = supabase.storage.from("avatars").getPublicUrl(`chat-media/${path}`);
          attachment_url = data.publicUrl;
        } else {
          const { data } = supabase.storage.from("chat_media").getPublicUrl(path);
          attachment_url = data.publicUrl;
        }
      }

      if (editingMsg) {
        const { error } = await supabase
          .from("messages")
          .update({ content: body, edited_at: new Date().toISOString() } as any)
          .eq("id", editingMsg.id);
        if (error) throw error;
        setEditingMsg(null);
      } else {
        const { error } = await supabase.from("messages").insert({
          conversation_id: convId,
          sender_id: user.id,
          content: body,
          reply_to_message_id: replyTo?.id || null,
          attachment_url,
          attachment_type,
        } as any);
        if (error) throw error;
      }

      setText("");
      setReplyTo(null);
      setSelectedMedia(null);
      setTypingStatus(false);
      onLoadThread(false, true);
    } catch (e: any) {
      toast({ title: "Send failed", description: e?.message || "Couldn't send message", variant: "destructive" });
    } finally {
      setSending(false);
    }
  };

  return (
    <div id="chat-composer" className="p-4 sm:p-4 border-t border-border/50 bg-background/60 backdrop-blur-xl">
      {(replyTo || editingMsg) && (
        <div className="mb-3 flex items-start justify-between gap-3 rounded-2xl border border-border/60 bg-background/60 backdrop-blur-xl px-3 py-2 animate-in slide-in-from-top-2 duration-200">
          <div className="min-w-0 flex-1">
            <p className="text-[10px] font-bold text-primary uppercase tracking-wider mb-0.5">{editingMsg ? "Editing message" : "Replying"}</p>
            <p className="text-sm text-muted-foreground truncate">{editingMsg ? editingMsg.content : replyTo?.content}</p>
          </div>
          <Button variant="ghost" size="icon" className="h-8 w-8 rounded-full hover:bg-muted" onClick={() => { setReplyTo(null); setEditingMsg(null); }} title="Cancel">
            <X className="w-4 h-4" />
          </Button>
        </div>
      )}

      <div className="flex gap-3 sm:gap-2 items-center">
        <input type="file" ref={fileInputRef} className="hidden" accept="image/*,video/*" onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) {
            const url = URL.createObjectURL(file);
            setSelectedMedia({ url, type: file.type, file });
          }
          e.target.value = "";
        }} />
        {!isRecording && (
          <Button variant="ghost" size="icon" className="rounded-2xl h-11 w-11 shrink-0 bg-secondary/30 hover:bg-secondary/50 transition-colors" onClick={() => fileInputRef.current?.click()} title="Attach media">
            <Paperclip className="w-5 h-5 text-muted-foreground" />
          </Button>
        )}

        <div className="relative flex-1">
          {isRecording ? (
            <div className="flex items-center gap-1.5 sm:gap-2 w-full">
              <RecordingBar duration={recordingDuration} waveBars={waveBars} />
              <button
                onClick={cancelRecording}
                className="w-10 h-10 sm:w-11 sm:h-11 rounded-full bg-muted border border-border hover:bg-muted/80 flex items-center justify-center text-muted-foreground transition-all active:scale-90 shrink-0"
                title="Cancel"
              >
                <X className="w-5 h-5" />
              </button>
              <button
                onClick={() => stopRecording(true)}
                className="w-11 h-11 rounded-full bg-primary flex items-center justify-center hover:scale-105 hover:shadow-lg hover:shadow-primary/20 transition-all active:scale-90 shadow-md shrink-0"
                title="Stop & Send"
              >
                <Send className="w-5 h-5 text-primary-foreground fill-current ml-0.5" />
              </button>
            </div>
          ) : (
            <div className="relative flex items-center">
              <Textarea
                value={text}
                onChange={(e) => {
                  setText(e.target.value);
                  setTypingStatus(true);
                  if (typingTimerRef.current) window.clearTimeout(typingTimerRef.current);
                  typingTimerRef.current = window.setTimeout(() => setTypingStatus(false), 1200);
                }}
                placeholder={editingMsg ? "Edit message…" : "Message…"}
                className={`h-11 min-h-[44px] max-h-40 resize-none rounded-2xl ${selectedMedia ? 'pl-4 pr-16' : 'px-4'} py-2.5 text-[15px] sm:text-sm transition-all focus-visible:ring-0 focus-visible:ring-offset-0 focus:border-primary/40 border-border/60 bg-background/50 outline-none`}
                onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); handleSend(); } }}
              />
              {selectedMedia && (
                <div className="absolute right-2 top-1/2 -translate-y-1/2 flex items-center gap-1 bg-card border border-border p-1 rounded-xl shadow-sm animate-in fade-in zoom-in duration-200">
                  {selectedMedia.type.startsWith('image/') ? (
                    <div className="w-7 h-7 rounded-lg overflow-hidden border border-border/50">
                      <img src={selectedMedia.url} alt="Preview" className="w-full h-full object-cover" />
                    </div>
                  ) : (
                    <div className="w-7 h-7 rounded-lg bg-primary/10 flex items-center justify-center"><ImageIcon className="w-4 h-4 text-primary" /></div>
                  )}
                  <button onClick={() => setSelectedMedia(null)} className="p-1 hover:bg-muted rounded-md transition-colors"><X className="w-3.5 h-3.5" /></button>
                </div>
              )}
            </div>
          )}
        </div>
        {!text.trim() && !selectedMedia && !isRecording ? (
          <Button variant="ghost" size="icon" className="rounded-2xl h-11 w-11 shrink-0 bg-primary/10 hover:bg-primary/20 text-primary transition-colors" onClick={startRecording} title="Voice Message">
            <Mic className="w-5 h-5" />
          </Button>
        ) : !isRecording && (
          <Button
            onClick={handleSend}
            disabled={sending || (!text.trim() && !selectedMedia)}
            className="rounded-2xl h-11 px-5 shadow-sm hover:translate-y-[-1px] transition-all"
          >
            {editingMsg ? (<><Check className="w-4 h-4 mr-2" /> Save</>) : (<><Send className="w-4 h-4 mr-2" /> Send</>)}
          </Button>
        )}
      </div>
    </div>
  );
});

const MessageItem = memo(({
  m,
  mine,
  replyTarget,
  isNewDay,
  dateLabel,
  swipeX,
  showActions,
  isTouchLike,
  onReply,
  onEdit,
  onDeleteForMe,
  onUnsend,
  onSwipeStart,
  onSwipeMove,
  onSwipeEnd,
  onToggleReaction,
  onShowLightbox,
  onShowActions,
  showReactionPicker,
  onToggleReactionPicker,
  otherReadAt,
  userId
}: {
  m: MessageRow;
  mine: boolean;
  replyTarget: MessageRow | null;
  isNewDay: boolean;
  dateLabel: string;
  swipeX: number;
  showActions: boolean;
  isTouchLike: boolean;
  onReply: (m: MessageRow) => void;
  onEdit: (m: MessageRow) => void;
  onDeleteForMe: (m: MessageRow) => void;
  onUnsend: (m: MessageRow) => void;
  onSwipeStart: (e: React.TouchEvent, id: string) => void;
  onSwipeMove: (e: React.TouchEvent, id: string) => void;
  onSwipeEnd: (id: string) => void;
  onToggleReaction: (id: string, emoji: string) => void;
  onShowLightbox: (url: string) => void;
  onShowActions: (id: string) => void;
  showReactionPicker: string | null;
  onToggleReactionPicker: (id: string) => void;
  otherReadAt: string | null;
  userId: string;
}) => {
  const [isPlaying, setIsPlaying] = useState(false);
  const audioRef = useRef<HTMLAudioElement>(null);

  return (
    <div className="space-y-3">
      {isNewDay && (
        <div className="flex justify-center my-6 first:mt-2">
          <span className="px-3 py-1 rounded-full bg-muted/40 text-[11px] font-bold text-muted-foreground uppercase tracking-widest border border-border/40">
            {dateLabel}
          </span>
        </div>
      )}
      <div className={`flex ${mine ? "justify-end" : "justify-start"}`}>
        <div
          className="max-w-[90%] relative group rounded-2xl transition-colors"
          onClick={(e) => { e.stopPropagation(); }}
          onDoubleClick={(e) => {
            if (isTouchLike) return;
            e.stopPropagation();
            onShowActions(m.id);
          }}
        >
          {showActions && !m.is_deleted && (
            <div className={`mb-2 flex ${mine ? "justify-end" : "justify-start"}`}>
              <InlineActions
                mine={mine}
                canEdit={!m.is_deleted}
                onReply={() => onReply(m)}
                onEdit={() => onEdit(m)}
                onDeleteForMe={() => onDeleteForMe(m)}
                onUnsend={() => onUnsend(m)}
              />
            </div>
          )}

          <div className={`flex items-start gap-2 ${mine ? "justify-end" : "justify-start"}`}>
            <div
              className={
                `w-fit rounded-2xl px-5 py-3 sm:px-4 sm:py-2 text-sm leading-relaxed transition-transform ` +
                (mine ? "bg-primary text-primary-foreground ml-auto" : "bg-muted/60 text-foreground border border-border/60 mr-auto")
              }
              style={isTouchLike ? { transform: `translateX(${swipeX}px)` } : undefined}
              onTouchStart={(e) => onSwipeStart(e, m.id)}
              onTouchMove={(e) => onSwipeMove(e, m.id)}
              onTouchEnd={() => onSwipeEnd(m.id)}
            >
              {replyTarget && !m.is_deleted && (
                <div className={`mb-2 rounded-xl px-3 py-2 text-xs ${mine ? "bg-primary-foreground/10" : "bg-background/40"}`}>
                  <div className={`font-semibold ${mine ? "text-primary-foreground/90" : "text-foreground"}`}>Replying to</div>
                  <div className={`truncate ${mine ? "text-primary-foreground/80" : "text-muted-foreground"}`}>
                    {replyTarget.is_deleted ? "Message deleted" : replyTarget.content}
                  </div>
                </div>
              )}

              {m.attachment_url && !m.is_deleted && (
                <div className="mb-2 -mx-1 first:mt-0">
                  {m.attachment_type?.startsWith("image/") ? (
                    <img
                      src={m.attachment_url}
                      alt="Attachment"
                      className="rounded-xl w-full max-h-64 object-cover cursor-pointer hover:opacity-90 transition-opacity"
                      onClick={() => onShowLightbox(m.attachment_url!)}
                    />
                  ) : m.attachment_type?.startsWith("video/") ? (
                    <video src={m.attachment_url} controls className="rounded-xl w-full max-h-64 object-cover" />
                  ) : m.attachment_type?.startsWith("audio/") ? (
                    <div className={`flex items-center gap-3 p-3 rounded-2xl w-full max-w-[240px] sm:max-w-[280px] shadow-sm transition-all ${
                      mine ? 'bg-white/10 hover:bg-white/15' : 'bg-card/40 hover:bg-card/60'
                    }`}>
                      <audio
                        src={m.attachment_url}
                        ref={audioRef}
                        className="hidden"
                        crossOrigin="anonymous"
                        onPlay={() => setIsPlaying(true)}
                        onPause={() => setIsPlaying(false)}
                        onEnded={() => setIsPlaying(false)}
                      />
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          if (!audioRef.current) return;

                          // Ensure AudioContext is resumed/started on user click
                          if (audioRef.current.paused) {
                            audioRef.current.play().catch(err => {
                              console.error("Playback failed:", err);
                            });
                          } else {
                            audioRef.current.pause();
                          }
                        }}
                        className={`w-11 h-11 shrink-0 rounded-full flex items-center justify-center transition-all active:scale-95 shadow-md ${
                          mine ? 'bg-white text-primary' : 'bg-primary text-primary-foreground'
                        } hover:scale-105`}
                      >
                        {isPlaying ? <Pause className="w-5 h-5 fill-current" /> : <Play className="w-5 h-5 fill-current ml-1" />}
                      </button>
                      <div className="flex-1 flex flex-col justify-center gap-1 min-w-0">
                        <AudioWaveform audioRef={audioRef} mine={mine} isPlaying={isPlaying} />
                        <div className="flex items-center justify-between px-1">
                          <p className={`text-[9px] uppercase tracking-wider font-bold opacity-60`}>Voice Message</p>
                          {audioRef.current?.duration && (
                            <p className="text-[9px] font-mono opacity-60">
                              {Math.floor(audioRef.current.duration / 60)}:{(Math.floor(audioRef.current.duration % 60)).toString().padStart(2, '0')}
                            </p>
                          )}
                        </div>
                      </div>
                    </div>
                  ) : (
                    <a href={m.attachment_url} target="_blank" rel="noreferrer" className="flex items-center gap-2 p-3 bg-black/10 rounded-xl hover:bg-black/20 transition-all text-sm font-medium">
                      <Paperclip className="w-4 h-4" />
                      <span>Download Attachment</span>
                    </a>
                  )}
                </div>
              )}

              {m.is_deleted ? <span className="opacity-60 italic">Message deleted</span> : m.content}

              <div className={`text-[10px] mt-1 flex items-center gap-2 ${mine ? "text-primary-foreground/70" : "text-muted-foreground"}`}>
                <span>{new Date(m.created_at).toLocaleTimeString([], { hour: "numeric", minute: "2-digit", hour12: true })}</span>
                {m.edited_at && !m.is_deleted && <span className="opacity-80">• edited</span>}
                {mine && (
                  <span className="ml-1 flex items-center">
                    {otherReadAt && m.created_at <= otherReadAt ? (
                      <div className="flex -space-x-1">
                        <Check className="w-2.5 h-2.5 text-primary" />
                        <Check className="w-2.5 h-2.5 text-primary" />
                      </div>
                    ) : (
                      <Check className="w-2.5 h-2.5 opacity-50" />
                    )}
                  </span>
                )}
              </div>

              {m.reactions && m.reactions.length > 0 && (
                <div className={`absolute -bottom-3 ${mine ? 'right-2' : 'left-2'} flex flex-wrap gap-1 z-10 animate-in fade-in slide-in-from-top-1 duration-200`}>
                  {Array.from(new Set(m.reactions.map(r => r.emoji))).map(emoji => {
                    const count = m.reactions!.filter(r => r.emoji === emoji).length;
                    const isReactionMine = m.reactions!.some(r => r.emoji === emoji && r.user_id === userId);
                    return (
                      <button
                        key={emoji}
                        onClick={(e) => { e.stopPropagation(); onToggleReaction(m.id, emoji); }}
                        className={`flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[11px] font-bold border ${isReactionMine ? 'bg-primary border-primary p-1 text-white' : 'bg-card border-border text-foreground hover:border-primary/50'} shadow-sm transition-all active:scale-95`}
                      >
                        <span>{emoji}</span>
                        {count > 1 && <span>{count}</span>}
                      </button>
                    );
                  })}
                </div>
              )}
            </div>

            {!m.is_deleted && (
              <div className={`opacity-0 group-hover:opacity-100 transition-opacity flex items-center ${mine ? 'order-first' : ''}`}>
                <button
                  onClick={(e) => { e.stopPropagation(); onToggleReactionPicker(m.id); }}
                  className="p-1.5 rounded-full hover:bg-muted text-muted-foreground transition-all active:scale-90"
                >
                  <Smile className="w-4 h-4" />
                </button>
                {showReactionPicker === m.id && (
                  <div className={`absolute ${mine ? 'right-0' : 'left-0'} bottom-full mb-2 z-50 flex gap-1 p-1.5 rounded-2xl border border-border bg-card/95 backdrop-blur-md shadow-2xl animate-in fade-in zoom-in slide-in-from-bottom-2 duration-200`}>
                    {['❤️', '😂', '😮', '😢', '🔥', '👍'].map(emoji => (
                      <button
                        key={emoji}
                        onClick={(e) => { e.stopPropagation(); onToggleReaction(m.id, emoji); onToggleReactionPicker(""); }}
                        className="p-2 sm:p-2.5 hover:bg-muted rounded-xl text-lg sm:text-xl transition-all hover:scale-125 active:scale-90"
                      >
                        {emoji}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
});

export default function ChatThread() {
  const { conversationId } = useParams();
  const { user } = useAuth();
  const { toast } = useToast();
  const navigate = useNavigate();

  const [other, setOther] = useState<Profile | null>(null);
  const [messages, setMessages] = useState<MessageRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [readyToShow, setReadyToShow] = useState(false);
  const [otherTyping, setOtherTyping] = useState(false);
  const [myLastReadAt, setMyLastReadAt] = useState<string | null>(null);
  const [showReactionPicker, setShowReactionPicker] = useState<string | null>(null);
  const [otherReadAt, setOtherReadAt] = useState<string | null>(null);
  const [showMicDialog, setShowMicDialog] = useState(false);
  const [micUnsupported, setMicUnsupported] = useState(false);
  const [micDenied, setMicDenied] = useState(false);
  const [lightboxMedia, setLightboxMedia] = useState<string | null>(null);

  const [replyTo, setReplyTo] = useState<MessageRow | null>(null);
  const [editingMsg, setEditingMsg] = useState<MessageRow | null>(null);
  const [isTouchLike, setIsTouchLike] = useState(false);
  const [actionsForMessageId, setActionsForMessageId] = useState<string | null>(null);
  const [swipeXById, setSwipeXById] = useState<Record<string, number>>({});

  const swipeStartRef = useRef<{
    id: string;
    x: number;
    y: number;
    active: boolean;
  } | null>(null);

  const endRef = useRef<HTMLDivElement | null>(null);
  const convId = conversationId || "";
  const { markConversationRead, lastIncomingMessage, setActiveConvId } = useUnreadContext();
  
  // Mark this conversation as read immediately when opened
  useEffect(() => {
    if (convId) {
      markConversationRead(convId);
      setActiveConvId(convId);
    }
    return () => setActiveConvId(null);
  }, [convId, markConversationRead, setActiveConvId]);

  const markRead = useCallback(async (msgId: string | null) => {
    if (!user || !convId || !msgId) return;
    
    // Clear global unread state for this conversation
    markConversationRead(convId);

    const now = new Date().toISOString();
    setMyLastReadAt(now);
    await supabase
      .from("message_user_state")
      .upsert({
        conversation_id: convId,
        user_id: user.id,
        last_read_message_id: msgId,
        last_read_at: now,
      } as any);
  }, [user?.id, convId, markConversationRead]);

  useEffect(() => {
    const mq = typeof window !== "undefined" ? window.matchMedia("(hover: none), (pointer: coarse)") : null;
    if (!mq) return;
    const apply = () => setIsTouchLike(!!mq.matches);
    apply();
    mq.addEventListener ? mq.addEventListener("change", apply) : mq.addListener(apply);
    return () => {
      mq.removeEventListener ? mq.removeEventListener("change", apply) : mq.removeListener(apply);
    };
  }, []);

  const scrollToBottom = (smooth = true) => {
    endRef.current?.scrollIntoView({ behavior: smooth ? "smooth" : "instant" });
  };

  const beginReply = (m: MessageRow) => {
    setReplyTo(m);
    setEditingMsg(null);
    setActionsForMessageId(null);
    requestAnimationFrame(() => {
      const el = document.getElementById("chat-composer");
      el?.scrollIntoView({ behavior: "smooth", block: "nearest" });
    });
  };

  const loadThread = useCallback(async (isInitial = true, forceScroll = false) => {
    if (!user || !convId) return;
    if (isInitial) setLoading(true);
    try {
      // Fire membership check and messages query in parallel
      const [memsRes, msgsRes] = await Promise.all([
        supabase
          .from("conversation_members")
          .select("conversation_id, user_id")
          .eq("conversation_id", convId),
        supabase
          .from("messages")
          .select(`
            id,
            conversation_id,
            sender_id,
            content,
            created_at,
            is_deleted,
            edited_at,
            reply_to_message_id,
            attachment_url,
            attachment_type,
            message_reactions (
              emoji,
              user_id
            )
          `)
          .eq("conversation_id", convId)
          .order("created_at", { ascending: true }),
      ]);

      if (memsRes.error) throw memsRes.error;
      if (msgsRes.error) throw msgsRes.error;

      const mems = memsRes.data || [];
      const amMember = mems.some((m: any) => m.user_id === user.id);
      if (!amMember) {
        toast({
          title: "No access",
          description: "You're not a member of this chat",
          variant: "destructive",
        });
        navigate("/inbox");
        return;
      }

      // Set messages immediately so UI renders fast
      const msgList = (msgsRes.data || []).map((m: any) => ({
        ...m,
        reactions: m.message_reactions || []
      })) as MessageRow[];
      setMessages(msgList);

      if (isInitial || forceScroll) {
        setTimeout(() => {
          scrollToBottom(!isInitial);
          setReadyToShow(true);
        }, 20);
      }

      // Fire profile & read state queries in background (non-blocking)
      const otherId = mems.find((m: any) => m.user_id !== user.id)?.user_id as string | undefined;
      if (otherId) {
        Promise.all([
          (supabase
            .from("profiles")
            .select("user_id, username, display_name, avatar_url, is_verified") as any)
            .eq("user_id", otherId)
            .maybeSingle(),
          (supabase
            .from("message_user_state")
            .select("last_read_at")
            .eq("conversation_id", convId)
            .eq("user_id", otherId)
            .maybeSingle() as any),
        ]).then(([profRes, readRes]) => {
          if (!profRes.error && profRes.data) setOther(profRes.data as any);
          if (readRes.data) setOtherReadAt((readRes.data as any).last_read_at);
        });
      }

      const lastMsg = msgList.length ? msgList[msgList.length - 1] : null;
      if (lastMsg) markRead(lastMsg.id);
    } catch (e: any) {
      console.error(e);
      toast({
        title: "Chat error",
        description: e?.message || "Failed to load chat",
        variant: "destructive",
      });
    } finally {
      if (isInitial) setLoading(false);
    }
  }, [user?.id, convId, navigate, toast, markRead]);

  useEffect(() => {
    loadThread(true);
  }, [user?.id, convId]);

  // Direct Browser Event Listener (The most reliable sync method)
  useEffect(() => {
    const handleNewZeoMessage = (e: any) => {
      const newMsg = e.detail;
      const msgConvId = String(newMsg?.conversation_id || "").toLowerCase();
      const activeId = String(convId).toLowerCase();

      if (msgConvId === activeId) {
         console.log("REALTIME: Received message for active chat:", newMsg.id);
         setMessages(prev => {
           if (prev.some(m => m.id === newMsg.id)) return prev;
           return [...prev, { ...newMsg, reactions: [] }];
         });
         markRead(newMsg.id);
         setTimeout(() => scrollToBottom(true), 50);
      }
    };

    window.addEventListener("zeo-new-message", handleNewZeoMessage);
    return () => window.removeEventListener("zeo-new-message", handleNewZeoMessage);
  }, [convId, markRead]);

  // Sync from context (Redundant fallback)
  useEffect(() => {
    const rawId = lastIncomingMessage?.conversation_id;
    if (rawId && String(rawId).toLowerCase() === String(convId).toLowerCase()) {
       setMessages(prev => {
         if (prev.some(m => m.id === lastIncomingMessage.id)) return prev;
         return [...prev, { ...lastIncomingMessage, reactions: [] }];
       });
       markRead(lastIncomingMessage.id);
       setTimeout(() => scrollToBottom(true), 50);
    }
  }, [lastIncomingMessage, convId, markRead]);

  useEffect(() => {
    if (!user || !convId) return;

    const channel = supabase
      .channel(`thread-sync-${convId}`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "messages" },
        (payload) => {
          const newMsg = payload.new as any;
          const msgConvId = String(newMsg.conversation_id || "").toLowerCase();
          const activeId = String(convId).toLowerCase();

          if (msgConvId === activeId) {
            setMessages(prev => {
              if (prev.some(m => m.id === newMsg.id)) return prev;
              return [...prev, { ...newMsg, reactions: [] }];
            });
            markRead(newMsg.id);
            setTimeout(() => scrollToBottom(true), 30);
          }
        }
      )
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "messages", filter: `conversation_id=eq.${convId}` },
        (payload) => {
          if (payload.new.conversation_id === convId) {
            setMessages(prev => prev.map(m => m.id === (payload.new as any).id ? { ...m, ...(payload.new as any), reactions: m.reactions } : m));
          }
        }
      )
      .on(
        "postgres_changes",
        { event: "DELETE", schema: "public", table: "messages" },
        (payload) => {
          if (payload.old.conversation_id === convId) {
            loadThread(false);
          }
        }
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "conversation_typing", filter: `conversation_id=eq.${convId}` },
        (payload) => {
          const row = (payload.new || payload.old) as any as TypingRow | null;
          if (!row) return;
          if (row.user_id === user.id) return;
          const fresh = row.updated_at ? new Date(row.updated_at).getTime() > Date.now() - 15000 : false;
          setOtherTyping(!!row.is_typing && fresh);
        }
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "message_user_state", filter: `conversation_id=eq.${convId}` },
        (payload) => {
          const row = (payload.new || payload.old) as any;
          if (row && row.user_id !== user.id) {
            setOtherReadAt(row.last_read_at);
          }
        }
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "message_reactions" },
        () => loadThread(false)
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user?.id, convId, loadThread]);

  useEffect(() => {
    return () => {
      // Typing cleanup now handled in ChatComposer
    };
  }, [user?.id, convId]);

  const deleteForMe = useCallback(async (m: MessageRow) => {
    if (!user) return;
    try {
      const { data: row, error: selErr } = await supabase
        .from("messages")
        .select("deleted_for_user_ids")
        .eq("id", m.id)
        .maybeSingle();
      if (selErr) throw selErr;

      const arr = ((row as any)?.deleted_for_user_ids || []) as string[];
      if (arr.includes(user.id)) return;

      const { error } = await supabase
        .from("messages")
        .update({ deleted_for_user_ids: [...arr, user.id] } as any)
        .eq("id", m.id);
      if (error) throw error;
      loadThread(false);
    } catch (e: any) {
      toast({ title: "Delete failed", description: e?.message || "Couldn't delete", variant: "destructive" });
    }
  }, [user?.id, loadThread, toast]);

  const unsendMessage = useCallback(async (m: MessageRow) => {
    if (!user || m.sender_id !== user.id) return;
    try {
      const { error } = await supabase.from("messages").update({ is_deleted: true } as any).eq("id", m.id);
      if (error) throw error;
      loadThread(false);
    } catch (e: any) {
      toast({ title: "Unsend failed", description: e?.message || "Couldn't unsend", variant: "destructive" });
    }
  }, [user?.id, loadThread, toast]);

  const clearChat = async () => {
    if (!user || !convId) return;
    try {
      const { error } = await supabase
        .from("message_user_state")
        .upsert({ conversation_id: convId, user_id: user.id, cleared_at: new Date().toISOString() } as any);
      if (error) throw error;

      setMessages([]);
      toast({ title: "Chat cleared", description: "Cleared for you only" });
    } catch (e: any) {
      console.error(e);
      setMessages([]);
      toast({
        title: "Clear failed",
        description:
          (e?.message?.includes("row-level security")
            ? "Server clear blocked by RLS for message_user_state. I cleared this chat locally; apply the RLS policy in Supabase to make it persist."
            : e?.message) || "Couldn't clear chat",
        variant: "destructive",
      });
    }
  };

  const toggleReaction = useCallback(async (messageId: string, emoji: string) => {
    if (!user) return;
    try {
      const message = messages.find(m => m.id === messageId);
      const myExistingReactions = message?.reactions?.filter(r => r.user_id === user.id) || [];
      const alreadyHasThisEmoji = myExistingReactions.some(r => r.emoji === emoji);

      // Remove ALL my existing reactions for this message first to enforce "only one reaction can be send"
      if (myExistingReactions.length > 0) {
        await supabase
          .from("message_reactions")
          .delete()
          .eq("message_id", messageId)
          .eq("user_id", user.id);
      }

      // If I didn't have this specific emoji already, add it (toggle behavior)
      if (!alreadyHasThisEmoji) {
        await supabase
          .from("message_reactions")
          .insert({ message_id: messageId, user_id: user.id, emoji });
      }

      loadThread(false);
    } catch (e) { console.error(e); }
  }, [user?.id, messages, loadThread]);

  const startRecording = async () => {
    setShowMicDialog(false);
    setMicDenied(false);

    if (!navigator.mediaDevices?.getUserMedia) {
      setMicUnsupported(true);
      setShowMicDialog(true);
      return;
    }
  };

  const title = other?.display_name || other?.username || "Chat";

  const onSwipeStart = useCallback((e: React.TouchEvent, id: string) => {
    if (!isTouchLike) return;
    const t = e.touches[0];
    swipeStartRef.current = { id, x: t.clientX, y: t.clientY, active: false };
  }, [isTouchLike]);

  const onSwipeMove = useCallback((e: React.TouchEvent, id: string) => {
    if (!isTouchLike) return;
    const start = swipeStartRef.current;
    if (!start || start.id !== id) return;

    const t = e.touches[0];
    const dx = t.clientX - start.x;
    const dy = t.clientY - start.y;

    if (!start.active) {
      if (Math.abs(dx) < 8) return;
      if (Math.abs(dy) > Math.abs(dx)) return;
      start.active = true;
    }
    e.preventDefault();
    const clamped = clamp(dx, 0, 72);
    setSwipeXById((prev) => ({ ...prev, [id]: clamped }));
  }, [isTouchLike]);

  const onSwipeEnd = useCallback((id: string) => {
    if (!isTouchLike) return;
    const start = swipeStartRef.current;
    swipeStartRef.current = null;
    const finalX = swipeXById[id] || 0;
    setSwipeXById((prev) => {
      const next = { ...prev };
      delete next[id];
      return next;
    });
    const targetMsg = messages.find(m => m.id === id);
    if (start?.active && finalX >= 48 && targetMsg) {
      beginReply(targetMsg);
    }
  }, [isTouchLike, swipeXById, messages, beginReply]);

  const onToggleReactionPicker = useCallback((id: string) => {
    setShowReactionPicker(prev => prev === id ? null : id);
  }, []);

  const onShowActions = useCallback((id: string) => {
    setActionsForMessageId(prev => prev === id ? null : id);
  }, []);

  const onReply = useCallback((m: MessageRow) => beginReply(m), [beginReply]);

  const onEdit = useCallback((m: MessageRow) => {
    if (m.is_deleted) return;
    setEditingMsg(m);
    setReplyTo(null);
    setActionsForMessageId(null);
  }, []);

  const onShowLightbox = useCallback((url: string) => setLightboxMedia(url), []);

  const onBack = useCallback(() => navigate("/inbox"), [navigate]);

  return (
    <>
      <div className="max-w-5xl mx-auto px-0 sm:px-4 py-0 sm:py-4 flex flex-col h-[calc(100dvh-5rem)] md:h-[100dvh]">
        <div className="flex-1 overflow-hidden flex flex-col min-h-0 relative">
          <div
            className="flex-1 overflow-y-auto min-h-0 no-scrollbar"
            onClick={() => setActionsForMessageId(null)}
          >
            <div className="sticky top-0 z-20">
              <ChatHeader
                title={title}
                other={other}
                otherTyping={otherTyping}
                otherReadAt={otherReadAt}
                lastMessage={messages.length > 0 ? messages[messages.length - 1] : null}
                onBack={onBack}
                onClear={clearChat}
              />
            </div>

            <div className={`px-4 pb-5 sm:pb-4 space-y-1.5 min-h-0 transition-opacity duration-75 ${readyToShow ? 'opacity-100' : 'opacity-0'}`}>
            {loading && messages.length === 0 ? (
              <div className="flex justify-center py-16">
                <div className="w-8 h-8 rounded-full border-2 border-primary border-t-transparent animate-spin" />
              </div>
            ) : messages.length === 0 ? (
              <div className="text-center py-16 text-muted-foreground">No messages yet. Say hi.</div>
            ) : (
              messages.map((m, idx) => {
                const mine = m.sender_id === user?.id;
                const replyTarget = m.reply_to_message_id ? messages.find((x) => x.id === m.reply_to_message_id) : null;
                const prevMsg = idx > 0 ? messages[idx - 1] : null;
                const isNewDay = !prevMsg || new Date(m.created_at).toDateString() !== new Date(prevMsg.created_at).toDateString();

                const dateLabel = (dateStr: string) => {
                  const date = new Date(dateStr);
                  const today = new Date();
                  const yesterday = new Date();
                  yesterday.setDate(today.getDate() - 1);
                  if (date.toDateString() === today.toDateString()) return "Today";
                  if (date.toDateString() === yesterday.toDateString()) return "Yesterday";
                  return date.toLocaleDateString(undefined, { weekday: 'long', month: 'short', day: 'numeric' });
                };

                return (
                  <MessageItem
                    key={m.id}
                    m={m}
                    mine={mine}
                    replyTarget={replyTarget || null}
                    isNewDay={isNewDay}
                    dateLabel={dateLabel(m.created_at)}
                    swipeX={swipeXById[m.id] || 0}
                    showActions={actionsForMessageId === m.id}
                    isTouchLike={isTouchLike}
                    onReply={onReply}
                    onEdit={onEdit}
                    onDeleteForMe={deleteForMe}
                    onUnsend={unsendMessage}
                    onSwipeStart={onSwipeStart}
                    onSwipeMove={onSwipeMove}
                    onSwipeEnd={onSwipeEnd}
                    onToggleReaction={toggleReaction}
                    onShowLightbox={onShowLightbox}
                    onShowActions={onShowActions}
                    showReactionPicker={showReactionPicker}
                    onToggleReactionPicker={onToggleReactionPicker}
                    otherReadAt={otherReadAt}
                    userId={user?.id || ""}
                  />
                );
              })
            )}
            <div ref={endRef} />
          </div>

          <div className="sticky bottom-0 z-20">
            <ChatComposer
              user={user}
              convId={convId}
              replyTo={replyTo}
              editingMsg={editingMsg}
              setReplyTo={setReplyTo}
              setEditingMsg={setEditingMsg}
              onLoadThread={loadThread}
              onShowMicDialog={() => {
                if (!navigator.mediaDevices?.getUserMedia) {
                  setMicUnsupported(true);
                } else {
                  setMicDenied(true);
                }
                setShowMicDialog(true);
              }}
            />
          </div>
        </div>
        </div>
      </div>

      <Dialog open={!!lightboxMedia} onOpenChange={() => setLightboxMedia(null)}>
        <DialogContent className="max-w-4xl border-none bg-transparent shadow-none p-0 flex items-center justify-center">
          <DialogTitle className="sr-only">Image Preview</DialogTitle>
          {lightboxMedia && (
            <img src={lightboxMedia} alt="Full-screen preview" className="max-w-full max-h-[90vh] object-contain rounded-lg shadow-2xl" />
          )}
        </DialogContent>
      </Dialog>

      <MicPermissionDialog
        isOpen={showMicDialog}
        onOpenChange={(open) => { setShowMicDialog(open); if (!open) { setMicUnsupported(false); setMicDenied(false); } }}
        micUnsupported={micUnsupported}
        micDenied={micDenied}
        onRetry={startRecording}
      />
    </>
  );
}

