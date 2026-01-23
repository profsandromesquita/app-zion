import { useEffect, useState } from "react";
import { X, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";

interface WelcomeBackBannerProps {
  userId: string;
  userName: string;
  visible: boolean;
  onDismiss: () => void;
}

interface TurnInsight {
  primary_emotions: string[] | null;
  phase: string | null;
  shift_detected: boolean | null;
}

const MOTIVATIONAL_MESSAGES: Record<string, string[]> = {
  shift: [
    "Você tem dado passos importantes. Continue nessa jornada.",
    "Cada passo seu importa. Você está evoluindo.",
  ],
  medo: [
    "Coragem não é ausência de medo, é caminhar mesmo sentindo.",
    "Você está aqui, mesmo com medo. Isso é força.",
  ],
  tristeza: [
    "Sua presença aqui já é um ato de cuidado consigo.",
    "Permita-se sentir. Estou aqui para acolher.",
  ],
  ansiedade: [
    "Respire. Este é um espaço seguro para você.",
    "Um momento de cada vez. Estou aqui com você.",
  ],
  raiva: [
    "Seus sentimentos são válidos. Vamos processar juntos.",
    "Expressar o que sente é o primeiro passo para a paz.",
  ],
  deep_work: [
    "Olhar para dentro exige força. Você está sendo corajoso(a).",
    "O autoconhecimento é uma jornada de coragem.",
  ],
  default: [
    "Cada conversa é um passo. Estou aqui para caminhar com você.",
    "Que bom ter você de volta. Como posso te acolher hoje?",
    "Sua jornada continua. Estou aqui para ouvir.",
  ],
};

const getRandomMessage = (messages: string[]): string => {
  return messages[Math.floor(Math.random() * messages.length)];
};

const generateMotivationalMessage = (insights: TurnInsight[]): string => {
  if (!insights || insights.length === 0) {
    return getRandomMessage(MOTIVATIONAL_MESSAGES.default);
  }

  // Priority 1: Shift detected
  const hasShift = insights.some((i) => i.shift_detected);
  if (hasShift) {
    return getRandomMessage(MOTIVATIONAL_MESSAGES.shift);
  }

  // Priority 2: Based on emotions
  const emotions = insights
    .flatMap((i) => i.primary_emotions || [])
    .filter(Boolean);

  if (emotions.includes("medo")) {
    return getRandomMessage(MOTIVATIONAL_MESSAGES.medo);
  }
  if (emotions.includes("tristeza")) {
    return getRandomMessage(MOTIVATIONAL_MESSAGES.tristeza);
  }
  if (emotions.includes("ansiedade")) {
    return getRandomMessage(MOTIVATIONAL_MESSAGES.ansiedade);
  }
  if (emotions.includes("raiva") || emotions.includes("frustração")) {
    return getRandomMessage(MOTIVATIONAL_MESSAGES.raiva);
  }

  // Priority 3: Based on phase (deep work phases)
  const phases = insights.map((i) => i.phase).filter(Boolean);
  if (phases.includes("PADROES") || phases.includes("RAIZ")) {
    return getRandomMessage(MOTIVATIONAL_MESSAGES.deep_work);
  }

  return getRandomMessage(MOTIVATIONAL_MESSAGES.default);
};

async function fetchTurnInsights(userId: string): Promise<TurnInsight[]> {
  // Use any to bypass Supabase type complexity
  const client = supabase as any;
  
  const { data, error } = await client
    .from("turn_insights")
    .select("primary_emotions, phase, shift_detected")
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .limit(5);

  if (error || !data) {
    return [];
  }

  return data.map((item: any) => ({
    primary_emotions: item.primary_emotions,
    phase: item.phase,
    shift_detected: item.shift_detected,
  }));
}

export const WelcomeBackBanner = ({
  userId,
  userName,
  visible,
  onDismiss,
}: WelcomeBackBannerProps) => {
  const [message, setMessage] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (!visible || !userId) {
      setIsLoading(false);
      return;
    }

    const loadMessage = async () => {
      try {
        const insights = await fetchTurnInsights(userId);
        const motivationalMessage = generateMotivationalMessage(insights);
        setMessage(motivationalMessage);
      } catch (error) {
        console.error("Error fetching insights:", error);
        setMessage(getRandomMessage(MOTIVATIONAL_MESSAGES.default));
      } finally {
        setIsLoading(false);
      }
    };

    loadMessage();
  }, [userId, visible]);

  // Auto-dismiss after 8 seconds
  useEffect(() => {
    if (visible && message) {
      const timer = setTimeout(onDismiss, 8000);
      return () => clearTimeout(timer);
    }
  }, [visible, message, onDismiss]);

  if (!visible || isLoading || !message) {
    return null;
  }

  return (
    <div className="bg-primary/5 border-b border-primary/10 px-4 py-3 animate-in slide-in-from-top-2 duration-300">
      <div className="mx-auto max-w-2xl flex items-center justify-between gap-3">
        <div className="flex items-center gap-2 flex-1">
          <Sparkles className="h-4 w-4 text-primary shrink-0" />
          <p className="text-sm text-foreground">
            <span className="font-medium">Bem-vindo de volta, {userName}!</span>
            <span className="text-muted-foreground ml-1">{message}</span>
          </p>
        </div>
        <Button
          variant="ghost"
          size="icon"
          className="h-6 w-6 shrink-0"
          onClick={onDismiss}
        >
          <X className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
};
