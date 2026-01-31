import { Bell, BellOff, Loader2, BellRing } from "lucide-react";
import { Button } from "@/components/ui/button";
import { usePushNotifications, type UnsupportedReason } from "@/hooks/usePushNotifications";
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

// Mensagens explicativas baseadas no motivo
function getUnsupportedMessage(reason: UnsupportedReason, isIOS: boolean): { title: string; description: string } {
  switch (reason) {
    case "ios-not-standalone":
      return {
        title: "Adicione à Tela de Início",
        description: "Para receber notificações no iPhone, adicione o Zion à tela inicial primeiro. Toque no ícone de compartilhar (quadrado com seta) e depois em 'Adicionar à Tela de Início'.",
      };
    case "no-push-manager":
      if (isIOS) {
        return {
          title: "Adicione à Tela de Início",
          description: "Para receber notificações no iPhone, adicione o Zion à tela inicial. Toque no ícone de compartilhar e depois em 'Adicionar à Tela de Início'.",
        };
      }
      return {
        title: "Navegador não suporta",
        description: "Seu navegador não suporta notificações push. Tente usar Chrome, Firefox ou Edge.",
      };
    case "no-service-worker":
    case "no-notification":
      return {
        title: "Recurso indisponível",
        description: "Seu navegador não suporta notificações. Tente atualizar o navegador ou usar Chrome/Firefox.",
      };
    case "not-secure-context":
      return {
        title: "Conexão não segura",
        description: "Notificações requerem uma conexão segura (HTTPS). Verifique se está acessando pelo link correto.",
      };
    default:
      return {
        title: "Notificações indisponíveis",
        description: "Não foi possível ativar notificações neste dispositivo.",
      };
  }
}

function getDeniedMessage(): { title: string; description: string } {
  return {
    title: "Notificações bloqueadas",
    description: "Você bloqueou as notificações anteriormente. Para desbloquear, acesse as configurações do seu navegador → Permissões de notificação e permita notificações para este site.",
  };
}

export function PushNotificationPrompt({ userId, variant = "icon" }: Props) {
  const isMobile = useIsMobile();
  const { toast } = useToast();
  const {
    isSupported,
    supportStatus,
    unsupportedReason,
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
      supportStatus,
      unsupportedReason,
      isLoading, 
      permission, 
      isSubscribed,
      isIOS, 
      isInStandaloneMode,
      isMobile 
    });
  }, [isIOS, isInStandaloneMode, isSupported, supportStatus, unsupportedReason, isLoading, permission, isSubscribed, isMobile]);

  // Handler para quando push não é suportado
  const handleUnsupportedClick = () => {
    const message = getUnsupportedMessage(unsupportedReason, isIOS);
    toast({
      title: message.title,
      description: message.description,
      duration: 8000,
    });
  };

  // Handler para quando permissão foi negada
  const handleDeniedClick = () => {
    const message = getDeniedMessage();
    toast({
      title: message.title,
      description: message.description,
      duration: 8000,
    });
  };

  // Handler principal de clique
  const handleClick = async () => {
    // Se não é suportado, mostrar mensagem explicativa
    if (!isSupported && supportStatus === "unsupported") {
      handleUnsupportedClick();
      return;
    }

    // Se permissão foi negada, mostrar como desbloquear
    if (permission === "denied") {
      handleDeniedClick();
      return;
    }

    // Se já inscrito, desinscrever
    if (isSubscribed) {
      await unsubscribe();
      toast({
        title: "Lembretes desativados",
        description: "Você não receberá mais lembretes do Zion.",
      });
      return;
    }

    // Tentar inscrever
    const success = await subscribe();
    if (success) {
      toast({
        title: "Lembretes ativados! 🔔",
        description: "Você receberá lembretes gentis quando ficar um tempo sem conversar.",
      });
    } else {
      // Se falhou, pode ter sido negado
      handleDeniedClick();
    }
  };

  // Determinar o estado visual do botão
  const getButtonState = () => {
    if (supportStatus === "checking" || isLoading) {
      return "loading";
    }
    if (supportStatus === "unsupported") {
      return "unsupported";
    }
    if (permission === "denied") {
      return "denied";
    }
    if (isSubscribed) {
      return "subscribed";
    }
    return "available";
  };

  const buttonState = getButtonState();

  // Determinar classes e ícone baseado no estado
  const getButtonConfig = () => {
    switch (buttonState) {
      case "loading":
        return {
          icon: <Loader2 className="h-4 w-4 animate-spin" />,
          className: "text-muted-foreground opacity-50",
          disabled: true,
          tooltip: "Verificando...",
        };
      case "unsupported":
        return {
          icon: <BellOff className="h-4 w-4" />,
          className: "text-muted-foreground/50 hover:text-muted-foreground",
          disabled: false,
          tooltip: isIOS ? "Toque para saber como ativar" : "Notificações indisponíveis",
        };
      case "denied":
        return {
          icon: <BellOff className="h-4 w-4" />,
          className: "text-destructive/70 hover:text-destructive",
          disabled: false,
          tooltip: "Notificações bloqueadas • Toque para saber como desbloquear",
        };
      case "subscribed":
        return {
          icon: <BellRing className="h-4 w-4" />,
          className: "text-emerald-500 hover:text-emerald-600",
          disabled: false,
          tooltip: "Lembretes ativos • Clique para desativar",
        };
      case "available":
      default:
        return {
          icon: <Bell className="h-4 w-4" />,
          className: "text-muted-foreground hover:text-emerald-500",
          disabled: false,
          tooltip: "Ativar lembretes",
        };
    }
  };

  const config = getButtonConfig();

  // Versão compacta (ícone apenas)
  if (variant === "icon") {
    const buttonElement = (
      <Button
        variant="ghost"
        size="icon"
        onClick={handleClick}
        disabled={config.disabled}
        className={`h-8 w-8 ${config.className}`}
      >
        {config.icon}
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
          <p>{config.tooltip}</p>
        </TooltipContent>
      </Tooltip>
    );
  }

  // Versão completa (com texto)
  const getFullButtonContent = () => {
    switch (buttonState) {
      case "loading":
        return (
          <>
            <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            Verificando...
          </>
        );
      case "unsupported":
        return (
          <>
            <BellOff className="h-4 w-4 mr-2" />
            {isIOS ? "Saiba como ativar" : "Indisponível"}
          </>
        );
      case "denied":
        return (
          <>
            <BellOff className="h-4 w-4 mr-2 text-destructive" />
            Bloqueado
          </>
        );
      case "subscribed":
        return (
          <>
            <BellRing className="h-4 w-4 mr-2 text-emerald-500" />
            Notificações ativas
          </>
        );
      case "available":
      default:
        return (
          <>
            <Bell className="h-4 w-4 mr-2" />
            Ativar lembretes
          </>
        );
    }
  };

  return (
    <Button
      variant={buttonState === "available" ? "outline" : "ghost"}
      size="sm"
      onClick={handleClick}
      disabled={config.disabled}
      className={
        buttonState === "available"
          ? "border-emerald-500/50 hover:border-emerald-500 hover:bg-emerald-50 dark:hover:bg-emerald-950/30"
          : "text-muted-foreground hover:text-foreground"
      }
    >
      {getFullButtonContent()}
    </Button>
  );
}
