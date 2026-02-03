import { Mic, Clock, Eye } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import type { Database } from "@/integrations/supabase/types";

type SoldadoApplicationStatus = Database["public"]["Enums"]["soldado_application_status"];

interface PendingApplicationBannerProps {
  applicationId: string;
  status: SoldadoApplicationStatus;
}

const statusConfig: Record<
  Extract<SoldadoApplicationStatus, "testimony_required" | "pending" | "under_review">,
  {
    icon: React.ElementType;
    title: string;
    description: string;
    actionLabel?: string;
    bgClass: string;
    iconClass: string;
  }
> = {
  testimony_required: {
    icon: Mic,
    title: "Você foi indicado para Soldado! 🎖️",
    description: "Grave seu testemunho para continuar o processo de aprovação.",
    actionLabel: "Gravar Testemunho",
    bgClass: "bg-gradient-to-r from-amber-50 to-amber-100 dark:from-amber-950/50 dark:to-amber-900/30 border-amber-200 dark:border-amber-800",
    iconClass: "bg-amber-100 dark:bg-amber-900 text-amber-600 dark:text-amber-400",
  },
  under_review: {
    icon: Eye,
    title: "Testemunho em análise",
    description: "Seu testemunho está sendo avaliado. Você será notificado quando o processo for concluído.",
    bgClass: "bg-gradient-to-r from-blue-50 to-blue-100 dark:from-blue-950/50 dark:to-blue-900/30 border-blue-200 dark:border-blue-800",
    iconClass: "bg-blue-100 dark:bg-blue-900 text-blue-600 dark:text-blue-400",
  },
  pending: {
    icon: Clock,
    title: "Candidatura pendente",
    description: "Aguardando próximos passos do processo de aprovação.",
    bgClass: "bg-gradient-to-r from-slate-50 to-slate-100 dark:from-slate-950/50 dark:to-slate-900/30 border-slate-200 dark:border-slate-800",
    iconClass: "bg-slate-100 dark:bg-slate-900 text-slate-600 dark:text-slate-400",
  },
};

const PendingApplicationBanner = ({
  applicationId,
  status,
}: PendingApplicationBannerProps) => {
  const navigate = useNavigate();

  // Only show for specific statuses
  if (!["testimony_required", "pending", "under_review"].includes(status)) {
    return null;
  }

  const config = statusConfig[status as keyof typeof statusConfig];
  const Icon = config.icon;

  const handleClick = () => {
    if (status === "testimony_required") {
      navigate(`/testimony/${applicationId}`);
    } else {
      navigate("/profile");
    }
  };

  return (
    <div
      className={`mx-4 mb-4 rounded-xl border p-4 shadow-sm ${config.bgClass}`}
    >
      <div className="flex items-start gap-3">
        <div className={`rounded-full p-2 ${config.iconClass}`}>
          <Icon className="h-5 w-5" />
        </div>
        <div className="flex-1 min-w-0">
          <h3 className="font-semibold text-foreground text-sm">
            {config.title}
          </h3>
          <p className="text-xs text-muted-foreground mt-0.5">
            {config.description}
          </p>
          {config.actionLabel && (
            <Button
              size="sm"
              onClick={handleClick}
              className="mt-2 h-8 text-xs bg-gradient-to-r from-emerald-500 to-lime-500 text-white shadow-md hover:shadow-lg transition-all"
            >
              <Icon className="mr-1.5 h-3.5 w-3.5" />
              {config.actionLabel}
            </Button>
          )}
        </div>
      </div>
    </div>
  );
};

export default PendingApplicationBanner;
