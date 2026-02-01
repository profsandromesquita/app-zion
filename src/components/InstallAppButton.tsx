import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Download, Smartphone, Share, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { useInstallPrompt } from "@/hooks/useInstallPrompt";
import { cn } from "@/lib/utils";

interface InstallAppButtonProps {
  variant?: "hero" | "compact" | "sidebar";
  className?: string;
}

export function InstallAppButton({ variant = "hero", className }: InstallAppButtonProps) {
  const navigate = useNavigate();
  const { canInstallNatively, isInstalled, isIOS, promptInstall } = useInstallPrompt();
  const [showIOSModal, setShowIOSModal] = useState(false);

  // Don't render if already installed
  if (isInstalled) {
    return null;
  }

  const handleClick = async () => {
    if (canInstallNatively) {
      // Chrome/Edge - trigger native install prompt
      await promptInstall();
    } else if (isIOS) {
      // iOS - show instructions modal
      setShowIOSModal(true);
    } else {
      // Other browsers - navigate to install page
      navigate("/install");
    }
  };

  const buttonContent = (
    <>
      {variant === "sidebar" ? (
        <Download className="mr-2 h-4 w-4" />
      ) : (
        <Smartphone className="mr-2 h-5 w-5" />
      )}
      {variant === "compact" ? "Instalar App" : "Adicionar à Tela Inicial"}
    </>
  );

  const renderButton = () => {
    switch (variant) {
      case "hero":
        return (
          <Button
            onClick={handleClick}
            variant="outline"
            size="lg"
            className={cn(
              "h-14 w-full rounded-xl border-white/30 bg-white/10 text-lg font-medium text-white backdrop-blur-sm transition-all duration-300 hover:bg-white/20 hover:scale-[1.02]",
              className
            )}
          >
            {buttonContent}
          </Button>
        );
      
      case "compact":
        return (
          <Button
            onClick={handleClick}
            variant="ghost"
            size="sm"
            className={cn(
              "text-muted-foreground hover:text-foreground",
              className
            )}
          >
            {buttonContent}
          </Button>
        );
      
      case "sidebar":
        return (
          <Button
            onClick={handleClick}
            variant="ghost"
            size="sm"
            className={cn(
              "w-full justify-start text-muted-foreground hover:text-foreground",
              className
            )}
          >
            {buttonContent}
          </Button>
        );
      
      default:
        return null;
    }
  };

  return (
    <>
      {renderButton()}
      
      {/* iOS Instructions Modal */}
      <Dialog open={showIOSModal} onOpenChange={setShowIOSModal}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Smartphone className="h-5 w-5 text-primary" />
              Instalar Zion no iPhone
            </DialogTitle>
            <DialogDescription>
              Siga os passos abaixo para adicionar o Zion à sua tela inicial:
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4 py-4">
            <div className="flex items-start gap-3">
              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
                1
              </div>
              <div className="space-y-1">
                <p className="font-medium">Toque em "Compartilhar"</p>
                <p className="text-sm text-muted-foreground flex items-center gap-1">
                  Procure o ícone <Share className="h-4 w-4" /> na barra inferior do Safari
                </p>
              </div>
            </div>
            
            <div className="flex items-start gap-3">
              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
                2
              </div>
              <div className="space-y-1">
                <p className="font-medium">Adicionar à Tela de Início</p>
                <p className="text-sm text-muted-foreground flex items-center gap-1">
                  Role para baixo e toque em <Plus className="h-4 w-4" /> "Adicionar à Tela de Início"
                </p>
              </div>
            </div>
            
            <div className="flex items-start gap-3">
              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
                3
              </div>
              <div className="space-y-1">
                <p className="font-medium">Confirme a instalação</p>
                <p className="text-sm text-muted-foreground">
                  Toque em "Adicionar" no canto superior direito
                </p>
              </div>
            </div>
          </div>
          
          <Button onClick={() => setShowIOSModal(false)} className="w-full">
            Entendi
          </Button>
        </DialogContent>
      </Dialog>
    </>
  );
}
