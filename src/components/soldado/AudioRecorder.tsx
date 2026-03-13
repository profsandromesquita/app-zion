import { useState, useRef, useCallback, useEffect } from "react";
import { Mic, Pause, Play, RotateCcw, Square, AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Alert, AlertDescription } from "@/components/ui/alert";

interface AudioRecorderProps {
  maxDurationSeconds?: number;
  minDurationSeconds?: number;
  onRecordingComplete: (blob: Blob, durationSeconds: number) => void;
  onRecordingStart?: () => void;
  disabled?: boolean;
}

type RecordingState = "idle" | "recording" | "paused" | "stopped";

const formatTime = (seconds: number): string => {
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${mins.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`;
};

const AudioRecorder = ({
  maxDurationSeconds = 900, // 15 minutes
  minDurationSeconds = 60, // 1 minute
  onRecordingComplete,
  onRecordingStart,
  disabled = false,
}: AudioRecorderProps) => {
  const [state, setState] = useState<RecordingState>("idle");
  const [duration, setDuration] = useState(0);
  const [audioBlob, setAudioBlob] = useState<Blob | null>(null);
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [permissionDenied, setPermissionDenied] = useState(false);

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animationFrameRef = useRef<number | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Clean up on unmount
  useEffect(() => {
    return () => {
      cleanup();
    };
  }, []);

  const cleanup = useCallback(() => {
    if (animationFrameRef.current) {
      cancelAnimationFrame(animationFrameRef.current);
    }
    if (timerRef.current) {
      clearInterval(timerRef.current);
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
    }
    if (audioContextRef.current?.state !== "closed") {
      audioContextRef.current?.close();
    }
    if (audioUrl) {
      URL.revokeObjectURL(audioUrl);
    }
  }, [audioUrl]);

  const drawWaveform = useCallback(() => {
    if (!analyserRef.current || !canvasRef.current) return;

    const analyser = analyserRef.current;
    const canvas = canvasRef.current;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const bufferLength = analyser.frequencyBinCount;
    const dataArray = new Uint8Array(bufferLength);
    analyser.getByteTimeDomainData(dataArray);

    // Clear canvas
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // Create gradient
    const gradient = ctx.createLinearGradient(0, 0, canvas.width, 0);
    gradient.addColorStop(0, "hsl(142, 76%, 45%)"); // emerald
    gradient.addColorStop(1, "hsl(84, 81%, 44%)"); // lime

    ctx.lineWidth = 2;
    ctx.strokeStyle = gradient;
    ctx.beginPath();

    const sliceWidth = canvas.width / bufferLength;
    let x = 0;

    for (let i = 0; i < bufferLength; i++) {
      const v = dataArray[i] / 128.0;
      const y = (v * canvas.height) / 2;

      if (i === 0) {
        ctx.moveTo(x, y);
      } else {
        ctx.lineTo(x, y);
      }

      x += sliceWidth;
    }

    ctx.lineTo(canvas.width, canvas.height / 2);
    ctx.stroke();

    if (state === "recording") {
      animationFrameRef.current = requestAnimationFrame(drawWaveform);
    }
  }, [state]);

  const startRecording = async () => {
    setError(null);
    setPermissionDenied(false);

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;

      // Setup audio context for visualization
      audioContextRef.current = new AudioContext();
      analyserRef.current = audioContextRef.current.createAnalyser();
      const source = audioContextRef.current.createMediaStreamSource(stream);
      source.connect(analyserRef.current);
      analyserRef.current.fftSize = 2048;

      // Setup MediaRecorder
      const mimeType = MediaRecorder.isTypeSupported("audio/webm;codecs=opus")
        ? "audio/webm;codecs=opus"
        : MediaRecorder.isTypeSupported("audio/webm")
        ? "audio/webm"
        : "audio/mp4";

      mediaRecorderRef.current = new MediaRecorder(stream, { mimeType });
      chunksRef.current = [];

      mediaRecorderRef.current.ondataavailable = (event) => {
        if (event.data.size > 0) {
          chunksRef.current.push(event.data);
        }
      };

      mediaRecorderRef.current.onstop = () => {
        const blob = new Blob(chunksRef.current, { type: mimeType });
        setAudioBlob(blob);
        const url = URL.createObjectURL(blob);
        setAudioUrl(url);
        setState("stopped");
      };

      mediaRecorderRef.current.start(1000); // Collect data every second
      setState("recording");
      setDuration(0);
      onRecordingStart?.();

      // Start timer
      timerRef.current = setInterval(() => {
        setDuration((prev) => {
          const newDuration = prev + 1;
          if (newDuration >= maxDurationSeconds) {
            stopRecording();
          }
          return newDuration;
        });
      }, 1000);

      // Start waveform animation
      drawWaveform();
    } catch (err: any) {
      console.error("Error starting recording:", err);
      if (err.name === "NotAllowedError" || err.name === "PermissionDeniedError") {
        setPermissionDenied(true);
        setError("Permissão de microfone negada. Por favor, permita o acesso ao microfone nas configurações do navegador.");
      } else {
        setError("Não foi possível iniciar a gravação. Verifique se seu navegador suporta gravação de áudio.");
      }
    }
  };

  const pauseRecording = () => {
    if (mediaRecorderRef.current?.state === "recording") {
      mediaRecorderRef.current.pause();
      setState("paused");
      if (timerRef.current) {
        clearInterval(timerRef.current);
      }
    }
  };

  const resumeRecording = () => {
    if (mediaRecorderRef.current?.state === "paused") {
      mediaRecorderRef.current.resume();
      setState("recording");
      timerRef.current = setInterval(() => {
        setDuration((prev) => {
          const newDuration = prev + 1;
          if (newDuration >= maxDurationSeconds) {
            stopRecording();
          }
          return newDuration;
        });
      }, 1000);
      drawWaveform();
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== "inactive") {
      mediaRecorderRef.current.stop();
    }
    if (timerRef.current) {
      clearInterval(timerRef.current);
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
    }
  };

  const resetRecording = () => {
    cleanup();
    setAudioBlob(null);
    setAudioUrl(null);
    setState("idle");
    setDuration(0);
    chunksRef.current = [];
  };

  const handleComplete = () => {
    if (audioBlob && duration >= minDurationSeconds) {
      onRecordingComplete(audioBlob, duration);
    }
  };

  const progress = (duration / maxDurationSeconds) * 100;
  const isTooShort = duration < minDurationSeconds && state === "stopped";

  return (
    <div className="space-y-4">
      {error && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {/* Waveform visualization */}
      <div className="relative rounded-lg border border-border bg-muted/50 p-4">
        <canvas
          ref={canvasRef}
          width={600}
          height={80}
          className="w-full h-20"
          style={{ maxWidth: "100%" }}
        />
        {state === "idle" && (
          <div className="absolute inset-0 flex items-center justify-center">
            <p className="text-muted-foreground text-sm">Clique em gravar para começar</p>
          </div>
        )}
        {state === "paused" && (
          <div className="absolute inset-0 flex items-center justify-center bg-background/50">
            <p className="text-muted-foreground text-sm">Gravação pausada</p>
          </div>
        )}
      </div>

      {/* Timer and progress */}
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
        {duration > 0 && duration < minDurationSeconds && (
          <p className="text-xs text-amber-600 dark:text-amber-400">
            Mínimo recomendado: {formatTime(minDurationSeconds)}
          </p>
        )}
      </div>

      {/* Audio preview when stopped */}
      {state === "stopped" && audioUrl && (
        <div className="rounded-lg border border-border bg-card p-4 space-y-3">
          <p className="text-sm font-medium text-foreground">Prévia da gravação:</p>
          <audio controls src={audioUrl} className="w-full" />
          {isTooShort && (
            <p className="text-sm text-amber-600 dark:text-amber-400">
              A gravação deve ter no mínimo {formatTime(minDurationSeconds)} para ser enviada.
            </p>
          )}
        </div>
      )}

      {/* Control buttons */}
      <div className="flex items-center justify-center gap-3">
        {state === "idle" && (
          <Button
            onClick={startRecording}
            disabled={disabled || permissionDenied}
            size="lg"
            className="bg-gradient-to-r from-emerald-500 to-lime-500 text-white shadow-lg shadow-emerald-500/30 hover:shadow-xl hover:shadow-emerald-500/40"
          >
            <Mic className="mr-2 h-5 w-5" />
            Gravar
          </Button>
        )}

        {state === "recording" && (
          <>
            <Button onClick={pauseRecording} variant="outline" size="lg">
              <Pause className="mr-2 h-5 w-5" />
              Pausar
            </Button>
            <Button onClick={stopRecording} variant="destructive" size="lg">
              <Square className="mr-2 h-5 w-5" />
              Parar
            </Button>
          </>
        )}

        {state === "paused" && (
          <>
            <Button
              onClick={resumeRecording}
              size="lg"
              className="bg-gradient-to-r from-emerald-500 to-lime-500 text-white"
            >
              <Play className="mr-2 h-5 w-5" />
              Continuar
            </Button>
            <Button onClick={stopRecording} variant="destructive" size="lg">
              <Square className="mr-2 h-5 w-5" />
              Parar
            </Button>
          </>
        )}

        {state === "stopped" && (
          <>
            <Button onClick={resetRecording} variant="outline" size="lg">
              <RotateCcw className="mr-2 h-5 w-5" />
              Regravar
            </Button>
            <Button
              onClick={handleComplete}
              disabled={isTooShort || disabled}
              size="lg"
              className="bg-gradient-to-r from-emerald-500 to-lime-500 text-white shadow-lg shadow-emerald-500/30 hover:shadow-xl hover:shadow-emerald-500/40"
            >
              Usar esta gravação
            </Button>
          </>
        )}
      </div>
    </div>
  );
};

export default AudioRecorder;
