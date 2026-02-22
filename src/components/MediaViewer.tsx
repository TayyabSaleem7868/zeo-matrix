import { useState, useEffect, useCallback } from "react";
import { X, ChevronLeft, ChevronRight, Maximize2, Minimize2, MonitorPlay } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import useEmblaCarousel from "embla-carousel-react";
import VideoPlayer from "./VideoPlayer";

interface MediaItem {
    url: string;
    type: "image" | "video" | "pdf" | "doc" | "docx" | "zip" | "rar" | "other";
    name?: string;
}

interface MediaViewerProps {
    media: MediaItem[];
    initialIndex?: number;
    isOpen: boolean;
    onClose: () => void;
}

const MediaViewer = ({ media, initialIndex = 0, isOpen, onClose }: MediaViewerProps) => {
    const [currentIndex, setCurrentIndex] = useState(initialIndex);
    const [isFullscreen, setIsFullscreen] = useState(false);
    const [emblaRef, emblaApi] = useEmblaCarousel({
        loop: true,
        duration: 35,
        startIndex: initialIndex
    });

    const onSelect = useCallback(() => {
        if (!emblaApi) return;
        setCurrentIndex(emblaApi.selectedScrollSnap());
    }, [emblaApi]);

    useEffect(() => {
        if (!emblaApi) return;
        emblaApi.on("select", onSelect);
        emblaApi.reInit({ startIndex: initialIndex });
    }, [emblaApi, initialIndex, isOpen]);

    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if (!isOpen) return;
            if (e.key === "Escape") onClose();
            if (e.key === "ArrowLeft") emblaApi?.scrollPrev();
            if (e.key === "ArrowRight") emblaApi?.scrollNext();
        };
        window.addEventListener("keydown", handleKeyDown);
        return () => window.removeEventListener("keydown", handleKeyDown);
    }, [isOpen, emblaApi]);

    // Pause all background feed videos when viewer opens
    useEffect(() => {
        if (isOpen) {
            document.querySelectorAll<HTMLVideoElement>("video").forEach(v => {
                if (!v.paused) {
                    v.pause();
                    v.dataset.wasPlaying = "true";
                }
            });
        } else {
            // Resume any that were playing before the viewer opened
            document.querySelectorAll<HTMLVideoElement>("video").forEach(v => {
                if (v.dataset.wasPlaying === "true") {
                    delete v.dataset.wasPlaying;
                    v.play().catch(() => { });
                }
            });
        }
    }, [isOpen]);

    if (!isOpen) return null;

    const toggleFullscreen = () => {
        if (!document.fullscreenElement) {
            document.documentElement.requestFullscreen();
            setIsFullscreen(true);
        } else {
            if (document.exitFullscreen) {
                document.exitFullscreen();
                setIsFullscreen(false);
            }
        }
    };

    return (
        <div
            className="fixed inset-0 z-[100] flex flex-col items-center justify-center bg-black/95 backdrop-blur-xl animate-in fade-in duration-300"
            onClick={onClose}
        >
            {/* Header */}
            <div className="absolute top-0 left-0 right-0 p-4 sm:p-6 flex items-center justify-between z-[110] bg-gradient-to-b from-black/70 to-transparent" onClick={(e) => e.stopPropagation()}>
                <div className="px-4 py-1.5 rounded-full bg-white/10 backdrop-blur-md border border-white/10 text-white text-xs font-bold tracking-widest hidden sm:block">
                    {currentIndex + 1} / {media.length}
                </div>
                <div className="flex items-center gap-2">
                    <Button
                        variant="ghost"
                        size="icon"
                        onClick={toggleFullscreen}
                        className="text-white hover:bg-white/10 rounded-full h-10 w-10 transition-transform active:scale-95"
                    >
                        {isFullscreen ? <Minimize2 className="w-5 h-5" /> : <Maximize2 className="w-5 h-5" />}
                    </Button>
                    <Button
                        variant="ghost"
                        size="icon"
                        onClick={onClose}
                        className="text-white hover:bg-white/10 rounded-full h-10 w-10 transition-transform active:scale-95"
                    >
                        <X className="w-6 h-6" />
                    </Button>
                </div>
            </div>

            {/* Main Content */}
            <div className="relative w-full h-full flex items-center justify-center overflow-hidden" ref={emblaRef} onClick={(e) => e.stopPropagation()}>
                <div className="flex h-full w-full">
                    {media.map((item, idx) => (
                        <div key={idx} className="relative flex-[0_0_100%] min-w-0 h-full flex items-center justify-center p-4 sm:p-12 md:p-20">
                            <div className="relative max-w-full max-h-full flex items-center justify-center animate-in zoom-in-95 fade-in duration-500">
                                {item.type === "image" ? (
                                    <img
                                        src={item.url}
                                        alt=""
                                        className="max-w-full max-h-[80vh] object-contain rounded-xl shadow-[0_0_50px_rgba(0,0,0,0.5)] select-none pointer-events-none"
                                    />
                                ) : (
                                    <div className="relative w-full max-w-4xl aspect-video flex items-center justify-center bg-black rounded-xl overflow-hidden shadow-2xl">
                                        <VideoPlayer
                                            url={item.url}
                                            playing={currentIndex === idx}
                                            className="w-full h-full"
                                        />
                                    </div>
                                )}
                            </div>
                        </div>
                    ))}
                </div>
            </div>

            {/* Navigation Controls */}
            {media.length > 1 && (
                <>
                    <Button
                        variant="ghost"
                        size="icon"
                        onClick={(e) => { e.stopPropagation(); emblaApi?.scrollPrev(); }}
                        className="absolute left-6 top-1/2 -translate-y-1/2 z-[110] text-white/50 hover:text-white hover:bg-white/10 rounded-full h-14 w-14 hidden lg:flex transition-all"
                    >
                        <ChevronLeft className="w-10 h-10" />
                    </Button>
                    <Button
                        variant="ghost"
                        size="icon"
                        onClick={(e) => { e.stopPropagation(); emblaApi?.scrollNext(); }}
                        className="absolute right-6 top-1/2 -translate-y-1/2 z-[110] text-white/50 hover:text-white hover:bg-white/10 rounded-full h-14 w-14 hidden lg:flex transition-all"
                    >
                        <ChevronRight className="w-10 h-10" />
                    </Button>
                </>
            )}

            {/* Mobile Pagination */}
            <div className="absolute bottom-28 sm:bottom-32 flex lg:hidden gap-1.5 z-50">
                {media.map((_, i) => (
                    <div key={i} className={`w-1.5 h-1.5 rounded-full transition-all duration-300 ${i === currentIndex ? "bg-white w-4 shadow-glow" : "bg-white/30"}`} />
                ))}
            </div>

            {/* Thumbnails Strip */}
            {media.length > 1 && (
                <div className="absolute bottom-8 left-0 right-0 flex justify-center gap-3 px-6 overflow-x-auto pb-4 scrollbar-none z-[110]" onClick={(e) => e.stopPropagation()}>
                    {media.map((item, idx) => (
                        <button
                            key={idx}
                            onClick={(e) => { e.stopPropagation(); emblaApi?.scrollTo(idx); }}
                            className={cn(
                                "w-14 h-14 sm:w-16 sm:h-16 rounded-xl overflow-hidden border-2 transition-all duration-300 flex-shrink-0 shadow-lg active:scale-95",
                                currentIndex === idx
                                    ? "border-primary scale-110 shadow-primary/20"
                                    : "border-white/10 opacity-40 hover:opacity-80 hover:border-white/30"
                            )}
                        >
                            {item.type === "image" ? (
                                <img src={item.url} className="w-full h-full object-cover" alt="" />
                            ) : (
                                <div className="w-full h-full bg-slate-900 flex items-center justify-center">
                                    <MonitorPlay className="w-6 h-6 text-white/40" />
                                </div>
                            )}
                        </button>
                    ))}
                </div>
            )}
        </div>
    );
};

export default MediaViewer;
