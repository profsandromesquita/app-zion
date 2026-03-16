import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";

export interface StarterItem {
  text: string;
  emoji: string;
}

// Mapeamento de Security Matrix para frases personalizadas
const SECURITY_MATRIX_STARTERS: Record<string, StarterItem[]> = {
  IDENTIDADE: [
    { text: "Estou me sentindo como um vazio no coração", emoji: "🕳️" },
    { text: "Às vezes não sei quem eu realmente sou", emoji: "🪞" },
    { text: "Sinto que preciso provar meu valor", emoji: "⚖️" },
  ],
  CAPACIDADE: [
    { text: "Sinto que não vou dar conta", emoji: "😓" },
    { text: "Estou me cobrando demais", emoji: "🏋️" },
    { text: "Tenho medo de falhar", emoji: "😰" },
  ],
  SOBREVIVENCIA: [
    { text: "Sinto que preciso me proteger o tempo todo", emoji: "🛡️" },
    { text: "Tenho medo de perder o controle", emoji: "🌀" },
    { text: "Algo me faz sentir ameaçado(a)", emoji: "⚡" },
  ],
};

// Mapeamento de emoções para frases
const EMOTION_STARTERS: Record<string, StarterItem> = {
  ansiedade: { text: "Estou me sentindo ansioso(a) hoje", emoji: "😰" },
  medo: { text: "Tenho sentido medo de algo", emoji: "😨" },
  tristeza: { text: "Estou com um peso de tristeza", emoji: "😢" },
  vazio: { text: "Estou me sentindo vazio(a)", emoji: "🕳️" },
  abandono: { text: "Às vezes me sinto sozinho(a)", emoji: "🏚️" },
  frustração: { text: "Estou frustrado(a) com algo", emoji: "😤" },
  insegurança: { text: "Ando me sentindo inseguro(a)", emoji: "🫣" },
  raiva: { text: "Estou com raiva de alguma coisa", emoji: "😠" },
  culpa: { text: "Estou me sentindo culpado(a)", emoji: "😔" },
  vergonha: { text: "Sinto vergonha de algo", emoji: "🫥" },
};

// Mapeamento de cenário para frases
const SCENARIO_STARTERS: Record<string, StarterItem> = {
  Família: { text: "Algo sobre minha família me incomoda", emoji: "👨‍👩‍👧" },
  Carreira: { text: "Estou com questões sobre meu trabalho", emoji: "💼" },
  Relacionamentos: { text: "Algo me pesa nos meus relacionamentos", emoji: "💔" },
  Paternidade: { text: "Tenho pensado sobre ser pai/mãe", emoji: "👶" },
  Saúde: { text: "Estou preocupado(a) com minha saúde", emoji: "🏥" },
  Finanças: { text: "Questões financeiras têm me pesado", emoji: "💰" },
  Espiritualidade: { text: "Tenho dúvidas sobre minha fé", emoji: "🙏" },
};

// Starters genéricos (sempre 2)
const GENERIC_STARTERS: StarterItem[] = [
  { text: "Preciso desabafar sobre algo", emoji: "💬" },
  { text: "Não sei por onde começar...", emoji: "🤔" },
];

// Starters padrão para primeira vez
export const DEFAULT_STARTERS: StarterItem[] = [
  { text: "Estou me sentindo ansioso(a)", emoji: "😰" },
  { text: "Tenho um peso no coração", emoji: "💔" },
  { text: "Preciso desabafar sobre algo", emoji: "💬" },
  { text: "Não sei por onde começar...", emoji: "🤔" },
  { text: "Só preciso de alguém para ouvir", emoji: "👂" },
];

interface TurnInsightData {
  lie_security_matrix: string | null;
  lie_scenario: string | null;
  primary_emotions: string[] | null;
}

function countFrequency(items: (string | null)[]): Record<string, number> {
  const counts: Record<string, number> = {};
  for (const item of items) {
    if (item) {
      counts[item] = (counts[item] || 0) + 1;
    }
  }
  return counts;
}

function getTopItem(counts: Record<string, number>): string | null {
  let topItem: string | null = null;
  let maxCount = 0;
  for (const [item, count] of Object.entries(counts)) {
    if (count > maxCount) {
      maxCount = count;
      topItem = item;
    }
  }
  return topItem;
}

function getTopItems(counts: Record<string, number>, limit: number): string[] {
  return Object.entries(counts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, limit)
    .map(([item]) => item);
}

function randomChoice<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

function generatePersonalizedStarters(insights: TurnInsightData[]): StarterItem[] {
  const personalized: StarterItem[] = [];
  const usedTexts = new Set<string>();

  // 1. Contar frequência de cada matriz de segurança
  const matrices = insights.map((i) => i.lie_security_matrix);
  const matrixCounts = countFrequency(matrices);
  const topMatrix = getTopItem(matrixCounts);

  // 2. Contar emoções mais frequentes (flatten array)
  const allEmotions: string[] = [];
  for (const insight of insights) {
    if (insight.primary_emotions) {
      allEmotions.push(...insight.primary_emotions.map((e) => e.toLowerCase()));
    }
  }
  const emotionCounts = countFrequency(allEmotions);
  const topEmotions = getTopItems(emotionCounts, 3);

  // 3. Cenário mais frequente
  const scenarios = insights.map((i) => i.lie_scenario);
  const scenarioCounts = countFrequency(scenarios);
  const topScenario = getTopItem(scenarioCounts);

  // Adicionar starter baseado na matriz (prioridade 1)
  if (topMatrix && SECURITY_MATRIX_STARTERS[topMatrix]) {
    const starter = randomChoice(SECURITY_MATRIX_STARTERS[topMatrix]);
    if (!usedTexts.has(starter.text)) {
      personalized.push(starter);
      usedTexts.add(starter.text);
    }
  }

  // Adicionar starter baseado em emoção (prioridade 2)
  for (const emotion of topEmotions) {
    if (personalized.length >= 3) break;
    const starter = EMOTION_STARTERS[emotion];
    if (starter && !usedTexts.has(starter.text)) {
      personalized.push(starter);
      usedTexts.add(starter.text);
    }
  }

  // Adicionar starter baseado em cenário (prioridade 3)
  if (topScenario && SCENARIO_STARTERS[topScenario] && personalized.length < 3) {
    const starter = SCENARIO_STARTERS[topScenario];
    if (!usedTexts.has(starter.text)) {
      personalized.push(starter);
      usedTexts.add(starter.text);
    }
  }

  // Preencher até 3 com defaults se necessário
  for (const starter of DEFAULT_STARTERS) {
    if (personalized.length >= 3) break;
    if (!usedTexts.has(starter.text)) {
      personalized.push(starter);
      usedTexts.add(starter.text);
    }
  }

  // Adicionar 2 genéricos
  return [...personalized.slice(0, 3), ...GENERIC_STARTERS];
}

export const PHASE_ICEBREAKERS: Record<number, StarterItem[]> = {
  1: [
    { emoji: "😰", text: "Estou me sentindo ansioso(a)" },
    { emoji: "💭", text: "Algo está me incomodando e não sei o quê" },
    { emoji: "🔄", text: "Uma situação que se repete na minha vida" },
    { emoji: "🤔", text: "Não sei por onde começar" },
    { emoji: "💬", text: "Quero falar sobre outra coisa" },
  ],
  2: [
    { emoji: "😤", text: "Reagi de um jeito que não queria" },
    { emoji: "🪞", text: "Quero entender por que algo me incomodou" },
    { emoji: "⚖️", text: "Preciso separar o que é meu do que é do outro" },
    { emoji: "😶", text: "Estou engolindo o que deveria falar" },
    { emoji: "💬", text: "Quero falar sobre outra coisa" },
  ],
  3: [
    { emoji: "🔁", text: "Percebi um padrão que se repete em mim" },
    { emoji: "🗣️", text: "Uma frase que repito sobre mim mesmo" },
    { emoji: "😔", text: "Algo que acredito sobre mim e dói" },
    { emoji: "🧩", text: "Quero entender por que faço o que faço" },
    { emoji: "💬", text: "Quero falar sobre outra coisa" },
  ],
  4: [
    { emoji: "💪", text: "Quero manter o ritmo que comecei" },
    { emoji: "⚡", text: "Algo me desafiou hoje" },
    { emoji: "🛑", text: "Quase voltei a um hábito antigo" },
    { emoji: "🌱", text: "Um pequeno avanço que percebi" },
    { emoji: "💬", text: "Quero falar sobre outra coisa" },
  ],
  5: [
    { emoji: "🤝", text: "Quero falar sobre um relacionamento" },
    { emoji: "💔", text: "Preciso processar uma mágoa" },
    { emoji: "🕊️", text: "Estou pensando em pedir perdão" },
    { emoji: "😊", text: "Algo bom aconteceu com alguém" },
    { emoji: "💬", text: "Quero falar sobre outra coisa" },
  ],
  6: [
    { emoji: "📋", text: "Quero organizar uma área da minha vida" },
    { emoji: "🎯", text: "Defini uma meta e quero falar sobre" },
    { emoji: "⚠️", text: "Estou procrastinando algo importante" },
    { emoji: "✅", text: "Completei uma ação que planejei" },
    { emoji: "💬", text: "Quero falar sobre outra coisa" },
  ],
  7: [
    { emoji: "🙏", text: "Quero refletir sobre minha jornada" },
    { emoji: "🌟", text: "Algo que aprendi sobre mim" },
    { emoji: "🤲", text: "Como compartilhar o que vivi" },
    { emoji: "📖", text: "Quero voltar a um tema antigo" },
    { emoji: "💬", text: "Quero falar sobre outra coisa" },
  ],
};

export function usePersonalizedStarters(userId: string | null, isReturningUser: boolean) {
  const [starters, setStarters] = useState<StarterItem[] | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!userId || !isReturningUser) {
      setStarters(null);
      return;
    }

    const fetchPersonalizedStarters = async () => {
      setLoading(true);
      try {
        // Buscar últimos insights do usuário (últimos 30 dias)
        const thirtyDaysAgo = new Date();
        thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

        const { data: insights, error } = await supabase
          .from("turn_insights")
          .select(`
            lie_security_matrix,
            lie_scenario,
            primary_emotions,
            chat_session_id
          `)
          .gte("created_at", thirtyDaysAgo.toISOString())
          .order("created_at", { ascending: false })
          .limit(50);

        if (error) {
          console.error("Error fetching insights for starters:", error);
          setStarters(null);
          return;
        }

        // Filtrar por sessões do usuário (via join indireto)
        if (!insights || insights.length === 0) {
          setStarters(null);
          return;
        }

        // Buscar sessões do usuário para filtrar os insights
        const sessionIds = [...new Set(insights.map((i) => i.chat_session_id))];
        const { data: userSessions } = await supabase
          .from("chat_sessions")
          .select("id")
          .eq("user_id", userId)
          .in("id", sessionIds);

        if (!userSessions || userSessions.length === 0) {
          setStarters(null);
          return;
        }

        const userSessionIds = new Set(userSessions.map((s) => s.id));
        const userInsights = insights.filter((i) => userSessionIds.has(i.chat_session_id));

        if (userInsights.length === 0) {
          setStarters(null);
          return;
        }

        const personalizedStarters = generatePersonalizedStarters(userInsights);
        setStarters(personalizedStarters);
      } catch (err) {
        console.error("Error generating personalized starters:", err);
        setStarters(null);
      } finally {
        setLoading(false);
      }
    };

    fetchPersonalizedStarters();
  }, [userId, isReturningUser]);

  return { starters, loading };
}
