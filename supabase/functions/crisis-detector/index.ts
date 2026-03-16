import { serve } from "https://deno.land/std@0.224.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Crisis keywords categorized by severity
const CRISIS_KEYWORDS = {
  high: [
    // Suicídio
    "quero morrer", "vou me matar", "não quero mais viver", "suicídio", "suicidar",
    "acabar com tudo", "acabar com minha vida", "tirar minha vida", "me matar",
    "não aguento mais viver", "melhor sem mim", "mundo sem mim",
    // Autolesão
    "me cortar", "me machucar", "autolesão", "me ferir", "quero me machucar",
    // Violência iminente
    "vou matar", "matar alguém", "fazer mal", "vingança violenta",
    // Abuso em andamento
    "estou sendo abusado", "estão me batendo", "não consigo sair", "sequestro",
  ],
  medium: [
    // Dor intensa
    "não aguento mais", "estou desesperado", "não sei o que fazer",
    "perdi as esperanças", "sem saída", "sem esperança", "desistir de tudo",
    "cansado de viver", "não tem sentido", "vida não faz sentido",
    // Crise emocional
    "ataque de pânico", "não consigo respirar", "estou em pânico",
    "crise de ansiedade", "não consigo parar de chorar",
  ],
  low: [
    // Tristeza profunda
    "muito triste", "muito mal", "deprimido", "depressão", "ansioso",
    "angustiado", "sofrendo muito", "dor emocional", "solidão profunda",
  ],
};

// Emergency contacts for Brazil
const CRISIS_CONTACTS = {
  cvv: "188",
  samu: "192",
  policia: "190",
  disquedenúncia: "181",
};

interface CrisisResult {
  risk_level: "none" | "low" | "medium" | "high";
  keywords_matched: string[];
  should_bypass_rag: boolean;
  crisis_response: string | null;
  contacts: typeof CRISIS_CONTACTS | null;
}

function detectCrisisKeywords(text: string): { level: string; keywords: string[] } {
  const normalizedText = text.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
  const matchedKeywords: string[] = [];
  let highestLevel = "none";

  for (const [level, keywords] of Object.entries(CRISIS_KEYWORDS)) {
    for (const keyword of keywords) {
      const normalizedKeyword = keyword.normalize("NFD").replace(/[\u0300-\u036f]/g, "");
      if (normalizedText.includes(normalizedKeyword)) {
        matchedKeywords.push(keyword);
        if (level === "high" || (level === "medium" && highestLevel !== "high") || (level === "low" && highestLevel === "none")) {
          highestLevel = level;
        }
      }
    }
  }

  return { level: highestLevel, keywords: matchedKeywords };
}

function generateCrisisResponse(riskLevel: string): string {
  if (riskLevel === "high") {
    return `Percebo que você está passando por um momento muito difícil. Sua vida tem valor, e você merece apoio especializado agora.

🆘 **BUSQUE AJUDA IMEDIATA:**
- **CVV (Centro de Valorização da Vida): 188** - 24h, gratuito
- **SAMU: 192** - Emergência
- **Polícia: 190** - Se estiver em perigo

Estou aqui com você. Se puder, fique em um lugar seguro e ligue agora para o 188. Eles estão preparados para ajudar.

Você não precisa enfrentar isso sozinho(a). 💙`;
  }

  if (riskLevel === "medium") {
    return `Percebo que você está passando por um momento muito intenso. Quero que saiba que estou aqui para ouvir você.

Se sentir que precisa de apoio especializado a qualquer momento:
- **CVV: 188** - Disponível 24h, gratuito e sigiloso

Me conta mais sobre o que está sentindo? Estou aqui para acolher você. 💙`;
  }

  return "";
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { message, useAI = false } = await req.json();

    if (!message || typeof message !== "string") {
      return new Response(
        JSON.stringify({ error: "Message is required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log("Analyzing message for crisis:", message.substring(0, 50) + "...");

    // Step 1: Keyword-based detection (fast)
    const keywordResult = detectCrisisKeywords(message);
    
    let result: CrisisResult = {
      risk_level: keywordResult.level as CrisisResult["risk_level"],
      keywords_matched: keywordResult.keywords,
      should_bypass_rag: keywordResult.level === "high",
      crisis_response: generateCrisisResponse(keywordResult.level),
      contacts: keywordResult.level === "high" ? CRISIS_CONTACTS : null,
    };

    // Step 2: Optional AI-enhanced detection for edge cases
    if (useAI && keywordResult.level === "none") {
      const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
      if (LOVABLE_API_KEY) {
        try {
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
                  content: `Você é um classificador de risco de crise. Analise a mensagem e retorne APENAS uma das seguintes palavras:
- HIGH: se há risco iminente de suicídio, autolesão, violência ou abuso
- MEDIUM: se há sinais de sofrimento intenso ou crise emocional
- LOW: se há sinais de tristeza ou angústia, mas sem risco iminente
- NONE: se não há sinais de crise

Responda APENAS com a palavra, sem explicação.`,
                },
                { role: "user", content: message },
              ],
              max_tokens: 10,
              temperature: 0.1,
            }),
          });

          if (aiResponse.ok) {
            const data = await aiResponse.json();
            const aiLevel = data.choices?.[0]?.message?.content?.trim().toUpperCase();
            
            if (["HIGH", "MEDIUM", "LOW"].includes(aiLevel)) {
              const normalizedLevel = aiLevel.toLowerCase() as CrisisResult["risk_level"];
              result = {
                risk_level: normalizedLevel,
                keywords_matched: ["AI-detected"],
                should_bypass_rag: normalizedLevel === "high",
                crisis_response: generateCrisisResponse(normalizedLevel),
                contacts: normalizedLevel === "high" ? CRISIS_CONTACTS : null,
              };
            }
          }
        } catch (aiError) {
          console.error("AI crisis detection failed, using keyword result:", aiError);
        }
      }
    }

    console.log("Crisis detection result:", result.risk_level, result.keywords_matched);

    return new Response(
      JSON.stringify(result),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Error in crisis-detector:", error);
    return new Response(
      JSON.stringify({ 
        error: error instanceof Error ? error.message : "Unknown error",
        risk_level: "none",
        keywords_matched: [],
        should_bypass_rag: false,
        crisis_response: null,
        contacts: null,
      }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
