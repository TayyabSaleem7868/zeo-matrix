import React, { useEffect, useRef, useState } from "react";
import { Loader2, Play, Pause, Volume2, VolumeX, Maximize } from "lucide-react";

interface VideoPlayerProps {
    url: string;
    playing?: boolean;
    volume?: number;
    muted?: boolean;
    onPlay?: () => void;
    onPause?: () => void;
    onEnded?: () => void;
    className?: string;
    controls?: boolean;
}

const VideoPlayer = ({
    url,
    playing: initialPlaying = true,
    volume = 1,
    muted: initialMuted = false,
    onPlay,
    onPause,
    onEnded,
    className,
    controls = true,
}: VideoPlayerProps) => {
    const videoRef = useRef<HTMLVideoElement>(null);
    const containerRef = useRef<HTMLDivElement>(null);
    const progressRef = useRef<HTMLDivElement>(null);
    const [loading, setLoading] = useState(true);
    const [isPlaying, setIsPlaying] = useState(false);
    const [isMuted, setIsMuted] = useState(initialMuted);
    const [progress, setProgress] = useState(0);
    const [showControls, setShowControls] = useState(false);
    const hideTimer = useRef<ReturnType<typeof setTimeout>>();

    // Pause + mute when scrolled out of view
    useEffect(() => {
        const observer = new IntersectionObserver(
            ([entry]) => {
                const video = videoRef.current;
                if (!video) return;
                if (!entry.isIntersecting) {
                    video.pause();
                    video.muted = true;
                    setIsPlaying(false);
                    setIsMuted(true);
                }
            },
            { threshold: 0.3 }
        );
        if (containerRef.current) observer.observe(containerRef.current);
        return () => observer.disconnect();
    }, []);

    const togglePlay = () => {
        const v = videoRef.current;
        if (!v) return;
        if (v.paused) { v.play(); } else { v.pause(); }
    };

    const toggleMute = (e: React.MouseEvent) => {
        e.stopPropagation();
        const v = videoRef.current;
        if (!v) return;
        v.muted = !v.muted;
        setIsMuted(v.muted);
    };

    const handleFullscreen = (e: React.MouseEvent) => {
        e.stopPropagation();
        const el = containerRef.current;
        if (!el) return;
        if (!document.fullscreenElement) el.requestFullscreen();
        else document.exitFullscreen();
    };

    const handleProgressClick = (e: React.MouseEvent) => {
        e.stopPropagation();
        const v = videoRef.current;
        const bar = progressRef.current;
        if (!v || !bar) return;
        const rect = bar.getBoundingClientRect();
        const ratio = (e.clientX - rect.left) / rect.width;
        v.currentTime = ratio * v.duration;
    };

    const handleMouseMove = () => {
        setShowControls(true);
        clearTimeout(hideTimer.current);
        hideTimer.current = setTimeout(() => setShowControls(false), 2500);
    };

    return (
        <div
            ref={containerRef}
            className={`relative w-full bg-black overflow-hidden rounded-xl group/player ${className}`}
            onClick={togglePlay}
            onMouseMove={handleMouseMove}
            onMouseLeave={() => setShowControls(false)}
            style={{ cursor: "pointer" }}
        >
            {/* Loading spinner */}
            {loading && (
                <div className="absolute inset-0 flex items-center justify-center z-20 bg-black/40 pointer-events-none">
                    <Loader2 className="w-8 h-8 text-primary animate-spin" />
                </div>
            )}

            {/* Video element */}
            <video
                ref={videoRef}
                src={url}
                autoPlay={initialPlaying}
                muted={initialMuted}
                loop={false}
                playsInline
                preload="metadata"
                className="w-full h-full object-contain"
                onWaiting={() => setLoading(true)}
                onCanPlay={() => setLoading(false)}
                onPlaying={() => { setLoading(false); setIsPlaying(true); }}
                onPlay={() => { setIsPlaying(true); onPlay?.(); }}
                onPause={() => { setIsPlaying(false); onPause?.(); }}
                onEnded={() => { setIsPlaying(false); onEnded?.(); }}
                onTimeUpdate={() => {
                    const v = videoRef.current;
                    if (v) setProgress(v.duration ? (v.currentTime / v.duration) * 100 : 0);
                }}
                onVolumeChange={() => {
                    if (videoRef.current) setIsMuted(videoRef.current.muted);
                }}
            />

            {/* Controls overlay */}
            {controls && (
                <div
                    className={`absolute inset-x-0 bottom-0 z-10 transition-opacity duration-300 ${showControls || !isPlaying ? "opacity-100" : "opacity-0"}`}
                    onClick={(e) => e.stopPropagation()}
                >
                    {/* Progress bar */}
                    <div
                        ref={progressRef}
                        className="w-full h-1 bg-white/20 cursor-pointer hover:h-1.5 transition-all"
                        onClick={handleProgressClick}
                    >
                        <div
                            className="h-full bg-primary transition-all"
                            style={{ width: `${progress}%` }}
                        />
                    </div>

                    {/* Buttons */}
                    <div className="flex items-center gap-3 px-3 py-2 bg-gradient-to-t from-black/80 to-transparent">
                        <button
                            onClick={togglePlay}
                            className="text-white hover:text-primary transition-colors"
                        >
                            {isPlaying ? <Pause className="w-5 h-5" /> : <Play className="w-5 h-5" />}
                        </button>

                        <button
                            onClick={toggleMute}
                            className="text-white hover:text-primary transition-colors"
                        >
                            {isMuted ? <VolumeX className="w-5 h-5" /> : <Volume2 className="w-5 h-5" />}
                        </button>

                        <div className="flex-1" />

                        <button
                            onClick={handleFullscreen}
                            className="text-white hover:text-primary transition-colors"
                        >
                            <Maximize className="w-4 h-4" />
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
};

export default VideoPlayer;
