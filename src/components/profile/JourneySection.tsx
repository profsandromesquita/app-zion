import { Heart, Sprout, BarChart3, Star, Leaf } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";

interface JourneyData {
  fase_jornada: string | null;
  active_themes_count: number | null;
  global_avg_score: number | null;
  spiritual_maturity: string | null;
}

interface JourneySectionProps {
  journey: JourneyData;
}

const PHASE_MESSAGES: Record<string, { message: string; progress: number }> = {
  inicio: {
    message: "Você está dando os primeiros passos. Cada jornada começa com coragem.",
    progress: 10,
  },
  ACOLHIMENTO: {
    message: "Você está sendo acolhido. Este é um espaço seguro para explorar seus sentimentos.",
    progress: 20,
  },
  CLARIFICACAO: {
    message: "Você está ganhando clareza sobre seus padrões e crenças.",
    progress: 35,
  },
  PADROES: {
    message: "Você está identificando padrões recorrentes em sua vida.",
    progress: 50,
  },
  RAIZ: {
    message: "Você está chegando à raiz das questões que te afetam.",
    progress: 65,
  },
  TROCA: {
    message: "Você está trocando velhas crenças por novas verdades.",
    progress: 80,
  },
  CONSOLIDACAO: {
    message: "Você está consolidando as mudanças e fortalecendo sua nova identidade.",
    progress: 95,
  },
};

const JourneySection = ({ journey }: JourneySectionProps) => {
  const phase = journey.fase_jornada || "inicio";
  const phaseInfo = PHASE_MESSAGES[phase] || PHASE_MESSAGES.inicio;
  
  // Calculate progress based on score (0-5 scale to 0-100)
  const scoreProgress = journey.global_avg_score 
    ? Math.min(100, (journey.global_avg_score / 5) * 100) 
    : 0;

  return (
    <Card className="overflow-hidden">
      <CardHeader className="bg-gradient-to-r from-primary/5 to-primary/10 border-b">
        <CardTitle className="flex items-center gap-2 text-lg">
          <Heart className="h-5 w-5 text-primary" />
          Minha Jornada
        </CardTitle>
        <CardDescription>
          Seu progresso na jornada de transformação
        </CardDescription>
      </CardHeader>
      
      <CardContent className="pt-6 space-y-6">
        {/* Phase Card - Highlighted */}
        <div className="rounded-xl bg-gradient-to-br from-primary/10 via-primary/5 to-background p-5 border border-primary/20">
          <div className="flex items-start gap-3">
            <div className="p-2 rounded-lg bg-primary/10">
              <Sprout className="h-5 w-5 text-primary" />
            </div>
            <div className="flex-1 space-y-2">
              <div>
                <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                  Fase da Jornada
                </p>
                <p className="text-xl font-semibold text-foreground capitalize">
                  {phase === "inicio" ? "Início" : phase.toLowerCase().replace("_", " ")}
                </p>
              </div>
              <p className="text-sm text-muted-foreground italic leading-relaxed">
                "{phaseInfo.message}"
              </p>
            </div>
          </div>
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          {/* Temas Ativos */}
          <div className="rounded-lg border bg-card p-4 text-center space-y-2">
            <div className="mx-auto w-10 h-10 rounded-full bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center">
              <BarChart3 className="h-5 w-5 text-blue-600 dark:text-blue-400" />
            </div>
            <p className="text-2xl font-bold text-foreground">
              {journey.active_themes_count ?? 0}
            </p>
            <p className="text-xs text-muted-foreground">Temas em exploração</p>
          </div>

          {/* Score Médio */}
          <div className="rounded-lg border bg-card p-4 text-center space-y-2">
            <div className="mx-auto w-10 h-10 rounded-full bg-amber-100 dark:bg-amber-900/30 flex items-center justify-center">
              <Star className="h-5 w-5 text-amber-600 dark:text-amber-400" />
            </div>
            <p className="text-2xl font-bold text-foreground">
              {journey.global_avg_score?.toFixed(1) ?? "—"}
            </p>
            <p className="text-xs text-muted-foreground">Progresso geral</p>
          </div>

          {/* Maturidade */}
          <div className="rounded-lg border bg-card p-4 text-center space-y-2">
            <div className="mx-auto w-10 h-10 rounded-full bg-green-100 dark:bg-green-900/30 flex items-center justify-center">
              <Leaf className="h-5 w-5 text-green-600 dark:text-green-400" />
            </div>
            <p className="text-lg font-bold text-foreground truncate px-2" title={journey.spiritual_maturity || "—"}>
              {journey.spiritual_maturity || "—"}
            </p>
            <p className="text-xs text-muted-foreground">Nível de crescimento</p>
          </div>
        </div>

        {/* Progress Bar */}
        <div className="space-y-3 pt-2">
          <div className="flex items-center justify-between text-sm">
            <span className="text-muted-foreground">Progresso da jornada</span>
            <span className="font-medium text-primary">{phaseInfo.progress}%</span>
          </div>
          <div className="relative">
            <Progress value={phaseInfo.progress} className="h-3" />
            <div className="absolute inset-0 flex items-center justify-between px-1">
              {[0, 1, 2, 3, 4, 5].map((i) => (
                <div
                  key={i}
                  className={`w-1.5 h-1.5 rounded-full ${
                    phaseInfo.progress >= i * 20 ? "bg-primary-foreground" : "bg-primary/30"
                  }`}
                />
              ))}
            </div>
          </div>
          <div className="flex justify-between text-xs text-muted-foreground">
            <span>Início</span>
            <span>Consolidação</span>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};

export default JourneySection;
