import { useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { Heart, Flame, Calendar, BarChart3, TrendingUp, TrendingDown, Minus, Play, Check } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";

interface IOJourneySectionProps {
  userId: string;
}

const PHASES = [
  { num: 1, name: "Consciência", desc: "Você está aprendendo a perceber o que sente e o que se repete." },
  { num: 2, name: "Limites", desc: "Você está separando o que é seu do que é do outro." },
  { num: 3, name: "Identidade", desc: "Você está descobrindo os padrões que governam seu comportamento." },
  { num: 4, name: "Ritmo", desc: "Você está transformando consciência em prática consistente." },
  { num: 5, name: "Vitalidade", desc: "Você está restaurando vínculos e recuperando vitalidade." },
  { num: 6, name: "Governo", desc: "Você está assumindo governo sobre as áreas da sua vida." },
  { num: 7, name: "Plenitude", desc: "Você sustenta o que construiu e pode transmitir o que aprendeu." },
];

function getTrend(history: { value: number }[]): "up" | "down" | "stable" {
  if (history.length < 2) return "stable";
  const last = history[history.length - 1].value;
  const prev = history[history.length - 2].value;
  if (last > prev) return "up";
  if (last < prev) return "down";
  return "stable";
}

function MiniIGIChart({ history }: { history: { value: number }[] }) {
  const points = history.slice(-14);
  if (points.length < 2) return null;

  const maxVal = 10;
  const w = 280;
  const h = 60;
  const padding = 4;
  const usableW = w - padding * 2;
  const usableH = h - padding * 2;

  const polyPoints = points
    .map((p, i) => {
      const x = padding + (i / (points.length - 1)) * usableW;
      const y = padding + usableH - (p.value / maxVal) * usableH;
      return `${x},${y}`;
    })
    .join(" ");

  const gradientPoints = `${padding},${h - padding} ${polyPoints} ${padding + ((points.length - 1) / (points.length - 1)) * usableW},${h - padding}`;

  return (
    <svg viewBox={`0 0 ${w} ${h}`} className="w-full h-16" preserveAspectRatio="none">
      <defs>
        <linearGradient id="igi-fill" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="hsl(var(--primary))" stopOpacity="0.3" />
          <stop offset="100%" stopColor="hsl(var(--primary))" stopOpacity="0.05" />
        </linearGradient>
      </defs>
      <polygon points={gradientPoints} fill="url(#igi-fill)" />
      <polyline points={polyPoints} fill="none" stroke="hsl(var(--primary))" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

const IOJourneySection = ({ userId }: IOJourneySectionProps) => {
  const navigate = useNavigate();

  const { data: phaseData, isLoading: phaseLoading } = useQuery({
    queryKey: ["io-user-phase", userId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("io_user_phase")
        .select("*")
        .eq("user_id", userId)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
  });

  const { data: todayCompleted } = useQuery({
    queryKey: ["io-today-session", userId],
    queryFn: async () => {
      const today = new Date().toISOString().split("T")[0];
      const { data, error } = await supabase
        .from("io_daily_sessions")
        .select("id, completed")
        .eq("user_id", userId)
        .eq("session_date", today)
        .eq("completed", true)
        .maybeSingle();
      if (error) throw error;
      return !!data;
    },
  });

  if (phaseLoading) {
    return (
      <Card className="overflow-hidden">
        <CardHeader className="bg-gradient-to-r from-emerald-50 to-lime-50 dark:from-emerald-950/20 dark:to-lime-950/20 border-b">
          <CardTitle className="flex items-center gap-2 text-lg">
            <Heart className="h-5 w-5 text-emerald-500" />
            Minha Jornada IO
          </CardTitle>
        </CardHeader>
        <CardContent className="pt-6">
          <div className="h-40 animate-pulse rounded bg-muted" />
        </CardContent>
      </Card>
    );
  }

  const currentPhase = phaseData?.current_phase ?? 1;
  const igiCurrent = Number(phaseData?.igi_current ?? 0);
  const streak = phaseData?.streak_current ?? 0;
  const totalSessions = phaseData?.total_sessions ?? 0;
  const lastSessionDate = phaseData?.last_session_date;
  const igiHistory = Array.isArray(phaseData?.igi_history) ? (phaseData.igi_history as { value: number }[]) : [];
  const trend = getTrend(igiHistory);
  const currentPhaseInfo = PHASES.find((p) => p.num === currentPhase) ?? PHASES[0];

  return (
    <Card className="overflow-hidden">
      <CardHeader className="bg-gradient-to-r from-emerald-50 to-lime-50 dark:from-emerald-950/20 dark:to-lime-950/20 border-b">
        <CardTitle className="flex items-center gap-2 text-lg">
          <Heart className="h-5 w-5 text-emerald-500" />
          Minha Jornada IO
        </CardTitle>
        <CardDescription>Seu progresso no Método IO</CardDescription>
      </CardHeader>

      <CardContent className="pt-6 space-y-6">
        {/* Phase Bar */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            {PHASES.map((phase) => {
              const isCompleted = phase.num < currentPhase;
              const isCurrent = phase.num === currentPhase;
              const isFuture = phase.num > currentPhase;

              return (
                <div key={phase.num} className="flex flex-col items-center gap-1.5 flex-1">
                  <div
                    className={`w-4 h-4 rounded-full border-2 transition-all duration-300 ${
                      isCompleted
                        ? "bg-emerald-500 border-emerald-500"
                        : isCurrent
                          ? "border-emerald-500 bg-emerald-100 dark:bg-emerald-900/50 ring-4 ring-emerald-200/60 dark:ring-emerald-800/40 animate-pulse"
                          : "border-muted-foreground/30 bg-muted"
                    }`}
                  />
                  <span
                    className={`text-[10px] leading-tight text-center hidden sm:block ${
                      isCurrent
                        ? "font-semibold text-emerald-600 dark:text-emerald-400"
                        : isFuture
                          ? "text-muted-foreground/50"
                          : "text-muted-foreground"
                    }`}
                  >
                    {phase.name}
                  </span>
                </div>
              );
            })}
          </div>
          {/* Connecting line */}
          <div className="relative mx-2 hidden sm:block">
            <div className="absolute top-0 left-0 right-0 h-0.5 bg-muted -mt-[2.15rem]" />
            <div
              className="absolute top-0 left-0 h-0.5 bg-emerald-500 -mt-[2.15rem] transition-all duration-500"
              style={{ width: `${((currentPhase - 1) / 6) * 100}%` }}
            />
          </div>
        </div>

        {/* Phase Description */}
        <div className="rounded-xl bg-gradient-to-br from-emerald-100 via-emerald-50 to-background dark:from-emerald-900/30 dark:via-emerald-950/20 dark:to-background p-4 border border-emerald-200 dark:border-emerald-800">
          <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
            Fase {currentPhase} — {currentPhaseInfo.name}
          </p>
          <p className="text-sm text-muted-foreground mt-1 italic">
            "{currentPhaseInfo.desc}"
          </p>
        </div>

        {/* Data Cards Grid */}
        <div className="grid grid-cols-2 gap-3">
          {/* IGI */}
          <div className="rounded-lg border bg-card p-3 text-center space-y-1">
            <div className="mx-auto w-9 h-9 rounded-full bg-emerald-100 dark:bg-emerald-900/30 flex items-center justify-center">
              <BarChart3 className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
            </div>
            <div className="flex items-center justify-center gap-1">
              <p className="text-xl font-bold text-foreground">{igiCurrent.toFixed(1)}</p>
              {trend === "up" && <TrendingUp className="h-4 w-4 text-emerald-500" />}
              {trend === "down" && <TrendingDown className="h-4 w-4 text-amber-500" />}
              {trend === "stable" && <Minus className="h-4 w-4 text-muted-foreground" />}
            </div>
            <p className="text-xs text-muted-foreground">IGI atual</p>
          </div>

          {/* Streak */}
          <div className="rounded-lg border bg-card p-3 text-center space-y-1">
            <div className="mx-auto w-9 h-9 rounded-full bg-orange-100 dark:bg-orange-900/30 flex items-center justify-center">
              <Flame className="h-4 w-4 text-orange-500" />
            </div>
            <p className="text-xl font-bold text-foreground">{streak}</p>
            <p className="text-xs text-muted-foreground">Dias de streak</p>
          </div>

          {/* Total Sessions */}
          <div className="rounded-lg border bg-card p-3 text-center space-y-1">
            <div className="mx-auto w-9 h-9 rounded-full bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center">
              <Calendar className="h-4 w-4 text-blue-600 dark:text-blue-400" />
            </div>
            <p className="text-xl font-bold text-foreground">{totalSessions}</p>
            <p className="text-xs text-muted-foreground">Sessões completas</p>
          </div>

          {/* Last Session */}
          <div className="rounded-lg border bg-card p-3 text-center space-y-1">
            <div className="mx-auto w-9 h-9 rounded-full bg-purple-100 dark:bg-purple-900/30 flex items-center justify-center">
              <Calendar className="h-4 w-4 text-purple-600 dark:text-purple-400" />
            </div>
            <p className="text-sm font-bold text-foreground">
              {lastSessionDate
                ? new Date(lastSessionDate + "T00:00:00").toLocaleDateString("pt-BR", { day: "2-digit", month: "short" })
                : "—"}
            </p>
            <p className="text-xs text-muted-foreground">Última sessão</p>
          </div>
        </div>

        {/* Mini IGI Chart */}
        {igiHistory.length >= 2 && (
          <div className="space-y-2">
            <p className="text-xs text-muted-foreground font-medium">Evolução do IGI</p>
            <div className="rounded-lg border bg-card p-3">
              <MiniIGIChart history={igiHistory} />
            </div>
          </div>
        )}

        {/* Session Button */}
        <div>
          {todayCompleted ? (
            <Button disabled className="w-full" variant="outline">
              <Check className="mr-2 h-4 w-4" />
              Sessão de hoje ✅
            </Button>
          ) : (
            <Button
              onClick={() => navigate("/session")}
              className="w-full bg-gradient-to-r from-emerald-500 to-lime-500 text-white shadow-lg shadow-emerald-500/30 hover:shadow-xl hover:shadow-emerald-500/40 transition-all duration-300"
            >
              <Play className="mr-2 h-4 w-4" />
              Iniciar Sessão do Dia
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  );
};

export default IOJourneySection;
