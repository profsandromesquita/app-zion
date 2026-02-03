import { Clock, Mic, Eye, CheckCircle, XCircle, LucideIcon } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import type { Database } from "@/integrations/supabase/types";

type SoldadoApplicationStatus = Database["public"]["Enums"]["soldado_application_status"];

interface StatusConfig {
  label: string;
  className: string;
  icon: LucideIcon;
}

const statusConfig: Record<SoldadoApplicationStatus, StatusConfig> = {
  pending: {
    label: "Pendente",
    className: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-300",
    icon: Clock,
  },
  testimony_required: {
    label: "Aguardando Testemunho",
    className: "bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-300",
    icon: Mic,
  },
  under_review: {
    label: "Em Revisão",
    className: "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-300",
    icon: Eye,
  },
  approved: {
    label: "Aprovado",
    className: "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300",
    icon: CheckCircle,
  },
  rejected: {
    label: "Rejeitado",
    className: "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-300",
    icon: XCircle,
  },
};

interface ApplicationStatusBadgeProps {
  status: SoldadoApplicationStatus;
  showIcon?: boolean;
  className?: string;
}

const ApplicationStatusBadge = ({
  status,
  showIcon = true,
  className,
}: ApplicationStatusBadgeProps) => {
  const config = statusConfig[status];
  const Icon = config.icon;

  return (
    <Badge
      variant="secondary"
      className={cn("gap-1", config.className, className)}
    >
      {showIcon && <Icon className="h-3 w-3" />}
      {config.label}
    </Badge>
  );
};

export default ApplicationStatusBadge;
