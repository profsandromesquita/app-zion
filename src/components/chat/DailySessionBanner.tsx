import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Sun, X } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { useFeatureFlag } from "@/hooks/useFeatureFlag";
import { supabase } from "@/integrations/supabase/client";

interface DailySessionBannerProps {
  userId: string;
}

const DailySessionBanner = ({ userId }: DailySessionBannerProps) => {
  const navigate = useNavigate();
  const [dismissed, setDismissed] = useState(false);
  const { enabled: ioEnabled, loading: flagLoading } = useFeatureFlag("io_daily_session_enabled");

  const today = new Date().toISOString().split("T")[0];

  const { data: todayCompleted, isLoading } = useQuery({
    queryKey: ["daily-session-today", userId, today],
    queryFn: async () => {
      const { data } = await supabase
        .from("io_daily_sessions")
        .select("id")
        .eq("user_id", userId)
        .eq("session_date", today)
        .eq("completed", true)
        .maybeSingle();
      return !!data;
    },
    enabled: ioEnabled && !dismissed,
    staleTime: 2 * 60 * 1000,
  });

  if (flagLoading || isLoading || !ioEnabled || todayCompleted || dismissed) {
    return null;
  }

  return (
    <div className="mx-4 mb-2 rounded-xl border border-amber-200 dark:border-amber-800 bg-gradient-to-r from-amber-50 to-orange-50 dark:from-amber-950/40 dark:to-orange-950/30 p-3 shadow-sm">
      <div className="flex items-center gap-3">
        <div className="rounded-full bg-amber-100 dark:bg-amber-900 p-2">
          <Sun className="h-4 w-4 text-amber-600 dark:text-amber-400" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium text-foreground">
            ☀️ Sua sessão do dia está disponível
          </p>
        </div>
        <Button
          size="sm"
          onClick={() => navigate("/session")}
          className="h-7 text-xs bg-gradient-to-r from-emerald-500 to-lime-500 text-white shadow-sm hover:shadow-md transition-all shrink-0"
        >
          Iniciar sessão
        </Button>
        <button
          onClick={() => setDismissed(true)}
          className="text-muted-foreground hover:text-foreground transition-colors shrink-0"
          aria-label="Dispensar"
        >
          <X className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
};

export default DailySessionBanner;
