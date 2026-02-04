import { useState, useRef, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import { 
  Play, 
  Pause, 
  RotateCcw,
  Volume2,
  VolumeX,
  Download,
  Loader2
} from "lucide-react";
import { toast } from "@/components/ui/use-toast";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

interface TestimonyPlayerProps {
  audioUrl: string;
  className?: string;
}

const formatTime = (seconds: number): string => {
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins}:${secs.toString().padStart(2, "0")}`;
};

const TestimonyPlayer = ({ audioUrl, className = "" }: TestimonyPlayerProps) => {
  const audioRef = useRef<HTMLAudioElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [playbackRate, setPlaybackRate] = useState("1");
  const [isMuted, setIsMuted] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [downloading, setDownloading] = useState(false);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;

    const handleLoadedMetadata = () => {
      setDuration(audio.duration);
      setIsLoading(false);
    };

    const handleTimeUpdate = () => {
      setCurrentTime(audio.currentTime);
    };

    const handleEnded = () => {
      setIsPlaying(false);
      setCurrentTime(0);
    };

    const handleError = () => {
      setError("Erro ao carregar áudio");
      setIsLoading(false);
    };

    const handleCanPlay = () => {
      setIsLoading(false);
    };

    audio.addEventListener("loadedmetadata", handleLoadedMetadata);
    audio.addEventListener("timeupdate", handleTimeUpdate);
    audio.addEventListener("ended", handleEnded);
    audio.addEventListener("error", handleError);
    audio.addEventListener("canplay", handleCanPlay);

    return () => {
      audio.removeEventListener("loadedmetadata", handleLoadedMetadata);
      audio.removeEventListener("timeupdate", handleTimeUpdate);
      audio.removeEventListener("ended", handleEnded);
      audio.removeEventListener("error", handleError);
      audio.removeEventListener("canplay", handleCanPlay);
    };
  }, [audioUrl]);

  useEffect(() => {
    // Draw static waveform visualization
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const width = canvas.width;
    const height = canvas.height;
    const barWidth = 3;
    const gap = 2;
    const barCount = Math.floor(width / (barWidth + gap));

    // Clear canvas
    ctx.clearRect(0, 0, width, height);

    // Generate random waveform pattern (static visualization)
    const progressRatio = duration > 0 ? currentTime / duration : 0;
    const playedBars = Math.floor(barCount * progressRatio);

    for (let i = 0; i < barCount; i++) {
      // Pseudo-random height based on position
      const seed = Math.sin(i * 0.5) * Math.cos(i * 0.3) + 1;
      const barHeight = (seed * 0.4 + 0.2) * height;
      
      const x = i * (barWidth + gap);
      const y = (height - barHeight) / 2;
      
      // Color based on playback progress
      if (i < playedBars) {
        ctx.fillStyle = "hsl(142, 76%, 45%)"; // emerald
      } else {
        ctx.fillStyle = "hsl(0, 0%, 70%)"; // gray
      }
      
      ctx.beginPath();
      ctx.roundRect(x, y, barWidth, barHeight, 1);
      ctx.fill();
    }
  }, [currentTime, duration]);

  const togglePlay = async () => {
    const audio = audioRef.current;
    if (!audio) return;

    if (isPlaying) {
      audio.pause();
    } else {
      await audio.play();
    }
    setIsPlaying(!isPlaying);
  };

  const handleSeek = (value: number[]) => {
    const audio = audioRef.current;
    if (!audio) return;
    audio.currentTime = value[0];
    setCurrentTime(value[0]);
  };

  const handleReset = () => {
    const audio = audioRef.current;
    if (!audio) return;
    audio.currentTime = 0;
    setCurrentTime(0);
  };

  const handlePlaybackRateChange = (rate: string) => {
    const audio = audioRef.current;
    if (!audio) return;
    audio.playbackRate = parseFloat(rate);
    setPlaybackRate(rate);
  };

  const toggleMute = () => {
    const audio = audioRef.current;
    if (!audio) return;
    audio.muted = !isMuted;
    setIsMuted(!isMuted);
  };

  const handleDownload = async () => {
    if (!audioUrl || downloading) return;
    setDownloading(true);
    
    try {
      const response = await fetch(audioUrl);
      if (!response.ok) throw new Error("Falha ao buscar áudio");
      
      const blob = await response.blob();
      
      // Gerar nome do arquivo baseado na data
      const timestamp = new Date().toISOString().split('T')[0];
      const extension = audioUrl.includes('.mp4') ? 'mp4' : 'webm';
      const filename = `testemunho-${timestamp}.${extension}`;
      
      // Criar link de download
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = filename;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
      
      toast({
        title: "Download iniciado",
        description: `Arquivo: ${filename}`,
      });
    } catch (error) {
      console.error('Download failed:', error);
      toast({
        title: "Erro no download",
        description: "Não foi possível baixar o áudio. Tente novamente.",
        variant: "destructive",
      });
    } finally {
      setDownloading(false);
    }
  };

  if (error) {
    return (
      <div className={`p-4 rounded-lg bg-destructive/10 text-destructive text-sm ${className}`}>
        {error}
      </div>
    );
  }

  return (
    <div className={`space-y-3 ${className}`}>
      <audio ref={audioRef} src={audioUrl} preload="metadata" />
      
      {/* Waveform */}
      <div className="relative">
        <canvas 
          ref={canvasRef} 
          width={400} 
          height={60}
          className="w-full h-[60px] rounded-md bg-muted/50 cursor-pointer"
          onClick={(e) => {
            if (!duration) return;
            const rect = e.currentTarget.getBoundingClientRect();
            const x = e.clientX - rect.left;
            const ratio = x / rect.width;
            handleSeek([ratio * duration]);
          }}
        />
        {isLoading && (
          <div className="absolute inset-0 flex items-center justify-center bg-muted/80 rounded-md">
            <span className="text-sm text-muted-foreground">Carregando...</span>
          </div>
        )}
      </div>

      {/* Progress slider */}
      <Slider
        value={[currentTime]}
        max={duration || 100}
        step={0.1}
        onValueChange={handleSeek}
        className="cursor-pointer"
      />

      {/* Controls */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="icon"
            onClick={handleReset}
            disabled={isLoading}
          >
            <RotateCcw className="h-4 w-4" />
          </Button>
          
          <Button
            variant="default"
            size="icon"
            onClick={togglePlay}
            disabled={isLoading}
            className="h-10 w-10"
          >
            {isPlaying ? (
              <Pause className="h-5 w-5" />
            ) : (
              <Play className="h-5 w-5 ml-0.5" />
            )}
          </Button>
          
          <Button
            variant="ghost"
            size="icon"
            onClick={toggleMute}
            disabled={isLoading}
          >
            {isMuted ? (
              <VolumeX className="h-4 w-4" />
            ) : (
              <Volume2 className="h-4 w-4" />
            )}
          </Button>
        </div>

        {/* Time display */}
        <div className="text-sm font-mono text-muted-foreground">
          {formatTime(currentTime)} / {formatTime(duration)}
        </div>

        {/* Download button */}
        <Button
          variant="outline"
          size="icon"
          onClick={handleDownload}
          disabled={isLoading || downloading}
          title="Baixar áudio"
        >
          {downloading ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Download className="h-4 w-4" />
          )}
        </Button>

        {/* Playback speed */}
        <Select value={playbackRate} onValueChange={handlePlaybackRateChange}>
          <SelectTrigger className="w-[80px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="0.75">0.75x</SelectItem>
            <SelectItem value="1">1x</SelectItem>
            <SelectItem value="1.25">1.25x</SelectItem>
            <SelectItem value="1.5">1.5x</SelectItem>
            <SelectItem value="2">2x</SelectItem>
          </SelectContent>
        </Select>
      </div>
    </div>
  );
};

export default TestimonyPlayer;
