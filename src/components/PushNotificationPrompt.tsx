import { Bell, BellOff, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { usePushNotifications } from "@/hooks/usePushNotifications";
import { useIsMobile } from "@/hooks/use-mobile";
import { useToast } from "@/hooks/use-toast";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { useEffect } from "react";

interface Props {
  userId: string | null;
  variant?: "icon" | "full";
}

export function PushNotificationPrompt({ userId, variant = "icon" }: Props) {
  const isMobile = useIsMobile();
  const { toast } = useToast();
  const {
    isSupported,
    isSubscribed,
    isLoading,
    permission,
    isIOS,
    isInStandaloneMode,
    subscribe,
    unsubscribe,
  } = usePushNotifications(userId);

  // Debug logging para diagnóstico mobile
  useEffect(() => {
    console.log("[PushPrompt] State:", { 
      isSupported, 
      isLoading, 
      permission, 
      isSubscribed,
      isIOS, 
      isInStandaloneMode,
      isMobile 
    });
    
    if (isIOS && !isInStandaloneMode && isSupported) {
      console.log("[Push] iOS detected, not in standalone mode - push may not work");
    }
  }, [isIOS, isInStandaloneMode, isSupported, isLoading, permission, isSubscribed, isMobile]);

  // Handler que mostra aviso para iOS se necessário
  const handleSubscribe = async () => {
    if (isIOS && !isInStandaloneMode) {
      toast({
        title: "Adicione à Tela Inicial",
        description: "Para receber notificações no iPhone, adicione o Zion à tela inicial primeiro. Toque no ícone de compartilhar e depois em 'Adicionar à Tela de Início'.",
        duration: 8000,
      });
      return;
    }
    await subscribe();
  };

  // Durante loading, mostrar ícone desabilitado (não esconder)
  if (isLoading) {
    if (variant === "icon") {
      return (
        <Button
          variant="ghost"
          size="icon"
          disabled
          className="h-8 w-8 text-muted-foreground opacity-50"
        >
          <BellOff className="h-4 w-4" />
        </Button>
      );
    }
    return (
      <Button variant="ghost" size="sm" disabled className="text-muted-foreground opacity-50">
        <BellOff className="h-4 w-4 mr-2" />
        Verificando...
      </Button>
    );
  }

  // Só ocultar se CONFIRMADO que não é suportado (após loading completar)
  if (!isSupported || permission === "denied") return null;

  // Versão compacta (ícone apenas)
  if (variant === "icon") {
    const buttonElement = (
      <Button
        variant="ghost"
        size="icon"
        onClick={isSubscribed ? unsubscribe : handleSubscribe}
        disabled={isLoading}
        className={`h-8 w-8 ${
          isSubscribed 
            ? "text-emerald-500 hover:text-emerald-600" 
            : "text-muted-foreground hover:text-emerald-500"
        }`}
      >
        {isLoading ? (
          <Loader2 className="h-4 w-4 animate-spin" />
        ) : isSubscribed ? (
          <Bell className="h-4 w-4" />
        ) : (
          <BellOff className="h-4 w-4" />
        )}
      </Button>
    );

    // Mobile: renderizar sem tooltip (tooltips interferem com touch events)
    if (isMobile) {
      return buttonElement;
    }

    // Desktop: com tooltip
    return (
      <Tooltip>
        <TooltipTrigger asChild>
          {buttonElement}
        </TooltipTrigger>
        <TooltipContent>
          <p>{isSubscribed ? "Lembretes ativos • Clique para desativar" : "Ativar lembretes"}</p>
        </TooltipContent>
      </Tooltip>
    );
  }

  // Versão completa (com texto)
  if (isSubscribed) {
    return (
      <Button
        variant="ghost"
        size="sm"
        onClick={unsubscribe}
        disabled={isLoading}
        className="text-muted-foreground hover:text-foreground"
      >
        {isLoading ? (
          <Loader2 className="h-4 w-4 mr-2 animate-spin" />
        ) : (
          <Bell className="h-4 w-4 mr-2 text-emerald-500" />
        )}
        Notificações ativas
      </Button>
    );
  }

  return (
    <Button
      variant="outline"
      size="sm"
      onClick={handleSubscribe}
      disabled={isLoading}
      className="border-emerald-500/50 hover:border-emerald-500 hover:bg-emerald-50 dark:hover:bg-emerald-950/30"
    >
      {isLoading ? (
        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
      ) : (
        <BellOff className="h-4 w-4 mr-2" />
      )}
      Ativar lembretes
    </Button>
  );
}
