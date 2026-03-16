import { useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import {
  Heart, BarChart3, TrendingUp, TrendingDown, Minus,
  Play, Check, ChevronDown, Target,
} from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { supabase } from "@/integrations/supabase/client";

interface IOJourneySectionProps {
  userId: string;
}

// ── Phase definitions ──────────────────────────────────────────────
const PHASES = [
  { num: 1, name: "Consciência", desc: "Você está aprendendo a perceber o que sente e o que se repete." },
  { num: 2, name: "Limites", desc: "Você está separando o que é seu do que é do outro." },
  { num: 3, name: "Identidade", desc: "Você está descobrindo os padrões que governam seu comportamento." },
  { num: 4, name: "Ritmo", desc: "Você está transformando consciência em prática consistente." },
  { num: 5, name: "Vitalidade", desc: "Você está restaurando vínculos e recuperando vitalidade." },
  { num: 6, name: "Governo", desc: "Você está assumindo governo sobre as áreas da sua vida." },
  { num: 7, name: "Plenitude", desc: "Você sustenta o que construiu e pode transmitir o que aprendeu." },
];

const PHASE_DETAILS: Record<number, { explanation: string; advancement: string }> = {
  1: {
    explanation: "Nesta fase, você está aprendendo a perceber o que sente e o que se repete na sua vida. O foco é nomear, não resolver.",
    advancement: "Mantenha clareza ≥ 6 por 3 dias consecutivos",
  },
  2: {
    explanation: "Nesta fase, você está aprendendo a separar o que é seu do que é do outro. O foco é distinguir fato de interpretação.",
    advancement: "Mostre melhora de 30% na regulação emocional",
  },
  3: {
    explanation: "Nesta fase, você está descobrindo os padrões e crenças que moldam seu comportamento. O foco é identificar, não julgar.",
    advancement: "Preencha seus outputs de identidade + clareza ≥ 7",
  },
  4: {
    explanation: "Nesta fase, você está consolidando verdade com constância. O foco é criar ritmo, não intensidade.",
    advancement: "Mantenha um streak de 5 dias consecutivos",
  },
  5: {
    explanation: "Nesta fase, você está restaurando vínculos e reparando o que foi danificado. O foco é conexão, não performance.",
    advancement: "Mantenha vitalidade ≥ 6 por 5 dias",
  },
  6: {
    explanation: "Nesta fase, você está assumindo governo sobre sua própria vida. O foco é planejar e agir.",
    advancement: "Complete plano em 3 áreas + 1 ação executada",
  },
  7: {
    explanation: "Nesta fase, você está integrando tudo que viveu. O foco é manter, transmitir e viver com plenitude.",
    advancement: "Mantenha autonomia ≥ 7 (fase de manutenção)",
  },
};

// ── Contextual messages ────────────────────────────────────────────
function getIGIMessage(igi: number): string {
  if (igi === 0) return "Complete sua primeira sessão para ver seu índice.";
  if (igi <= 2) return "Você está começando. Cada passo conta.";
  if (igi <= 4) return "Você está se percebendo. A clareza está chegando.";
  if (igi <= 6) return "Você está ganhando forma. Continue.";
  if (igi <= 8) return "Você está fortalecendo raízes. Isso é raro.";
  return "Você está inteiro. Cuide do que construiu.";
}

function getStreakMessage(streak: number): string {
  if (streak === 0) return "Hoje é um bom dia para começar.";
  if (streak <= 2) return "Você voltou. Isso já é muito.";
  if (streak <= 4) return "Está criando ritmo. Continue.";
  return "Sua constância é sua força.";
}

function getAdherenceMessage(ratio: number): string {
  if (ratio < 0.3) return "Tente voltar mais vezes. Constância transforma.";
  if (ratio <= 0.6) return "Você está construindo um hábito.";
  return "Sua dedicação é visível.";
}

// ── Helpers ────────────────────────────────────────────────────────
function getTrend(history: { value: number }[]): "up" | "down" | "stable" {
  if (history.length < 2) return "stable";
  const last = history[history.length - 1].value;
  const prev = history[history.length - 2].value;
  if (last > prev) return "up";
  if (last < prev) return "down";
  return "stable";
}

function daysDiff(dateStr: string | null): number {
  if (!dateStr) return 1;
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return 1;
  const now = new Date();
  const diffMs = now.getTime() - d.getTime();
  const days = Math.ceil(diffMs / (1000 * 60 * 60 * 24));
  return Math.max(1, days);
}

/** Returns ISO date strings (YYYY-MM-DD) for the current week Mon-Sun */
function getCurrentWeekDates(): { date: string; label: string }[] {
  const now = new Date();
  const dayOfWeek = now.getDay(); // 0=Sun
  const mondayOffset = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;
  const monday = new Date(now);
  monday.setDate(now.getDate() + mondayOffset);
  monday.setHours(0, 0, 0, 0);

  const labels = ["S", "T", "Q", "Q", "S", "S", "D"];
  return Array.from({ length: 7 }, (_, i) => {
    const d = new Date(monday);
    d.setDate(monday.getDate() + i);
    return { date: d.toISOString().split("T")[0], label: labels[i] };
  });
}

// ── Mini IGI Chart ─────────────────────────────────────────────────
function MiniIGIChart({ history }: { history: { value: number }[] }) {
  const points = history.slice(-14);
  if (points.length < 2) return null;

  const maxVal = 10;
  const w = 280;
  const h = 80;
  const padding = 8;
  const usableW = w - padding * 2;
  const usableH = h - padding * 2;

  const polyPoints = points
    .map((p, i) => {
      const x = padding + (i / (points.length - 1)) * usableW;
      const y = padding + usableH - (p.value / maxVal) * usableH;
      return `${x},${y}`;
    })
    .join(" ");

  const gradientPoints = `${padding},${h - padding} ${polyPoints} ${padding + usableW},${h - padding}`;

  return (
    <svg viewBox={`0 0 ${w} ${h}`} className="w-full h-20" preserveAspectRatio="none">
      <defs>
        <linearGradient id="igi-fill" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="hsl(var(--primary))" stopOpacity="0.3" />
          <stop offset="100%" stopColor="hsl(var(--primary))" stopOpacity="0.05" />
        </linearGradient>
      </defs>
      {/* Y-axis guides */}
      {[0, 2.5, 5, 7.5, 10].map((v) => {
        const y = padding + usableH - (v / maxVal) * usableH;
        return (
          <line key={v} x1={padding} y1={y} x2={w - padding} y2={y} stroke="hsl(var(--border))" strokeWidth="0.5" strokeDasharray="4" />
        );
      })}
      <polygon points={gradientPoints} fill="url(#igi-fill)" />
      <polyline points={polyPoints} fill="none" stroke="hsl(var(--primary))" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
      {/* Labels */}
      <text x={padding} y={h - 1} fontSize="8" fill="hsl(var(--muted-foreground))" textAnchor="start">0</text>
      <text x={padding} y={padding + 3} fontSize="8" fill="hsl(var(--muted-foreground))" textAnchor="start">10</text>
    </svg>
  );
}

// ── Main Component ─────────────────────────────────────────────────
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

  const weekDates = getCurrentWeekDates();
  const { data: weekSessionDates } = useQuery({
    queryKey: ["io-week-sessions", userId],
    queryFn: async () => {
      const startDate = weekDates[0].date;
      const { data, error } = await supabase
        .from("io_daily_sessions")
        .select("session_date")
        .eq("user_id", userId)
        .eq("completed", true)
        .gte("session_date", startDate);
      if (error) throw error;
      return new Set((data || []).map((d) => d.session_date));
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
  const igiHistory = Array.isArray(phaseData?.igi_history) ? (phaseData.igi_history as { value: number }[]) : [];
  const trend = getTrend(igiHistory);
  const currentPhaseInfo = PHASES.find((p) => p.num === currentPhase) ?? PHASES[0];
  const phaseDetail = PHASE_DETAILS[currentPhase] ?? PHASE_DETAILS[1];

  const daysInPhase = daysDiff(phaseData?.phase_entered_at ?? phaseData?.created_at ?? null);
  const adherenceRatio = daysInPhase > 0 ? totalSessions / daysInPhase : 0;

  const completedDatesSet = weekSessionDates ?? new Set<string>();

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
        {/* a) Phase Bar */}
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
          <div className="relative mx-2 hidden sm:block">
            <div className="absolute top-0 left-0 right-0 h-0.5 bg-muted -mt-[2.15rem]" />
            <div
              className="absolute top-0 left-0 h-0.5 bg-emerald-500 -mt-[2.15rem] transition-all duration-500"
              style={{ width: `${((currentPhase - 1) / 6) * 100}%` }}
            />
          </div>
        </div>

        {/* b) Phase Card with Collapsible */}
        <div className="rounded-xl bg-gradient-to-br from-emerald-100 via-emerald-50 to-background dark:from-emerald-900/30 dark:via-emerald-950/20 dark:to-background p-4 border border-emerald-200 dark:border-emerald-800 space-y-3">
          <div>
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
              Fase {currentPhase} — {currentPhaseInfo.name}
            </p>
            <p className="text-sm text-muted-foreground mt-1 italic">
              "{currentPhaseInfo.desc}"
            </p>
          </div>

          <Collapsible>
            <CollapsibleTrigger className="flex items-center gap-1.5 text-xs font-medium text-emerald-600 dark:text-emerald-400 hover:underline group">
              <ChevronDown className="h-3.5 w-3.5 transition-transform group-data-[state=open]:rotate-180" />
              Entender esta fase
            </CollapsibleTrigger>
            <CollapsibleContent className="pt-3 space-y-3">
              <p className="text-sm text-muted-foreground leading-relaxed">
                {phaseDetail.explanation}
              </p>
              <div className="flex items-start gap-2 rounded-lg bg-emerald-50/50 dark:bg-emerald-950/20 p-3 border border-emerald-200/50 dark:border-emerald-800/50">
                <Target className="h-4 w-4 text-emerald-500 mt-0.5 shrink-0" />
                <div>
                  <p className="text-xs font-medium text-foreground">O que falta para avançar:</p>
                  <p className="text-xs text-muted-foreground mt-0.5">{phaseDetail.advancement}</p>
                </div>
              </div>
            </CollapsibleContent>
          </Collapsible>
        </div>

        {/* c) IGI Contextualizado */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <p className="text-sm font-medium text-foreground">Seu índice de integridade</p>
            <div className="flex items-center gap-1.5">
              <span className="text-lg font-bold text-foreground">{igiCurrent.toFixed(1)}</span>
              <span className="text-sm text-muted-foreground">/ 10</span>
              {trend === "up" && <TrendingUp className="h-4 w-4 text-emerald-500" />}
              {trend === "down" && <TrendingDown className="h-4 w-4 text-amber-500" />}
              {trend === "stable" && <Minus className="h-4 w-4 text-muted-foreground" />}
            </div>
          </div>
          <Progress value={(igiCurrent / 10) * 100} className="h-2.5" />
          <p className="text-xs text-muted-foreground italic">{getIGIMessage(igiCurrent)}</p>
        </div>

        {/* d) Streak Visual (7 dias) */}
        <div className="space-y-2">
          <p className="text-sm font-medium text-foreground">Sua semana</p>
          <div className="flex items-center justify-between px-2">
            {weekDates.map(({ date, label }) => {
              const done = completedDatesSet.has(date);
              const isToday = date === new Date().toISOString().split("T")[0];
              return (
                <div key={date} className="flex flex-col items-center gap-1.5">
                  <div
                    className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-medium transition-all ${
                      done
                        ? "bg-emerald-500 text-white"
                        : isToday
                          ? "border-2 border-emerald-400 dark:border-emerald-600 text-muted-foreground"
                          : "bg-muted text-muted-foreground/50"
                    }`}
                  >
                    {done ? <Check className="h-3.5 w-3.5" /> : ""}
                  </div>
                  <span className={`text-[10px] ${isToday ? "font-semibold text-foreground" : "text-muted-foreground"}`}>
                    {label}
                  </span>
                </div>
              );
            })}
          </div>
          <div className="flex items-center justify-between">
            <p className="text-xs text-muted-foreground italic">{getStreakMessage(streak)}</p>
            {streak > 0 && (
              <span className="text-xs text-muted-foreground">{streak} dia{streak !== 1 ? "s" : ""} seguido{streak !== 1 ? "s" : ""}</span>
            )}
          </div>
        </div>

        {/* e) Sessões com proporção */}
        <div className="rounded-lg border bg-card p-4 space-y-1">
          <p className="text-sm font-medium text-foreground">
            {totalSessions} sessão{totalSessions !== 1 ? "ões" : ""} em {daysInPhase} dia{daysInPhase !== 1 ? "s" : ""}
          </p>
          <p className="text-xs text-muted-foreground italic">{getAdherenceMessage(adherenceRatio)}</p>
        </div>

        {/* f) Gráfico de evolução IGI */}
        <div className="space-y-2">
          <p className="text-xs text-muted-foreground font-medium">Evolução do índice</p>
          {igiHistory.length >= 3 ? (
            <div className="rounded-lg border bg-card p-3">
              <MiniIGIChart history={igiHistory} />
            </div>
          ) : (
            <div className="rounded-lg border bg-card p-5 flex flex-col items-center gap-2 text-center">
              <div className="w-10 h-10 rounded-full bg-muted flex items-center justify-center">
                <BarChart3 className="h-5 w-5 text-muted-foreground" />
              </div>
              <p className="text-sm text-muted-foreground">
                Seu gráfico de evolução aparecerá após 3 sessões.
              </p>
              <p className="text-xs text-muted-foreground/70">
                Cada sessão adiciona um ponto à sua história.
              </p>
            </div>
          )}
        </div>

        {/* g) Session Button */}
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
