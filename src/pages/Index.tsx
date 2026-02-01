import { useNavigate } from "react-router-dom";
import { useEffect, useState, useRef } from "react";
import { Heart, Shield, MessageCircle, LogIn } from "lucide-react";
import zionLogo from "@/assets/zion-logo.png";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/useAuth";
import SafetyExit from "@/components/SafetyExit";
import { InstallAppButton } from "@/components/InstallAppButton";

const Index = () => {
  const navigate = useNavigate();
  const { user, loading } = useAuth();
  
  // Robust video state machine
  const [showVideo, setShowVideo] = useState(false);
  const hasShownVideoRef = useRef(false);
  const videoRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    if (!loading && user) {
      navigate("/chat");
    }
  }, [user, loading, navigate]);

  // Force play on mount (helps some browsers)
  useEffect(() => {
    const video = videoRef.current;
    if (video) {
      video.play().catch(() => {
        // Autoplay blocked - poster will remain visible
      });
    }
  }, []);

  const handleNeedHelp = () => {
    navigate("/chat?mode=nicodemos");
  };

  const handleLogin = () => {
    navigate("/auth");
  };

  // Only show video when confirmed playing with progress
  const handlePlaying = () => {
    const video = videoRef.current;
    if (video && video.currentTime > 0 && !video.paused && !hasShownVideoRef.current) {
      // Small delay to ensure stable playback
      setTimeout(() => {
        if (video && !video.paused && video.currentTime > 0.1) {
          setShowVideo(true);
          hasShownVideoRef.current = true;
        }
      }, 250);
    }
  };

  // Handle timeupdate as backup confirmation
  const handleTimeUpdate = () => {
    const video = videoRef.current;
    if (video && video.currentTime > 0.3 && !hasShownVideoRef.current) {
      setShowVideo(true);
      hasShownVideoRef.current = true;
    }
  };

  return (
    <div className="relative min-h-screen overflow-hidden">
      <SafetyExit />

      {/* Video Background with Ken Burns on wrapper */}
      <div className="absolute inset-0 -z-20 overflow-hidden">
        {/* Static poster - always behind, fades out when video ready */}
        <div 
          className={`absolute inset-0 bg-cover bg-center transition-opacity duration-1000 ${
            showVideo ? 'opacity-0' : 'opacity-100'
          }`}
          style={{ backgroundImage: 'url(/videos/hero-poster.webp)' }}
        />
        
        {/* Ken Burns wrapper - animation on container, not video */}
        <div className={`absolute inset-0 animate-ken-burns transition-opacity duration-1000 ${
          showVideo ? 'opacity-100' : 'opacity-0'
        }`}>
          <video
            ref={videoRef}
            autoPlay
            muted
            loop
            playsInline
            preload="auto"
            onPlaying={handlePlaying}
            onTimeUpdate={handleTimeUpdate}
            className="h-full w-full object-cover"
          >
            {/* WebM first - smaller and more efficient (Chrome/Edge/Firefox) */}
            <source src="/videos/hero-background.webm" type="video/webm" />
            {/* MP4 fallback - Safari/iOS and older browsers */}
            <source src="/videos/hero-background.mp4" type="video/mp4" />
          </video>
        </div>

        {/* Overlay for readability */}
        <div className="absolute inset-0 bg-black/40" />

        {/* Gradient at bottom */}
        <div className="absolute inset-x-0 bottom-0 h-1/3 bg-gradient-to-t from-black/60 to-transparent" />
      </div>

      <div className="container relative mx-auto flex min-h-screen flex-col items-center justify-center px-4">
        {/* Logo/Brand */}
        <div
          className="mb-8 text-center opacity-0 animate-fade-slide-up"
          style={{ animationDelay: "0ms", animationFillMode: "forwards" }}
        >
          {/* Logo + Texto lado a lado */}
          <div className="flex items-center justify-center gap-3 mb-2">
            <img 
              src={zionLogo} 
              alt="Zion Logo" 
              className="h-12 w-12 md:h-14 md:w-14 drop-shadow-lg"
            />
            <h1 className="text-5xl font-bold tracking-tight text-white drop-shadow-lg md:text-6xl">
              Zion
            </h1>
          </div>
        </div>

        {/* Hero Content */}
        <div
          className="mb-12 max-w-lg text-center opacity-0 animate-fade-slide-up"
          style={{ animationDelay: "200ms", animationFillMode: "forwards" }}
        >
          <h2 className="mb-4 text-2xl font-medium text-white drop-shadow-lg md:text-3xl">
            Encontre paz e orientação
          </h2>
          <p
            className="text-white/80 drop-shadow-md opacity-0 animate-fade-slide-up"
            style={{ animationDelay: "300ms", animationFillMode: "forwards" }}
          >
            Um espaço seguro para compartilhar seus pensamentos, encontrar
            acolhimento e descobrir esperança através da fé.
          </p>
        </div>

        {/* Action Buttons */}
        <div className="flex w-full max-w-sm flex-col gap-4">
          <div
            className="opacity-0 animate-fade-slide-up"
            style={{ animationDelay: "400ms", animationFillMode: "forwards" }}
          >
            <Button
              onClick={handleNeedHelp}
              size="lg"
              className="group relative h-16 w-full overflow-hidden rounded-xl bg-gradient-to-r from-emerald-500 to-lime-500 text-lg font-semibold text-white shadow-xl shadow-emerald-500/40 transition-all duration-300 hover:shadow-2xl hover:shadow-emerald-500/50 hover:scale-[1.03]"
            >
              <MessageCircle className="mr-3 h-6 w-6 transition-transform duration-300 group-hover:scale-110" />
              Preciso de Ajuda Agora
            </Button>
          </div>

          <div
            className="opacity-0 animate-fade-slide-up"
            style={{ animationDelay: "500ms", animationFillMode: "forwards" }}
          >
            <Button
              onClick={handleLogin}
              variant="outline"
              size="lg"
              className="h-16 w-full rounded-xl border-0 bg-white text-lg font-semibold text-gray-900 shadow-lg transition-all duration-300 hover:bg-gray-50 hover:scale-[1.02]"
            >
              <LogIn className="mr-3 h-6 w-6" />
              Entrar / Cadastrar
            </Button>
          </div>

          <div
            className="opacity-0 animate-fade-slide-up"
            style={{ animationDelay: "600ms", animationFillMode: "forwards" }}
          >
            <InstallAppButton variant="hero" />
          </div>
        </div>

        {/* Trust Indicators */}
        <div
          className="mt-16 flex flex-wrap items-center justify-center gap-8 text-sm text-white/80 opacity-0 animate-fade-slide-up"
          style={{ animationDelay: "700ms", animationFillMode: "forwards" }}
        >
          <div className="flex items-center gap-2 drop-shadow-md">
            <Shield className="h-4 w-4 text-emerald-400" />
            <span>100% Confidencial</span>
          </div>
          <div className="flex items-center gap-2 drop-shadow-md">
            <Heart className="h-4 w-4 text-emerald-400" />
            <span>Acolhimento Cristão</span>
          </div>
        </div>

        {/* Footer */}
        <footer
          className="absolute bottom-6 left-0 right-0 text-center opacity-0 animate-fade-slide-up"
          style={{ animationDelay: "700ms", animationFillMode: "forwards" }}
        >
          {/* Separador fino */}
          <div className="mx-auto mb-4 h-px w-32 bg-white/20" />
          <p className="text-sm text-white/70 drop-shadow-md">
            Você não está sozinho. Há esperança.
          </p>
        </footer>
      </div>
    </div>
  );
};

export default Index;
