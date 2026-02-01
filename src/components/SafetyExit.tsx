import { X } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";

interface SafetyExitProps {
  variant?: "floating" | "header";
}

const SafetyExit = ({ variant = "floating" }: SafetyExitProps) => {
  const handleSafetyExit = () => {
    // Redireciona imediatamente para o Google
    window.location.replace("https://www.google.com");
  };

  if (variant === "header") {
    return (
      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            onClick={handleSafetyExit}
            variant="ghost"
            size="icon"
            className="text-destructive hover:bg-destructive/10 hover:text-destructive"
            aria-label="Sair rápido"
          >
            <X className="h-4 w-4" />
          </Button>
        </TooltipTrigger>
        <TooltipContent side="bottom" className="bg-destructive text-destructive-foreground">
          <p>Sair Rápido</p>
        </TooltipContent>
      </Tooltip>
    );
  }

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Button
          onClick={handleSafetyExit}
          variant="outline"
          size="icon"
          className="fixed bottom-20 right-4 z-50 h-12 w-12 rounded-full border-2 border-destructive/30 bg-background/95 shadow-lg backdrop-blur-sm transition-all hover:border-destructive hover:bg-destructive hover:text-destructive-foreground sm:bottom-4"
          aria-label="Sair rápido"
        >
          <X className="h-5 w-5" />
        </Button>
      </TooltipTrigger>
      <TooltipContent side="left" className="bg-destructive text-destructive-foreground">
        <p>Sair Rápido</p>
      </TooltipContent>
    </Tooltip>
  );
};

export default SafetyExit;
