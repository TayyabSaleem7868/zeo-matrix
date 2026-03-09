import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";
import { registerSW } from "virtual:pwa-register";

// Register PWA service worker safely
try {
    registerSW({
        immediate: true,
        onRegistered(r) {
            console.log('SW registered');
        },
        onRegisterError(error) {
            console.error('SW registration error', error);
        }
    });
} catch (e) {
    console.error("PWA registration failed", e);
}

createRoot(document.getElementById("root")!).render(<App />);
