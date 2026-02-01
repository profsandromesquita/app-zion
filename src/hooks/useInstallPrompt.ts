import { useState, useEffect, useCallback } from "react";

interface BeforeInstallPromptEvent extends Event {
  prompt(): Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

declare global {
  interface WindowEventMap {
    beforeinstallprompt: BeforeInstallPromptEvent;
  }
}

export function useInstallPrompt() {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [isInstalled, setIsInstalled] = useState(false);
  
  const isIOS = typeof navigator !== "undefined" && /iPad|iPhone|iPod/.test(navigator.userAgent);
  const isAndroid = typeof navigator !== "undefined" && /Android/.test(navigator.userAgent);
  const canInstallNatively = deferredPrompt !== null;

  useEffect(() => {
    // Check if already installed (standalone mode)
    if (typeof window !== "undefined") {
      const isStandalone = window.matchMedia("(display-mode: standalone)").matches;
      const isIOSStandalone = (navigator as any).standalone === true;
      
      if (isStandalone || isIOSStandalone) {
        setIsInstalled(true);
        return;
      }
    }

    // Capture beforeinstallprompt event
    const handlePrompt = (e: BeforeInstallPromptEvent) => {
      e.preventDefault();
      setDeferredPrompt(e);
    };

    // Detect when app is installed
    const handleInstalled = () => {
      setIsInstalled(true);
      setDeferredPrompt(null);
    };

    window.addEventListener("beforeinstallprompt", handlePrompt);
    window.addEventListener("appinstalled", handleInstalled);

    return () => {
      window.removeEventListener("beforeinstallprompt", handlePrompt);
      window.removeEventListener("appinstalled", handleInstalled);
    };
  }, []);

  const promptInstall = useCallback(async (): Promise<boolean> => {
    if (!deferredPrompt) return false;
    
    try {
      await deferredPrompt.prompt();
      const { outcome } = await deferredPrompt.userChoice;
      setDeferredPrompt(null);
      
      if (outcome === "accepted") {
        setIsInstalled(true);
      }
      
      return outcome === "accepted";
    } catch (error) {
      console.error("Error prompting install:", error);
      return false;
    }
  }, [deferredPrompt]);

  return {
    canInstallNatively,
    isInstalled,
    isIOS,
    isAndroid,
    promptInstall,
  };
}
