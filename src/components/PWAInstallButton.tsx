import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Download } from "lucide-react";
import { toast } from "sonner";

export function PWAInstallButton() {
    const [installPrompt, setInstallPrompt] = useState<any>(null);
    const [isStandalone, setIsStandalone] = useState(false);
    const [isMobile, setIsMobile] = useState(false);
    const [isInstalled, setIsInstalled] = useState(false);
    const [isIOS, setIsIOS] = useState(false);

    useEffect(() => {
        const checkState = () => {
            const isTouch = window.matchMedia("(pointer: coarse)").matches;
            const isSmall = window.innerWidth <= 1024;
            setIsMobile(isTouch && isSmall);
            const ua = window.navigator.userAgent.toLowerCase();
            setIsIOS(/iphone|ipad|ipod/.test(ua));

            if (window.matchMedia("(display-mode: standalone)").matches || (window.navigator as any).standalone) {
                setIsStandalone(true);
                setIsInstalled(true);
            }
        };

        checkState();
        window.addEventListener("resize", checkState);

        const updateFromGlobal = () => {
            const prompt = (window as any).deferredPrompt;
            if (prompt) {
                setInstallPrompt(prompt);
            }
        };

        updateFromGlobal();
        const timer = setInterval(updateFromGlobal, 1000);
        window.addEventListener('pwa-ready-signal', updateFromGlobal);
        window.addEventListener('pwa-installed-signal', () => {
            setIsInstalled(true);
            setInstallPrompt(null);
        });

        return () => {
            clearInterval(timer);
            window.removeEventListener("resize", checkState);
            window.removeEventListener('pwa-ready-signal', updateFromGlobal);
        };
    }, []);

    const handleInstall = async (e: React.MouseEvent) => {
        e.preventDefault();
        e.stopPropagation();

        if (isInstalled || isStandalone) return;

        // Provide immediate feedback for iOS
        if (isIOS) {
            toast.info("To install on iOS: Tap 'Share' (box with arrow) and then 'Add to Home Screen'.", {
                duration: 6000,
            });
            return;
        }

        const prompt = installPrompt || (window as any).deferredPrompt;

        if (!prompt) {
            // If the browser hasn't fired the event yet, help the user do it manually
            toast.info("Install directly from your browser menu: tap the 3 dots (⋮) and look for 'Install app' or 'Add to Home screen'.", {
                duration: 6000,
            });
            console.log("PWA: No prompt event yet, showing manual fallback.");
            return;
        }

        try {
            await prompt.prompt();
            const { outcome } = await prompt.userChoice;
            if (outcome === "accepted") {
                setIsInstalled(true);
                setInstallPrompt(null);
                (window as any).deferredPrompt = null;
            }
        } catch (err) {
            console.error("PWA: Error", err);
            toast.error("Installation interrupted. Try via browser menu.");
        }
    };

    if (!isMobile || isStandalone) return null;

    return (
        <div className="px-3 py-1.5 flex items-center justify-center">
            <button
                onClick={handleInstall}
                type="button"
                className={`text-xs font-medium transition-all flex items-center gap-2 w-full active:scale-95 touch-manipulation ${isInstalled
                    ? "text-primary/40 cursor-default"
                    : "text-primary hover:text-primary/80 cursor-pointer border-none bg-transparent p-1"
                    }`}
            >
                <Download className="w-3.5 h-3.5" />
                <span className="whitespace-nowrap">
                    {isInstalled ? "App is installed" : "Install Application"}
                </span>
            </button>
        </div>
    );
}
