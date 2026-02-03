import { Badge } from "@/components/ui/badge";
import { 
  Upload, 
  Loader2, 
  CheckCircle, 
  UserCheck, 
  Globe, 
  XCircle 
} from "lucide-react";
import type { Database } from "@/integrations/supabase/types";

type TestimonyStatus = Database["public"]["Enums"]["testimony_status"];

interface TestimonyStatusBadgeProps {
  status: TestimonyStatus;
  className?: string;
}

const statusConfig: Record<TestimonyStatus, {
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  variant: "default" | "secondary" | "destructive" | "outline";
  className: string;
}> = {
  uploading: {
    label: "Enviando",
    icon: Upload,
    variant: "secondary",
    className: "bg-slate-100 text-slate-800 dark:bg-slate-800 dark:text-slate-300",
  },
  processing: {
    label: "Processando",
    icon: Loader2,
    variant: "secondary",
    className: "bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-300",
  },
  analyzed: {
    label: "Analisado",
    icon: CheckCircle,
    variant: "secondary",
    className: "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-300",
  },
  curated: {
    label: "Curado",
    icon: UserCheck,
    variant: "secondary",
    className: "bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-300",
  },
  published: {
    label: "Publicado",
    icon: Globe,
    variant: "default",
    className: "bg-emerald-100 text-emerald-800 dark:bg-emerald-900 dark:text-emerald-300",
  },
  rejected: {
    label: "Rejeitado",
    icon: XCircle,
    variant: "destructive",
    className: "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-300",
  },
};

const TestimonyStatusBadge = ({ status, className = "" }: TestimonyStatusBadgeProps) => {
  const config = statusConfig[status];
  const Icon = config.icon;
  
  return (
    <Badge 
      variant={config.variant} 
      className={`gap-1 ${config.className} ${className}`}
    >
      <Icon className={`h-3 w-3 ${status === "processing" ? "animate-spin" : ""}`} />
      {config.label}
    </Badge>
  );
};

export default TestimonyStatusBadge;
