import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.89.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// ============================================
// TYPES
// ============================================

interface CrisisResult {
  risk_level: "none" | "low" | "medium" | "high";
  keywords_matched: string[];
  should_bypass_rag: boolean;
  crisis_response: string | null;
}

interface RouterResult {
  role: "BUSCADOR" | "SOLDADO" | "ADMIN";
  intent: string;
  confidence: number;
  rag_plan: {
    includeConstitution: boolean;
    layers: string[];
    topK: number;
    filters: Record<string, any>;
  };
}

interface ChunkResult {
  id: string;
  doc_id: string;
  text: string;
  section_path: string[];
  tags_json: Record<string, any>;
  layer: string;
  domain: string;
  priority: number;
  similarity: number;
}

interface ZyonResponse {
  response: string;
  debug?: {
    intent: string;
    role: string;
    risk_level: string;
    chunk_ids: string[];
    rag_plan: RouterResult["rag_plan"];
    latency_ms: number;
  };
  next_actions?: {
    suggestions?: string[];
    cta_cadastro?: boolean;
  };
  crisis?: {
    is_crisis: boolean;
    contacts?: Record<string, string>;
  };
}

// ============================================
// BASE IDENTITY (CONSTITUIÇÃO)
// ============================================

const BASE_IDENTITY = `Você é Zyon, mentor espiritual da plataforma ZION. Sua missão é acolher pessoas em busca de cura interior, guiando-as pelo processo de metanoia (transformação genuína).

## DIRETRIZES FUNDAMENTAIS

### 1. ACOLHIMENTO PRIMEIRO
- Sempre valide os sentimentos antes de orientar
- Use tom caloroso, paciente e não-julgador
- Pergunte mais, conclua menos (pelo menos no início)

### 2. LÓGICA DO MEDO (Base Metodológica)
A jornada humana segue o ciclo: PERDA → MEDO → INSEGURANÇA → FALSO DESEJO → MECANISMO DE DEFESA
- Ajude a pessoa a identificar a PERDA original
- Ilumine o MEDO RAIZ por trás dos sintomas
- Revele a FALSA SEGURANÇA que ela construiu
- Guie para a VERDADEIRA SEGURANÇA em Deus

### 3. ESTRUTURA DAS RESPOSTAS
1) **Acolhimento**: Validar o que a pessoa sente
2) **Leitura**: Oferecer hipóteses (não afirmações absolutas)
3) **Perguntas**: 1-3 perguntas para aprofundar
4) **Passos práticos**: Quando apropriado, sugerir ações concretas

### 4. REFERÊNCIAS BÍBLICAS
- Use a Bíblia Judaica/Hebraica como base
- Exegese curta e aplicada, não devocional superficial
- NUNCA invente versículos ou referências
- Se não souber a referência exata, pergunte ou diga que verificará

### 5. HONESTIDADE EPISTÊMICA
- Diga "não sei" quando não souber
- Ofereça hipóteses, não certezas
- Se faltar informação, pergunte antes de concluir

### 6. LIMITE PROFISSIONAL
- Não substitua terapia ou tratamento médico
- Para risco de crise: CVV 188, SAMU 192
- Incentive busca por ajuda especializada quando necessário

### 7. PRIVACIDADE
- Nunca mencione diretamente informações do diário ou perfil
- Use o contexto de forma natural e discreta

Responda sempre em português brasileiro, com empatia genuína e profundidade teológica.`;

// ============================================
// CRISIS DETECTION (INLINE)
// ============================================

const CRISIS_KEYWORDS = {
  high: [
    "quero morrer", "vou me matar", "não quero mais viver", "suicídio", "suicidar",
    "acabar com tudo", "acabar com minha vida", "tirar minha vida", "me matar",
    "não aguento mais viver", "melhor sem mim", "me cortar", "me machucar",
  ],
  medium: [
    "não aguento mais", "estou desesperado", "perdi as esperanças",
    "sem saída", "sem esperança", "desistir de tudo", "cansado de viver",
  ],
};

function detectCrisis(text: string): CrisisResult {
  const normalized = text.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
  const matched: string[] = [];
  let level: CrisisResult["risk_level"] = "none";

  for (const keyword of CRISIS_KEYWORDS.high) {
    if (normalized.includes(keyword.normalize("NFD").replace(/[\u0300-\u036f]/g, ""))) {
      matched.push(keyword);
      level = "high";
    }
  }

  if (level === "none") {
    for (const keyword of CRISIS_KEYWORDS.medium) {
      if (normalized.includes(keyword.normalize("NFD").replace(/[\u0300-\u036f]/g, ""))) {
        matched.push(keyword);
        level = "medium";
      }
    }
  }

  const crisisResponse = level === "high" 
    ? `Percebo que você está passando por um momento muito difícil. Sua vida tem valor, e você merece apoio especializado agora.

🆘 **BUSQUE AJUDA IMEDIATA:**
- **CVV (Centro de Valorização da Vida): 188** - 24h, gratuito
- **SAMU: 192** - Emergência

Estou aqui com você. Se puder, fique em um lugar seguro e ligue agora para o 188. 💙`
    : null;

  return {
    risk_level: level,
    keywords_matched: matched,
    should_bypass_rag: level === "high",
    crisis_response: crisisResponse,
  };
}

// ============================================
// INTENT ROUTER (INLINE)
// ============================================

const INTENT_PATTERNS: Record<string, RegExp[]> = {
  ACOLHIMENTO_IMEDIATO: [
    /estou (sofrendo|mal|triste|desesperado|chorando)/i,
    /preciso (desabafar|conversar|de ajuda)/i,
    /me (ajuda|acolhe|escuta)/i,
  ],
  DIAGNOSTICO: [
    /por ?que (eu|sempre)/i,
    /entender (meu|minha|o que)/i,
    /medo (de|que)/i,
    /qual (é )?meu (tipo|perfil|eneagrama)/i,
  ],
  METANOIA_CONFRONTO: [
    /perdão|perdoar/i,
    /renúncia|renunciar/i,
    /arrependimento|arrepender/i,
  ],
  PRATICA_CONSOLIDACAO: [
    /prática|prático|rotina/i,
    /passos|passo a passo/i,
    /exercício|exercícios/i,
  ],
  EXEGESE_DUVIDA_BIBLICA: [
    /bíblia|bíblico|versículo/i,
    /jesus (disse|falou|ensinou)/i,
    /passagem|texto sagrado/i,
  ],
};

function classifyIntent(message: string): { intent: string; confidence: number } {
  for (const [intent, patterns] of Object.entries(INTENT_PATTERNS)) {
    for (const pattern of patterns) {
      if (pattern.test(message)) {
        return { intent, confidence: 0.8 };
      }
    }
  }
  return { intent: "CONVERSA_GERAL", confidence: 0.5 };
}

function buildRAGPlan(intent: string): RouterResult["rag_plan"] {
  const plans: Record<string, RouterResult["rag_plan"]> = {
    ACOLHIMENTO_IMEDIATO: {
      includeConstitution: true,
      layers: ["NUCLEO"],
      topK: 4,
      filters: { domains: ["metodologia", "teologia_antropologia"] },
    },
    DIAGNOSTICO: {
      includeConstitution: true,
      layers: ["NUCLEO", "BIBLIOTECA"],
      topK: 8,
      filters: { domains: ["diagnostico", "diagnostico_identidade", "perfis", "modelo_humano"] },
    },
    METANOIA_CONFRONTO: {
      includeConstitution: true,
      layers: ["NUCLEO", "BIBLIOTECA"],
      topK: 6,
      filters: { domains: ["metodologia", "intervencao"] },
    },
    PRATICA_CONSOLIDACAO: {
      includeConstitution: true,
      layers: ["NUCLEO", "BIBLIOTECA"],
      topK: 5,
      filters: { domains: ["produto_metodologia", "produto_arquitetura"] },
    },
    EXEGESE_DUVIDA_BIBLICA: {
      includeConstitution: true,
      layers: ["NUCLEO", "BIBLIOTECA"],
      topK: 5,
      filters: { domains: ["exegese_aplicada", "canonic"] },
    },
  };

  return plans[intent] || {
    includeConstitution: true,
    layers: ["NUCLEO"],
    topK: 6,
    filters: {},
  };
}

// ============================================
// GUARDRAILS
// ============================================

const BIBLE_VERSE_PATTERN = /\b([1-3]?\s?[A-Za-zÀ-ú]+)\s+(\d+)[:\.](\d+)(-\d+)?\b/g;

function applyGuardrails(response: string, chunks: ChunkResult[]): { 
  clean: boolean; 
  warnings: string[]; 
  suggestion?: string;
} {
  const warnings: string[] = [];
  
  // Check for potential invented verses
  const verses = response.match(BIBLE_VERSE_PATTERN) || [];
  const chunkText = chunks.map(c => c.text).join(" ");
  
  for (const verse of verses) {
    if (!chunkText.includes(verse) && !BASE_IDENTITY.includes(verse)) {
      warnings.push(`Possível versículo não verificado: ${verse}`);
    }
  }

  // Check for absolute statements without backing
  const absolutePatterns = [
    /você (deve|precisa|tem que) (sempre|nunca)/i,
    /a (única|verdadeira) (forma|maneira|solução)/i,
    /certeza absoluta/i,
  ];

  for (const pattern of absolutePatterns) {
    if (pattern.test(response)) {
      warnings.push("Detectada afirmação absoluta - considere suavizar");
    }
  }

  return {
    clean: warnings.length === 0,
    warnings,
  };
}

// ============================================
// EMBEDDING GENERATION (Simple hash-based)
// ============================================

async function generateSimpleEmbedding(text: string): Promise<number[]> {
  const embedding: number[] = [];
  const encoder = new TextEncoder();
  
  for (let i = 0; i < 48; i++) {
    const data = encoder.encode(text + i.toString());
    const hashBuffer = await crypto.subtle.digest("SHA-256", data);
    const hashArray = new Float32Array(hashBuffer);
    
    for (let j = 0; j < 32 && embedding.length < 1536; j++) {
      const val = (hashArray[j % hashArray.length] || 0) / 2147483647;
      embedding.push(Math.max(-1, Math.min(1, val)));
    }
  }
  
  const magnitude = Math.sqrt(embedding.reduce((sum, v) => sum + v * v, 0));
  return embedding.map(v => v / (magnitude || 1));
}

// ============================================
// MAIN HANDLER
// ============================================

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const startTime = Date.now();

  try {
    const { message, history = [], userId, sessionId, isAdmin = false } = await req.json();

    if (!message || typeof message !== "string") {
      return new Response(
        JSON.stringify({ error: "Message is required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log("=== ZYON CHAT PIPELINE START ===");
    console.log("Message:", message.substring(0, 80) + "...");

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) {
      throw new Error("LOVABLE_API_KEY is not configured");
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    const supabase = supabaseUrl && supabaseServiceKey 
      ? createClient(supabaseUrl, supabaseServiceKey) 
      : null;

    // ========================================
    // STEP 1: CRISIS DETECTION (Priority Zero)
    // ========================================
    console.log("Step 1: Crisis Detection");
    const crisisResult = detectCrisis(message);
    
    if (crisisResult.should_bypass_rag) {
      console.log("⚠️ HIGH RISK DETECTED - Bypassing RAG");
      
      // Log crisis event
      if (supabase && sessionId) {
        const { error: crisisLogError } = await supabase.from("crisis_events").insert({
          session_id: sessionId,
          user_id: userId || null,
          risk_level: crisisResult.risk_level,
          keywords_matched: crisisResult.keywords_matched,
          crisis_response_sent: crisisResult.crisis_response,
        });
        if (crisisLogError) console.error("Failed to log crisis event:", crisisLogError);
      }

      return new Response(
        JSON.stringify({
          response: crisisResult.crisis_response,
          crisis: {
            is_crisis: true,
            contacts: { cvv: "188", samu: "192" },
          },
          debug: isAdmin ? {
            intent: "CRISIS",
            role: "BUSCADOR",
            risk_level: crisisResult.risk_level,
            chunk_ids: [],
            rag_plan: { includeConstitution: false, layers: [], topK: 0, filters: {} },
            latency_ms: Date.now() - startTime,
          } : undefined,
        } as ZyonResponse),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // ========================================
    // STEP 2: INTENT ROUTING
    // ========================================
    console.log("Step 2: Intent Routing");
    const { intent, confidence } = classifyIntent(message);
    const ragPlan = buildRAGPlan(intent);
    console.log("Intent:", intent, "Confidence:", confidence);

    // ========================================
    // STEP 3-4: RAG RETRIEVAL
    // ========================================
    console.log("Step 3-4: RAG Retrieval");
    let chunks: ChunkResult[] = [];
    let constitutionInstructions = "";
    let customInstructions = "";
    let diaryContext = "";

    if (supabase) {
      // Fetch pinned constitution (always)
      if (ragPlan.includeConstitution) {
        try {
          const { data: pinnedInstr } = await supabase
            .from("system_instructions")
            .select("name, content")
            .eq("is_pinned", true)
            .eq("is_active", true);

          if (pinnedInstr && pinnedInstr.length > 0) {
            constitutionInstructions = pinnedInstr.map(i => 
              `## ${i.name}\n${i.content}`
            ).join("\n\n");
            console.log("Constitution loaded:", pinnedInstr.length, "items");
          }
        } catch (err) {
          console.error("Error fetching constitution:", err);
        }
      }

      // Fetch active system instructions (non-pinned)
      try {
        const { data: instructions } = await supabase
          .from("system_instructions")
          .select("name, content")
          .eq("is_active", true)
          .eq("is_pinned", false)
          .order("priority", { ascending: true });

        if (instructions && instructions.length > 0) {
          customInstructions = instructions.map(i => 
            `## ${i.name}\n${i.content}`
          ).join("\n\n");
          console.log("Custom instructions loaded:", instructions.length);
        }
      } catch (err) {
        console.error("Error fetching instructions:", err);
      }

      // Vector search for chunks
      if (ragPlan.topK > 0) {
        try {
          const queryEmbedding = await generateSimpleEmbedding(message);
          
          // Build filter for layers
          const filterLayer = ragPlan.layers.length === 1 ? ragPlan.layers[0] : null;
          const filterDomain = ragPlan.filters.domains?.length === 1 
            ? ragPlan.filters.domains[0] 
            : null;

          const { data: searchResults, error: searchError } = await supabase.rpc("search_chunks", {
            query_embedding: queryEmbedding,
            match_threshold: 0.35,
            match_count: ragPlan.topK,
            filter_layer: filterLayer,
            filter_domain: filterDomain,
          });

          if (!searchError && searchResults) {
            // Additional filtering for multiple domains
            chunks = searchResults.filter((c: ChunkResult) => {
              if (ragPlan.filters.domains && ragPlan.filters.domains.length > 1) {
                return ragPlan.filters.domains.includes(c.domain);
              }
              if (ragPlan.layers.length > 1) {
                return ragPlan.layers.includes(c.layer);
              }
              return true;
            });
            console.log("Chunks retrieved:", chunks.length);
          }
        } catch (err) {
          console.error("Error in vector search:", err);
        }
      }

      // Fetch diary context for personalization (if authenticated)
      if (userId) {
        try {
          const { data: diaryEntries } = await supabase
            .from("diary_entries")
            .select("content, created_at")
            .eq("user_id", userId)
            .order("created_at", { ascending: false })
            .limit(3);

          if (diaryEntries && diaryEntries.length > 0) {
            const entries = diaryEntries.map(e => {
              const date = new Date(e.created_at).toLocaleDateString("pt-BR");
              return `- ${date}: "${e.content.substring(0, 150)}..."`;
            }).join("\n");
            diaryContext = `\n\nCONTEXTO PESSOAL (use discretamente):\n${entries}`;
            console.log("Diary context loaded");
          }
        } catch (err) {
          console.error("Error fetching diary:", err);
        }

        // Fetch user profile for personalization
        try {
          const { data: profile } = await supabase
            .from("user_profiles")
            .select("eneagrama, perfil_disc, medo_raiz_dominante, fase_jornada")
            .eq("id", userId)
            .maybeSingle();

          if (profile) {
            const profileParts = [];
            if (profile.eneagrama) profileParts.push(`Eneagrama: ${profile.eneagrama}`);
            if (profile.perfil_disc) profileParts.push(`DISC: ${profile.perfil_disc}`);
            if (profile.medo_raiz_dominante) profileParts.push(`Medo raiz: ${profile.medo_raiz_dominante}`);
            if (profile.fase_jornada) profileParts.push(`Fase: ${profile.fase_jornada}`);
            
            if (profileParts.length > 0) {
              diaryContext += `\n\nPERFIL DO USUÁRIO: ${profileParts.join(" | ")}`;
              console.log("User profile loaded");
            }
          }
        } catch (err) {
          console.error("Error fetching user profile:", err);
        }
      }
    }

    // ========================================
    // STEP 5: PROMPT ASSEMBLY
    // ========================================
    console.log("Step 5: Prompt Assembly");
    
    let systemPrompt = BASE_IDENTITY;

    // Add constitution (pinned)
    if (constitutionInstructions) {
      systemPrompt += `\n\n## CONSTITUIÇÃO ZION (SEMPRE APLICAR)\n${constitutionInstructions}`;
    }

    // Add custom instructions
    if (customInstructions) {
      systemPrompt += `\n\n## INSTRUÇÕES ADICIONAIS\n${customInstructions}`;
    }

    // Add retrieved context
    if (chunks.length > 0) {
      const chunksText = chunks.map((c, i) => {
        const path = c.section_path?.join(" > ") || "";
        return `### Ref ${i + 1} [${c.layer}/${c.domain}]${path ? ` - ${path}` : ""}\n${c.text}`;
      }).join("\n\n---\n\n");

      systemPrompt += `\n\n## CONTEXTO DA BASE DE CONHECIMENTO ZION\nUse as seguintes referências para fundamentar suas respostas:\n\n${chunksText}`;
    }

    // Add intent guidance
    const intentGuidance: Record<string, string> = {
      ACOLHIMENTO_IMEDIATO: "A pessoa precisa ser OUVIDA primeiro. Foque em validar sentimentos, fazer perguntas abertas e oferecer presença. Não apresse soluções.",
      DIAGNOSTICO: "Ajude a pessoa a ENTENDER seus padrões. Use a Lógica do Medo: identifique perdas, medos raiz, falsas seguranças. Faça perguntas diagnósticas.",
      METANOIA_CONFRONTO: "A pessoa está pronta para MUDANÇA. Guie processos de perdão, renúncia, confronto consigo mesma. Seja firme mas amoroso.",
      PRATICA_CONSOLIDACAO: "Foque em PASSOS PRÁTICOS: exercícios concretos, rotinas, hábitos. Seja específico e gradual.",
      EXEGESE_DUVIDA_BIBLICA: "Responda com EXEGESE CURTA e aplicada. Use a Bíblia Judaica. Não invente versículos. Se não souber, diga.",
    };

    if (intentGuidance[intent]) {
      systemPrompt += `\n\n## FOCO DESTA CONVERSA\n${intentGuidance[intent]}`;
    }

    // Add diary/profile context
    if (diaryContext) {
      systemPrompt += diaryContext;
    }

    // Add risk level awareness
    if (crisisResult.risk_level === "medium") {
      systemPrompt += `\n\n## ATENÇÃO: RISCO MÉDIO DETECTADO\nA pessoa pode estar em sofrimento intenso. Seja especialmente acolhedor e mencione recursos de ajuda (CVV 188) de forma natural se apropriado.`;
    }

    console.log("System prompt length:", systemPrompt.length);

    // Build messages array
    const messages = [
      { role: "system", content: systemPrompt },
      ...history.slice(-8),
      { role: "user", content: message },
    ];

    // ========================================
    // STEP 6: LLM GENERATION
    // ========================================
    console.log("Step 6: LLM Generation");
    
    const llmResponse = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages,
        max_tokens: 1200,
        temperature: 0.7,
      }),
    });

    if (!llmResponse.ok) {
      const errorText = await llmResponse.text();
      console.error("LLM Error:", llmResponse.status, errorText);

      if (llmResponse.status === 429) {
        return new Response(
          JSON.stringify({ 
            error: "Rate limit",
            response: "Estou um pouco sobrecarregado. Por favor, aguarde alguns segundos e tente novamente." 
          }),
          { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      throw new Error(`LLM error: ${llmResponse.status}`);
    }

    const llmData = await llmResponse.json();
    let aiResponse = llmData.choices?.[0]?.message?.content || 
      "Estou aqui para você. Por favor, compartilhe o que está em seu coração.";

    // ========================================
    // STEP 7: GUARDRAILS
    // ========================================
    console.log("Step 7: Guardrails");
    const guardrailResult = applyGuardrails(aiResponse, chunks);
    
    if (!guardrailResult.clean && isAdmin) {
      console.log("Guardrail warnings:", guardrailResult.warnings);
    }

    // ========================================
    // STEP 8: PERSISTENCE & RESPONSE
    // ========================================
    console.log("Step 8: Persistence & Response");
    
    // Log retrieval for audit
    if (supabase && sessionId) {
      const { error: retrievalLogError } = await supabase.from("retrieval_logs").insert({
        session_id: sessionId,
        query_text: message,
        intent,
        role: "BUSCADOR",
        retrieved_chunk_ids: chunks.map(c => c.id),
        filters_used: ragPlan.filters,
        scores_json: { chunks: chunks.map(c => ({ id: c.id, similarity: c.similarity })) },
        rag_plan: ragPlan,
        latency_ms: Date.now() - startTime,
      });
      if (retrievalLogError) console.error("Failed to log retrieval:", retrievalLogError);
    }

    const latencyMs = Date.now() - startTime;
    console.log(`=== PIPELINE COMPLETE (${latencyMs}ms) ===`);

    // Build response
    const response: ZyonResponse = {
      response: aiResponse,
      crisis: crisisResult.risk_level !== "none" ? {
        is_crisis: crisisResult.risk_level === "medium",
        contacts: { cvv: "188", samu: "192" },
      } : undefined,
    };

    // Add debug info for admins
    if (isAdmin) {
      response.debug = {
        intent,
        role: "BUSCADOR",
        risk_level: crisisResult.risk_level,
        chunk_ids: chunks.map(c => c.id),
        rag_plan: ragPlan,
        latency_ms: latencyMs,
      };
    }

    // Add next actions for anonymous users
    if (!userId) {
      response.next_actions = {
        cta_cadastro: true,
        suggestions: [
          "Gostaria de entender mais sobre meus padrões",
          "Quero saber como começar a mudar",
          "Tenho uma dúvida sobre a Bíblia",
        ],
      };
    }

    return new Response(
      JSON.stringify(response),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error) {
    console.error("Error in zyon-chat:", error);
    return new Response(
      JSON.stringify({ 
        error: error instanceof Error ? error.message : "Unknown error",
        response: "Desculpe, tive um problema. Estou aqui para você, por favor tente novamente." 
      }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
