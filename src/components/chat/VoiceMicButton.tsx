import { Mic, MicOff } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";

interface VoiceMicButtonProps {
  isListening: boolean;
  isSupported: boolean;
  onToggle: () => void;
  disabled?: boolean;
  error?: string | null;
}

export const VoiceMicButton = ({
  isListening,
  isSupported,
  onToggle,
  disabled = false,
  error,
}: VoiceMicButtonProps) => {
  if (!isSupported) {
    return (
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              className="h-[50px] w-[50px] shrink-0 opacity-50 cursor-not-allowed"
              disabled
            >
              <MicOff className="h-5 w-5 text-muted-foreground" />
            </Button>
          </TooltipTrigger>
          <TooltipContent>
            <p>Seu navegador não suporta reconhecimento de voz</p>
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
    );
  }

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            variant="ghost"
            size="icon"
            className={cn(
              "h-[50px] w-[50px] shrink-0 transition-all",
              isListening && "bg-destructive/10 hover:bg-destructive/20"
            )}
            onClick={onToggle}
            disabled={disabled}
          >
            <Mic
              className={cn(
                "h-5 w-5 transition-colors",
                isListening 
                  ? "text-destructive animate-pulse" 
                  : "text-muted-foreground hover:text-foreground"
              )}
            />
          </Button>
        </TooltipTrigger>
        <TooltipContent>
          <p>{isListening ? "Parar gravação" : error || "Usar microfone"}</p>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
};
