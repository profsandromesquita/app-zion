import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Role definitions
type Role = "BUSCADOR" | "SOLDADO" | "ADMIN";

// Intent definitions by role
const INTENTS = {
  BUSCADOR: [
    "ACOLHIMENTO_IMEDIATO",      // Dor, sofrimento, precisa ser ouvido
    "DIAGNOSTICO",               // Entender padrões, Lógica do Medo
    "METANOIA_CONFRONTO",        // Perdão, renúncia, carta, confronto
    "PRATICA_CONSOLIDACAO",      // Rotina, passos pequenos, comunidade
    "MATCHMAKING",               // Buscar Soldados similares
    "EXEGESE_DUVIDA_BIBLICA",    // Questões bíblicas
    "CONVERSA_GERAL",            // Conversa sem categoria específica
  ],
  SOLDADO: [
    "REGISTRO_TESTEMUNHO",       // Registrar testemunho
    "PROCESSAMENTO_ASSINCRONO", // Pipeline de processamento
  ],
  ADMIN: [
    "CURADORIA_TEOLOGICA",       // Aprovar base e respostas
    "FEEDBACK_HERESIA",          // Marcar, revisar
    "GESTAO_BASE",               // Versões, camadas, tags
  ],
} as const;

type BuscadorIntent = typeof INTENTS.BUSCADOR[number];
type SoldadoIntent = typeof INTENTS.SOLDADO[number];
type AdminIntent = typeof INTENTS.ADMIN[number];
type Intent = BuscadorIntent | SoldadoIntent | AdminIntent;

// RAG Plan configuration
interface RAGPlan {
  includeConstitution: boolean;
  layers: ("CONSTITUICAO" | "NUCLEO" | "BIBLIOTECA")[];
  topK: number;
  filters: {
    domains?: string[];
    tags?: string[];
    priority_min?: number;
  };
}

// Intent patterns for quick classification
const INTENT_PATTERNS: Record<BuscadorIntent, RegExp[]> = {
  ACOLHIMENTO_IMEDIATO: [
    /estou (sofrendo|mal|triste|desesperado|chorando|angustiado)/i,
    /preciso (desabafar|conversar|de ajuda)/i,
    /não (aguento|suporto|consigo) mais/i,
    /me (ajuda|acolhe|escuta)/i,
    /dor (profunda|intensa|no coração)/i,
  ],
  DIAGNOSTICO: [
    /por ?que (eu|sempre)/i,
    /entender (meu|minha|o que)/i,
    /padrão|ciclo|repete/i,
    /medo (de|que)/i,
    /insegurança|segurança/i,
    /perda|perdido|perdi/i,
    /qual (é )?meu (tipo|perfil|eneagrama)/i,
  ],
  METANOIA_CONFRONTO: [
    /perdão|perdoar/i,
    /renúncia|renunciar/i,
    /carta|escrever/i,
    /confrontar|confronto/i,
    /libertar|liberdade/i,
    /deixar ir|soltar/i,
    /arrependimento|arrepender/i,
  ],
  PRATICA_CONSOLIDACAO: [
    /prática|prático|rotina/i,
    /passos|passo a passo/i,
    /exercício|exercícios/i,
    /começar|iniciar/i,
    /hábito|hábitos/i,
    /comunidade|grupo/i,
  ],
  MATCHMAKING: [
    /alguém (que|como)/i,
    /soldado|testemunho similar/i,
    /história parecida/i,
    /conhecer (alguém|pessoas)/i,
    /conectar|conexão/i,
  ],
  EXEGESE_DUVIDA_BIBLICA: [
    /bíblia|bíblico|versículo/i,
    /jesus (disse|falou|ensinou)/i,
    /o que (diz|significa)/i,
    /passagem|texto sagrado/i,
    /evangelho|antigo testamento/i,
    /interpretação|interpretar/i,
    /salmo|provérbio|eclesiastes/i,
  ],
  CONVERSA_GERAL: [], // Default fallback
};

function classifyIntentByPatterns(message: string): { intent: BuscadorIntent; confidence: number } {
  let bestMatch: BuscadorIntent = "CONVERSA_GERAL";
  let bestScore = 0;

  for (const [intent, patterns] of Object.entries(INTENT_PATTERNS)) {
    if (patterns.length === 0) continue;
    
    let matchCount = 0;
    for (const pattern of patterns) {
      if (pattern.test(message)) {
        matchCount++;
      }
    }
    
    const score = matchCount / patterns.length;
    if (score > bestScore) {
      bestScore = score;
      bestMatch = intent as BuscadorIntent;
    }
  }

  return {
    intent: bestMatch,
    confidence: bestScore > 0 ? Math.min(bestScore * 2, 1) : 0.3, // Boost confidence, cap at 1
  };
}

function buildRAGPlan(role: Role, intent: Intent): RAGPlan {
  const basePlan: RAGPlan = {
    includeConstitution: true,
    layers: ["NUCLEO"],
    topK: 6,
    filters: {},
  };

  if (role === "BUSCADOR") {
    switch (intent) {
      case "ACOLHIMENTO_IMEDIATO":
        return {
          ...basePlan,
          layers: ["NUCLEO"],
          topK: 4,
          filters: { domains: ["metodologia", "teologia_antropologia"], priority_min: 60 },
        };
      case "DIAGNOSTICO":
        return {
          ...basePlan,
          layers: ["NUCLEO", "BIBLIOTECA"],
          topK: 8,
          filters: { domains: ["diagnostico", "diagnostico_identidade", "perfis", "modelo_humano"] },
        };
      case "METANOIA_CONFRONTO":
        return {
          ...basePlan,
          layers: ["NUCLEO", "BIBLIOTECA"],
          topK: 6,
          filters: { domains: ["metodologia", "intervencao", "metodologia_teologia"] },
        };
      case "PRATICA_CONSOLIDACAO":
        return {
          ...basePlan,
          layers: ["NUCLEO", "BIBLIOTECA"],
          topK: 5,
          filters: { domains: ["produto_metodologia", "produto_arquitetura"] },
        };
      case "MATCHMAKING":
        return {
          includeConstitution: true,
          layers: ["BIBLIOTECA"],
          topK: 10,
          filters: { tags: ["testemunho", "soldado"] },
        };
      case "EXEGESE_DUVIDA_BIBLICA":
        return {
          ...basePlan,
          layers: ["NUCLEO", "BIBLIOTECA"],
          topK: 5,
          filters: { domains: ["exegese_aplicada", "canonic", "teologia_antropologia"] },
        };
      default:
        return basePlan;
    }
  }

  if (role === "SOLDADO") {
    return {
      includeConstitution: true,
      layers: [],
      topK: 0,
      filters: {},
    };
  }

  // ADMIN
  return {
    includeConstitution: false,
    layers: ["NUCLEO", "BIBLIOTECA"],
    topK: 10,
    filters: {},
  };
}

interface RouterResult {
  role: Role;
  intent: Intent;
  confidence: number;
  rag_plan: RAGPlan;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { message, history = [], contextRole, useAI = true } = await req.json();

    if (!message || typeof message !== "string") {
      return new Response(
        JSON.stringify({ error: "Message is required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log("Routing message:", message.substring(0, 50) + "...");

    // Determine role from context (can be overridden by endpoint)
    let role: Role = contextRole || "BUSCADOR";
    
    // Pattern-based intent classification (fast)
    const patternResult = classifyIntentByPatterns(message);
    let intent: Intent = patternResult.intent;
    let confidence = patternResult.confidence;

    // AI-enhanced classification for low confidence or complex cases
    if (useAI && confidence < 0.6) {
      const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
      if (LOVABLE_API_KEY) {
        try {
          const recentHistory = history.slice(-3).map((m: any) => 
            `${m.role === "user" ? "Usuário" : "Assistente"}: ${m.content.substring(0, 100)}`
          ).join("\n");

          const aiResponse = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
            method: "POST",
            headers: {
              Authorization: `Bearer ${LOVABLE_API_KEY}`,
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              model: "google/gemini-2.5-flash-lite",
              messages: [
                {
                  role: "system",
                  content: `Você é um classificador de intenção para uma plataforma de acolhimento espiritual cristão.
Classifique a mensagem do usuário em UMA das seguintes categorias:

- ACOLHIMENTO_IMEDIATO: Pessoa em sofrimento emocional, precisa ser ouvida e acolhida
- DIAGNOSTICO: Pessoa quer entender seus padrões, medos, comportamentos, perfil
- METANOIA_CONFRONTO: Pessoa pronta para trabalhar perdão, renúncia, mudança
- PRATICA_CONSOLIDACAO: Pessoa buscando exercícios práticos, rotinas, passos
- MATCHMAKING: Pessoa quer conhecer histórias similares ou Soldados
- EXEGESE_DUVIDA_BIBLICA: Pergunta sobre Bíblia, versículos, interpretação
- CONVERSA_GERAL: Conversa casual sem categoria específica

${recentHistory ? `Contexto recente:\n${recentHistory}\n` : ""}

Responda APENAS com o nome da categoria, sem explicação.`,
                },
                { role: "user", content: message },
              ],
              max_tokens: 30,
              temperature: 0.1,
            }),
          });

          if (aiResponse.ok) {
            const data = await aiResponse.json();
            const aiIntent = data.choices?.[0]?.message?.content?.trim().toUpperCase().replace(/\s+/g, "_");
            
            if (INTENTS.BUSCADOR.includes(aiIntent as BuscadorIntent)) {
              intent = aiIntent as BuscadorIntent;
              confidence = 0.85;
            }
          }
        } catch (aiError) {
          console.error("AI intent classification failed:", aiError);
        }
      }
    }

    const ragPlan = buildRAGPlan(role, intent);

    const result: RouterResult = {
      role,
      intent,
      confidence,
      rag_plan: ragPlan,
    };

    console.log("Router result:", result.role, result.intent, result.confidence);

    return new Response(
      JSON.stringify(result),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Error in intent-router:", error);
    return new Response(
      JSON.stringify({ 
        error: error instanceof Error ? error.message : "Unknown error",
        role: "BUSCADOR",
        intent: "CONVERSA_GERAL",
        confidence: 0.5,
        rag_plan: {
          includeConstitution: true,
          layers: ["NUCLEO"],
          topK: 6,
          filters: {},
        },
      }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
