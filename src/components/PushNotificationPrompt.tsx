import { Bell, BellOff, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { usePushNotifications } from "@/hooks/usePushNotifications";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";

interface Props {
  userId: string | null;
  variant?: "icon" | "full";
}

export function PushNotificationPrompt({ userId, variant = "icon" }: Props) {
  const {
    isSupported,
    isSubscribed,
    isLoading,
    permission,
    subscribe,
    unsubscribe,
  } = usePushNotifications(userId);

  // Não mostrar se não suportado ou permissão negada permanentemente
  if (!isSupported || permission === "denied") return null;

  // Versão compacta (ícone apenas)
  if (variant === "icon") {
    if (isSubscribed) {
      return (
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              onClick={unsubscribe}
              disabled={isLoading}
              className="h-8 w-8 text-emerald-500 hover:text-emerald-600"
            >
              {isLoading ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Bell className="h-4 w-4" />
              )}
            </Button>
          </TooltipTrigger>
          <TooltipContent>
            <p>Lembretes ativos • Clique para desativar</p>
          </TooltipContent>
        </Tooltip>
      );
    }

    return (
      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            variant="ghost"
            size="icon"
            onClick={subscribe}
            disabled={isLoading}
            className="h-8 w-8 text-muted-foreground hover:text-emerald-500"
          >
            {isLoading ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <BellOff className="h-4 w-4" />
            )}
          </Button>
        </TooltipTrigger>
        <TooltipContent>
          <p>Ativar lembretes</p>
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
      onClick={subscribe}
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
