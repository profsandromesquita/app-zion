import { useState, useRef, useCallback } from "react";
import { Upload, FileAudio, X, AlertCircle, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Alert, AlertDescription } from "@/components/ui/alert";

interface AudioUploaderProps {
  maxFileSizeMB?: number;
  minDurationSeconds?: number;
  maxDurationSeconds?: number;
  onFileSelected: (blob: Blob, durationSeconds: number) => void;
  disabled?: boolean;
}

const ACCEPTED_AUDIO_TYPES = [
  "audio/mpeg",      // .mp3
  "audio/wav",       // .wav
  "audio/x-wav",     // .wav (alternative)
  "audio/mp4",       // .m4a
  "audio/x-m4a",     // .m4a (alternative)
  "audio/webm",      // .webm
  "audio/ogg",       // .ogg
  "audio/aac",       // .aac
];

const ACCEPTED_EXTENSIONS = ".mp3,.wav,.m4a,.webm,.ogg,.aac";

const formatTime = (seconds: number): string => {
  if (!isFinite(seconds) || isNaN(seconds) || seconds < 0) {
    return "00:00";
  }
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`;
};

const formatFileSize = (bytes: number): string => {
  if (bytes < 1024 * 1024) {
    return `${(bytes / 1024).toFixed(1)} KB`;
  }
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
};

const getAudioDuration = async (file: File): Promise<number> => {
  return new Promise((resolve, reject) => {
    const audio = new Audio();
    const objectUrl = URL.createObjectURL(file);
    let resolved = false;

    const cleanup = () => {
      URL.revokeObjectURL(objectUrl);
    };

    const tryGetDuration = () => {
      const duration = audio.duration;
      if (isFinite(duration) && !isNaN(duration) && duration > 0) {
        if (!resolved) {
          resolved = true;
          cleanup();
          resolve(Math.floor(duration));
        }
      }
    };

    // Try on loadedmetadata
    audio.addEventListener("loadedmetadata", tryGetDuration);
    
    // Try on durationchange (more reliable for WebM)
    audio.addEventListener("durationchange", tryGetDuration);
    
    // Try when ready to play
    audio.addEventListener("canplaythrough", tryGetDuration);

    audio.addEventListener("error", () => {
      if (!resolved) {
        resolved = true;
        cleanup();
        reject(new Error("Não foi possível processar o arquivo de áudio."));
      }
    });

    audio.src = objectUrl;
    audio.load();

    // Timeout: If after 5 seconds no duration, fail
    setTimeout(() => {
      if (!resolved) {
        resolved = true;
        cleanup();
        reject(new Error("Não foi possível determinar a duração do áudio."));
      }
    }, 5000);
  });
};

const AudioUploader = ({
  maxFileSizeMB = 50,
  minDurationSeconds = 60,
  maxDurationSeconds = 900,
  onFileSelected,
  disabled = false,
}: AudioUploaderProps) => {
  const [isDragging, setIsDragging] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [duration, setDuration] = useState(0);
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [isConfirmed, setIsConfirmed] = useState(false);
  
  const inputRef = useRef<HTMLInputElement>(null);

  const cleanup = useCallback(() => {
    if (audioUrl) {
      URL.revokeObjectURL(audioUrl);
    }
  }, [audioUrl]);

  const validateFile = async (selectedFile: File): Promise<boolean> => {
    setError(null);
    
    // Check MIME type
    const isValidType = ACCEPTED_AUDIO_TYPES.some(type => 
      selectedFile.type === type || selectedFile.type.startsWith(type.split("/")[0])
    );
    
    if (!isValidType && !selectedFile.name.match(/\.(mp3|wav|m4a|webm|ogg|aac)$/i)) {
      setError("Formato não suportado. Use MP3, WAV, M4A, WebM, OGG ou AAC.");
      return false;
    }
    
    // Check file size
    const maxBytes = maxFileSizeMB * 1024 * 1024;
    if (selectedFile.size > maxBytes) {
      setError(`Arquivo muito grande. Máximo ${maxFileSizeMB}MB.`);
      return false;
    }
    
    // Check duration
    setIsProcessing(true);
    try {
      const fileDuration = await getAudioDuration(selectedFile);
      
      if (fileDuration < minDurationSeconds) {
        setError(`Áudio muito curto. Mínimo ${formatTime(minDurationSeconds)}.`);
        setIsProcessing(false);
        return false;
      }
      
      if (fileDuration > maxDurationSeconds) {
        setError(`Áudio muito longo. Máximo ${formatTime(maxDurationSeconds)}.`);
        setIsProcessing(false);
        return false;
      }
      
      setDuration(fileDuration);
      setIsProcessing(false);
      return true;
    } catch (err) {
      setError("Não foi possível processar o arquivo de áudio. Tente outro formato.");
      setIsProcessing(false);
      return false;
    }
  };

  const handleFile = async (selectedFile: File) => {
    cleanup();
    setFile(null);
    setAudioUrl(null);
    setIsConfirmed(false);
    
    const isValid = await validateFile(selectedFile);
    if (!isValid) return;
    
    setFile(selectedFile);
    setAudioUrl(URL.createObjectURL(selectedFile));
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    if (!disabled) {
      setIsDragging(true);
    }
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    
    if (disabled) return;
    
    const droppedFile = e.dataTransfer.files[0];
    if (droppedFile) {
      handleFile(droppedFile);
    }
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (selectedFile) {
      handleFile(selectedFile);
    }
  };

  const handleReset = () => {
    cleanup();
    setFile(null);
    setAudioUrl(null);
    setDuration(0);
    setError(null);
    setIsConfirmed(false);
    if (inputRef.current) {
      inputRef.current.value = "";
    }
  };

  const handleConfirm = () => {
    if (file && duration >= minDurationSeconds) {
      setIsConfirmed(true);
      onFileSelected(file, duration);
    }
  };

  const progress = (duration / maxDurationSeconds) * 100;

  // Empty state - show drop zone
  if (!file) {
    return (
      <div className="space-y-4">
        {error && (
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}
        
        <div
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
          onClick={() => !disabled && inputRef.current?.click()}
          className={`
            relative rounded-lg border-2 border-dashed p-8 text-center transition-all cursor-pointer
            ${isDragging 
              ? "border-primary bg-primary/10" 
              : "border-border hover:border-primary/50 hover:bg-muted/50"
            }
            ${disabled ? "opacity-50 cursor-not-allowed" : ""}
            ${isProcessing ? "pointer-events-none" : ""}
          `}
        >
          <input
            ref={inputRef}
            type="file"
            accept={ACCEPTED_EXTENSIONS}
            onChange={handleInputChange}
            className="hidden"
            disabled={disabled || isProcessing}
          />
          
          <div className="flex flex-col items-center gap-4">
            <div className="rounded-full bg-muted p-4">
              <Upload className="h-8 w-8 text-muted-foreground" />
            </div>
            
            <div className="space-y-1">
              <p className="font-medium text-foreground">
                {isProcessing ? "Processando arquivo..." : "Arraste um arquivo de áudio"}
              </p>
              <p className="text-sm text-muted-foreground">
                ou clique para selecionar
              </p>
            </div>
            
            <div className="text-xs text-muted-foreground space-y-0.5">
              <p>Formatos: MP3, WAV, M4A, WebM, OGG, AAC</p>
              <p>Tamanho máximo: {maxFileSizeMB}MB</p>
              <p>Duração: {formatTime(minDurationSeconds)} a {formatTime(maxDurationSeconds)}</p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // File selected - show preview
  return (
    <div className="space-y-4">
      {/* File info */}
      <div className="rounded-lg border border-border bg-card p-4 space-y-4">
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="rounded-lg bg-primary/10 p-2">
              <FileAudio className="h-5 w-5 text-primary" />
            </div>
            <div className="min-w-0">
              <p className="font-medium text-foreground truncate">{file.name}</p>
              <p className="text-sm text-muted-foreground">
                Duração: {formatTime(duration)} | Tamanho: {formatFileSize(file.size)}
              </p>
            </div>
          </div>
          
          {!isConfirmed && (
            <Button
              variant="ghost"
              size="icon"
              onClick={handleReset}
              className="flex-shrink-0"
              disabled={disabled}
            >
              <X className="h-4 w-4" />
            </Button>
          )}
        </div>
        
        {/* Duration progress */}
        <div className="space-y-2">
          <div className="flex items-center justify-between text-sm">
            <span className="font-mono text-lg font-semibold text-foreground">
              {formatTime(duration)}
            </span>
            <span className="text-muted-foreground">
              / {formatTime(maxDurationSeconds)}
            </span>
          </div>
          <Progress value={progress} className="h-2" />
        </div>
        
        {/* Audio player */}
        {audioUrl && (
          <div>
            <p className="text-sm font-medium text-foreground mb-2">Prévia:</p>
            <audio controls src={audioUrl} className="w-full" />
          </div>
        )}
      </div>
      
      {/* Confirmed indicator */}
      {isConfirmed && (
        <Alert className="border-emerald-200 bg-emerald-50 dark:border-emerald-800 dark:bg-emerald-950/50">
          <Check className="h-4 w-4 text-emerald-600" />
          <AlertDescription className="text-emerald-800 dark:text-emerald-200">
            Arquivo selecionado! Clique em "Enviar Testemunho" abaixo para continuar.
          </AlertDescription>
        </Alert>
      )}
      
      {/* Action buttons */}
      {!isConfirmed && (
        <div className="flex items-center justify-center gap-3">
          <Button
            variant="outline"
            onClick={handleReset}
            disabled={disabled}
            size="lg"
          >
            Trocar arquivo
          </Button>
          <Button
            onClick={handleConfirm}
            disabled={disabled || !isFinite(duration) || isNaN(duration) || duration < minDurationSeconds}
            size="lg"
            className="bg-gradient-to-r from-emerald-500 to-lime-500 text-white shadow-lg shadow-emerald-500/30 hover:shadow-xl hover:shadow-emerald-500/40"
          >
            Usar este arquivo
          </Button>
        </div>
      )}
    </div>
  );
};

export default AudioUploader;
