import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.89.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// ============================================
// OBSERVER SYSTEM PROMPT
// ============================================

const OBSERVER_SYSTEM_PROMPT = `Você é um Observer que analisa conversas terapêuticas ZION.
Extraia HIPÓTESES (não diagnósticos) sobre a jornada do usuário e a qualidade do agente.

IMPORTANTE:
- Todos os campos são HIPÓTESES com confidence (0-1) e evidence_quotes[]
- Seja conservador: se não há evidência clara, deixe confidence baixo
- Cite trechos exatos como evidence_quotes
- A jornada é MATURACIONAL, não temporal (baseada em profundidade da revelação, não em nº de mensagens)

## FASES DA JORNADA (Consulte os critérios do documento para decisão)

A jornada do usuário segue estas fases, mas NÃO é linear:

0: ACOLHIMENTO - Primeiro contato OU crise emocional
   - Entrada: Usuário em carga emocional alta, confusão ou desconfiança
   - Saída: Usuário demonstra que se sente ouvido, começa a narrar fatos
   - Foco: Segurança psicológica e vínculo

1: CLARIFICACAO - Mapeamento do cenário
   - Entrada: Usuário começa a narrar eventos
   - Saída: Cronologia clara, separação entre fato e interpretação
   - Foco: Organizar os fatos

2: PADROES - Engenharia reversa do comportamento
   - Entrada: Usuário aceita explorar histórico
   - Saída: Reconhece padrão de repetição
   - Foco: Conectar evento atual a histórico comportamental

3: RAIZ - Diagnóstico teológico profundo
   - Entrada: Usuário demonstra curiosidade sobre origens
   - Saída: Identifica Medo Raiz ou Mentira Matriz
   - Foco: Conectar comportamento ao medo teológico original

4: TROCA - Metanoia e confronto
   - Entrada: Usuário reconheceu a mentira
   - Saída: Aceitação da verdade libertadora
   - Foco: Substituição da mentira pela verdade bíblica

5: CONSOLIDACAO - Prática e discipulado
   - Entrada: Usuário aceitou a cura
   - Saída: Próximos passos definidos
   - Foco: Transformar revelação em hábito

## REGRAS DE TRANSIÇÃO E REGRESSÃO

CRÍTICO - REGRESSÃO É ESPERADA:
- Se em qualquer fase (2, 3, 4 ou 5) o usuário apresentar NOVA instabilidade emocional grave (choro, raiva, negação forte), REGRIDA para a fase correspondente
- GATILHOS DE REGRESSÃO: "Não é nada disso!", "Você não entende!", "Isso é besteira!", "Para de falar disso!" → Voltar para ACOLHIMENTO
- Não force avanço quando o usuário não está pronto

{PHASE_CRITERIA_CONTEXT}

CICLO ZION (detectar se presentes):
- loss: A perda original (rejeição, abandono, fracasso...)
- fear_root: O medo que nasce da perda
- insecurity: A insegurança resultante
- false_desire: O que a pessoa busca para compensar
- defense_mechanism: Como ela se protege

RUBRICAS DO AGENTE (0-5):
- presence: Acolhimento genuíno, validação de sentimentos
- conduction_questions: Perguntas abertas que aprofundam (1-2 perguntas, NUNCA mais que 2)
- non_diagnostic: Evita rótulos e afirmações absolutas
- method_alignment: Segue a lógica ZION (perda→medo→troca)
- bible_permission_alignment: Usa Bíblia apenas quando pedido
- safety_alignment: Respeita limites, não retraumatiza

ISSUES COMUNS:
- PRESUMPTION: Assumiu algo sem perguntar
- DIAGNOSTIC: Diagnosticou ao invés de explorar
- BIBLE_WITHOUT_PERMISSION: Usou Bíblia sem pedido
- TOO_LONG: Resposta muito longa (>7 linhas)
- TOO_MANY_QUESTIONS: Mais de 2 perguntas
- FEW_QUESTIONS: Menos de 1 pergunta
- CONFLICT_CONFIRMED: Confirmou conflito externo como fato
- FORCED_ADVANCE: Tentou avançar fase sem o usuário estar pronto

## TAXONOMIA ZION (Obrigatório quando identificar lie_active)

Ao identificar uma mentira (lie_active), classifique OBRIGATORIAMENTE usando a Matriz de Seguranças:

### CENÁRIO (Onde dói) - Tagging Livre:
Casamento, Carreira, Paternidade, Maternidade, Sexualidade, Vida Social, Saúde, Família, Ministério, Finanças, Vício, Propósito, Luto, etc.
Nota: Isso é o que o usuário ACHA que é o problema.

### CENTRO (Como reage) - 3 Opções OBRIGATÓRIAS:
- INSTINTIVO: Reage com Raiva/Ação/Controle (problemas de território, justiça, autonomia)
- EMOCIONAL: Reage com Mágoa/Vergonha/Drama (problemas de imagem, afeto, rejeição)
- MENTAL: Reage com Ansiedade/Dúvida/Paralisia (problemas de medo, planejamento, segurança)

### MATRIZ DE SEGURANÇA (Raiz Teológica) - 3 Opções OBRIGATÓRIAS:
- SOBREVIVENCIA (Eu estou seguro?): Medo de morrer, faltar, ser ferido. Distorção da Proteção Divina.
  - Traumas: Abuso físico, miséria, violência
  - Mentiras típicas: "O mundo é perigoso", "Dinheiro é a única proteção", "Preciso matar para não morrer"
  - Ídolos: Riqueza, Poder, Força Bruta
  
- IDENTIDADE (Eu sou amado?): Medo de rejeição, não ter valor. Distorção do Amor Divino.
  - Traumas: Abandono afetivo, humilhação, amor condicional
  - Mentiras típicas: "Só tenho valor se for útil", "Sou um erro", "Preciso agradar para ficar"
  - Ídolos: Relacionamentos, Fama, Beleza, "Ser bonzinho"
  
- CAPACIDADE (Eu sou capaz?): Medo de falhar, ser inútil. Distorção do Propósito Divino.
  - Traumas: Crítica excessiva, perfeição, falhas expostas
  - Mentiras típicas: "Se eu errar, acabou", "Não posso confiar em ninguém", "Tenho que saber tudo"
  - Ídolos: Conhecimento, Controle, Perfeccionismo, Cargos

EXEMPLO DE SAÍDA:
"Usuário reclama do marido (Cenário: Casamento). Sente que se ele for embora, ela não é nada (Centro: EMOCIONAL). Raiz: IDENTIDADE (Ídolo do Relacionamento)."

## EXTRAÇÃO DE FATOS (memory_items) - OBRIGATÓRIO

Identifique informações FACTUAIS mencionadas EXPLICITAMENTE pelo usuário:

TIPOS DE FATOS (key):
- family_member: {"name": "...", "relation": "esposa/filho/pai/etc"}
- important_person: {"name": "...", "role": "pastor/amigo/chefe/etc", "context": "..."}
- life_event: {"event": "divórcio/demissão/morte/etc", "date": "há 2 meses/2023/etc", "impact": "..."}
- preference: {"type": "bible_version/prayer_style/etc", "value": "NVI/contemplativa/etc"}
- commitment: {"description": "...", "deadline": "..."}
- struggle: {"area": "raiva/ansiedade/vício/etc", "frequency": "diária/semanal/etc", "context": "..."}
- victory: {"description": "...", "date": "..."}

REGRAS CRÍTICAS:
1. Só extraia fatos EXPLICITAMENTE mencionados - NUNCA infira
2. confidence >= 0.8 para salvar (seja conservador)
3. is_permanent: true para fatos permanentes (nomes, relações, eventos de vida)
4. is_permanent: false para temporários (compromissos, lutas atuais, preferências)`;



// ============================================
// EXTRACTION TOOL SCHEMA
// ============================================

const EXTRACTION_TOOL = {
  type: "function",
  function: {
    name: "extract_turn_insight",
    description: "Extrai insight estruturado do turno da conversa",
    parameters: {
      type: "object",
      properties: {
        phase: { 
          type: "string", 
          enum: ["ACOLHIMENTO", "CLARIFICACAO", "PADROES", "RAIZ", "TROCA", "CONSOLIDACAO"]
        },
        phase_confidence: { type: "number", minimum: 0, maximum: 1 },
        primary_emotions: { 
          type: "array", 
          items: { type: "string" },
          description: "Emoções primárias detectadas no usuário"
        },
        emotion_intensity: { 
          type: "integer", 
          minimum: 0, 
          maximum: 3,
          description: "Intensidade emocional: 0=baixa, 1=moderada, 2=alta, 3=intensa" 
        },
        emotion_stability: { 
          type: "string", 
          enum: ["calm", "unstable"],
          description: "Estabilidade emocional percebida"
        },
        zion_cycle: {
          type: "object",
          properties: {
            loss: { 
              type: "object",
              properties: {
                text: { type: "string" },
                confidence: { type: "number" },
                evidence_quotes: { type: "array", items: { type: "string" } }
              }
            },
            fear_root: { 
              type: "object",
              properties: {
                text: { type: "string" },
                confidence: { type: "number" },
                evidence_quotes: { type: "array", items: { type: "string" } }
              }
            },
            insecurity: { 
              type: "object",
              properties: {
                text: { type: "string" },
                confidence: { type: "number" },
                evidence_quotes: { type: "array", items: { type: "string" } }
              }
            },
            false_desire: { 
              type: "object",
              properties: {
                text: { type: "string" },
                confidence: { type: "number" },
                evidence_quotes: { type: "array", items: { type: "string" } }
              }
            },
            defense_mechanism: { 
              type: "object",
              properties: {
                text: { type: "string" },
                confidence: { type: "number" },
                evidence_quotes: { type: "array", items: { type: "string" } }
              }
            },
          }
        },
        lie_active: { 
          type: "object",
          properties: {
            text: { type: "string", description: "A mentira que o usuário está acreditando" },
            confidence: { type: "number" },
            evidence_quotes: { type: "array", items: { type: "string" } },
            // TAXONOMIA ZION
            scenario: { 
              type: "string",
              description: "Cenário onde dói (tagging livre): Casamento, Carreira, Paternidade, Sexualidade, Saúde, Vida Social, Família, Ministério, Finanças, etc."
            },
            center: { 
              type: "string", 
              enum: ["INSTINTIVO", "EMOCIONAL", "MENTAL"],
              description: "Centro dominante na reação: INSTINTIVO (raiva/controle), EMOCIONAL (mágoa/vergonha), MENTAL (ansiedade/paralisia)"
            },
            security_matrix: { 
              type: "string", 
              enum: ["SOBREVIVENCIA", "IDENTIDADE", "CAPACIDADE"],
              description: "Matriz de Segurança ZION: SOBREVIVENCIA (Eu estou seguro?), IDENTIDADE (Eu sou amado?), CAPACIDADE (Eu sou capaz?)"
            }
          }
        },
        truth_target: { 
          type: "object", 
          properties: { 
            text: { type: "string", description: "A verdade que pode substituir a mentira" }, 
            confidence: { type: "number" } 
          } 
        },
        shift_detected: { 
          type: "boolean",
          description: "Houve mudança perceptível no usuário (insight, abertura, novo entendimento)"
        },
        shift_description: { type: "string" },
        shift_evidence: { type: "array", items: { type: "string" } },
        primary_virtue: { 
          type: "object", 
          properties: { 
            virtue_name: { type: "string", description: "Virtude potencial identificada" }, 
            distortion: { type: "string", description: "Como a virtude está distorcida" },
            confidence: { type: "number" },
            evidence_quotes: { type: "array", items: { type: "string" } }
          } 
        },
        next_best_question_type: { 
          type: "string", 
          enum: ["EVIDENCE", "ALTERNATIVE", "SENSATION", "VALUE", "TRUTH", "PRACTICE"],
          description: "Tipo de pergunta mais útil para o próximo turno"
        },
        rubric_scores: {
          type: "object",
          properties: {
            presence: { type: "number", minimum: 0, maximum: 5 },
            conduction_questions: { type: "number", minimum: 0, maximum: 5 },
            non_diagnostic: { type: "number", minimum: 0, maximum: 5 },
            method_alignment: { type: "number", minimum: 0, maximum: 5 },
            bible_permission_alignment: { type: "number", minimum: 0, maximum: 5 },
            safety_alignment: { type: "number", minimum: 0, maximum: 5 },
          },
          required: ["presence", "conduction_questions", "non_diagnostic", "method_alignment", "bible_permission_alignment", "safety_alignment"]
        },
        overall_score: { type: "number", minimum: 0, maximum: 5 },
        issues_detected: { 
          type: "array", 
          items: { type: "string" },
          description: "Lista de códigos de issues detectados"
        },
        quality_rationale: { 
          type: "string",
          description: "Breve justificativa da avaliação (1-3 linhas)" 
        },
        // NEW: Extracted facts for memory_items
        extracted_facts: {
          type: "array",
          items: {
            type: "object",
            properties: {
              key: { 
                type: "string",
                enum: ["family_member", "important_person", "life_event", "preference", "commitment", "struggle", "victory"],
                description: "Tipo do fato extraído"
              },
              value: { 
                type: "object",
                description: "Dados estruturados do fato (ex: {name: 'Maria', relation: 'esposa'})"
              },
              confidence: { 
                type: "number", 
                minimum: 0, 
                maximum: 1,
                description: "Confiança na extração (0-1)"
              },
              is_permanent: { 
                type: "boolean",
                description: "Se é um fato permanente (nomes, eventos de vida) ou temporário (compromissos, lutas atuais)"
              }
            },
            required: ["key", "value", "confidence", "is_permanent"]
          },
          description: "Fatos pontuais mencionados: nomes, eventos, preferências. Só extraia fatos EXPLÍCITOS com confidence >= 0.8"
        }
      },
      required: ["phase", "phase_confidence", "rubric_scores", "overall_score", "quality_rationale"]
    }
  }
};

// ============================================
// JSON SCHEMA FOR NON-TOOL FALLBACK
// ============================================

const JSON_SCHEMA_INSTRUCTIONS = `

RESPONDA SOMENTE UM JSON VÁLIDO seguindo exatamente este schema (sem markdown, sem explicações):
{
  "phase": "ACOLHIMENTO" | "CLARIFICACAO" | "PADROES" | "RAIZ" | "TROCA" | "CONSOLIDACAO",
  "phase_confidence": 0.0 a 1.0,
  "primary_emotions": ["emoção1", "emoção2"],
  "emotion_intensity": 0 a 3,
  "emotion_stability": "calm" | "unstable",
  "zion_cycle": {
    "loss": { "text": "", "confidence": 0.0, "evidence_quotes": [] },
    "fear_root": { "text": "", "confidence": 0.0, "evidence_quotes": [] },
    "insecurity": { "text": "", "confidence": 0.0, "evidence_quotes": [] },
    "false_desire": { "text": "", "confidence": 0.0, "evidence_quotes": [] },
    "defense_mechanism": { "text": "", "confidence": 0.0, "evidence_quotes": [] }
  },
  "lie_active": {
    "text": "",
    "confidence": 0.0,
    "evidence_quotes": [],
    "scenario": "Casamento | Carreira | Família | etc",
    "center": "INSTINTIVO" | "EMOCIONAL" | "MENTAL",
    "security_matrix": "SOBREVIVENCIA" | "IDENTIDADE" | "CAPACIDADE"
  },
  "truth_target": { "text": "", "confidence": 0.0 },
  "shift_detected": false,
  "shift_description": "",
  "shift_evidence": [],
  "primary_virtue": { "virtue_name": "", "distortion": "", "confidence": 0.0, "evidence_quotes": [] },
  "next_best_question_type": "EVIDENCE" | "ALTERNATIVE" | "SENSATION" | "VALUE" | "TRUTH" | "PRACTICE",
  "rubric_scores": {
    "presence": 0 a 5,
    "conduction_questions": 0 a 5,
    "non_diagnostic": 0 a 5,
    "method_alignment": 0 a 5,
    "bible_permission_alignment": 0 a 5,
    "safety_alignment": 0 a 5
  },
  "overall_score": 0 a 5,
  "issues_detected": [],
  "extracted_facts": [
    {"key": "family_member", "value": {"name": "...", "relation": "..."}, "confidence": 0.9, "is_permanent": true}
  ],
  "quality_rationale": "Justificativa curta"
}`;

// ============================================
// HELPER FUNCTIONS
// ============================================

const stripJsonFences = (text: string): string => {
  const trimmed = text.trim();
  // ```json ... ``` or ``` ... ```
  const fenceMatch = trimmed.match(/^```(?:json)?\s*([\s\S]*?)\s*```$/i);
  if (fenceMatch) return fenceMatch[1].trim();
  
  // Try to find JSON object in text
  const jsonStart = trimmed.indexOf('{');
  const jsonEnd = trimmed.lastIndexOf('}');
  if (jsonStart !== -1 && jsonEnd > jsonStart) {
    return trimmed.substring(jsonStart, jsonEnd + 1);
  }
  
  return trimmed;
};

const validateMinimalSchema = (data: any): boolean => {
  return (
    data &&
    typeof data === 'object' &&
    typeof data.phase === 'string' &&
    typeof data.phase_confidence === 'number' &&
    typeof data.overall_score === 'number' &&
    typeof data.rubric_scores === 'object' &&
    typeof data.quality_rationale === 'string'
  );
};

const extractFromLlmResult = (llm: any): any => {
  const msg = llm?.choices?.[0]?.message;
  const toolCall = msg?.tool_calls?.[0];
  
  // Try tool call first
  if (toolCall?.function?.arguments) {
    try {
      const parsed = JSON.parse(toolCall.function.arguments);
      if (validateMinimalSchema(parsed)) {
        return parsed;
      }
    } catch {
      // fallthrough
    }
  }

  // Fallback: try message.content
  const content = msg?.content;
  if (typeof content === "string" && content.trim()) {
    try {
      const stripped = stripJsonFences(content);
      const parsed = JSON.parse(stripped);
      if (validateMinimalSchema(parsed)) {
        return parsed;
      }
    } catch {
      // no-op
    }
  }

  return null;
};

// ============================================
// LLM CALL FUNCTIONS
// ============================================

const callLLMWithTools = async (model: string, systemPrompt: string, userPrompt: string, apiKey: string) => {
  console.log(`Calling LLM with tools: ${model}`);
  
  const resp = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model,
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt },
      ],
      tools: [EXTRACTION_TOOL],
      tool_choice: { type: "function", function: { name: "extract_turn_insight" } },
      max_completion_tokens: 2000,
    }),
  });

  if (!resp.ok) {
    const errorText = await resp.text();
    console.error(`LLM error (${model}):`, resp.status, errorText);
    throw new Error(`LLM error: ${resp.status}`);
  }

  return resp.json();
};

const callLLMWithoutTools = async (model: string, systemPrompt: string, userPrompt: string, apiKey: string) => {
  console.log(`Calling LLM without tools (JSON direct): ${model}`);
  
  const resp = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model,
      messages: [
        { role: "system", content: systemPrompt + JSON_SCHEMA_INSTRUCTIONS },
        { role: "user", content: userPrompt + "\n\nRespire fundo e retorne APENAS o JSON válido, sem markdown." },
      ],
      max_tokens: 2000,
    }),
  });

  if (!resp.ok) {
    const errorText = await resp.text();
    console.error(`LLM error (${model}):`, resp.status, errorText);
    throw new Error(`LLM error: ${resp.status}`);
  }

  return resp.json();
};

// ============================================
// MAIN HANDLER
// ============================================

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const startTime = Date.now();

  try {
    const {
      session_id,
      message_user_id,
      message_assistant_id,
      history = [],
      user_prompt,
      assistant_response,
      metadata = {},
      turn_number = 1,
    } = await req.json();

    console.log("=== TURN INSIGHT OBSERVER START ===");
    console.log("Session:", session_id);
    console.log("User Message ID:", message_user_id);
    console.log("Assistant Message ID:", message_assistant_id);

    // Validate required fields
    if (!session_id || !message_user_id || !message_assistant_id) {
      console.error("Missing required IDs");
      return new Response(
        JSON.stringify({ error: "Missing required IDs" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) {
      throw new Error("LOVABLE_API_KEY is not configured");
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    
    if (!supabaseUrl || !supabaseServiceKey) {
      throw new Error("Supabase credentials not configured");
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Check if insight already exists for this message
    const { data: existingInsight } = await supabase
      .from("turn_insights")
      .select("id")
      .eq("message_assistant_id", message_assistant_id)
      .maybeSingle();

    if (existingInsight) {
      console.log("Insight already exists for this message, skipping");
      return new Response(
        JSON.stringify({ status: "skipped", reason: "already_exists" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Create pending record
    const { data: pendingRecord, error: insertError } = await supabase
      .from("turn_insights")
      .insert({
        chat_session_id: session_id,
        message_user_id,
        message_assistant_id,
        turn_number,
        extractor_version: "v1.1",
        mentor_model_id: metadata.model_id || "google/gemini-2.5-flash",
        observer_model_id: "openai/gpt-5-mini",
        extraction_status: "processing",
        quality_metrics: {
          char_count: assistant_response?.length || 0,
          line_count: (assistant_response?.split('\n').filter((l: string) => l.trim()) || []).length,
          question_count: (assistant_response?.match(/\?/g) || []).length,
          was_rewritten: metadata.was_rewritten || false,
          low_confidence_retrieval: metadata.low_confidence_retrieval || false,
        },
      })
      .select("id")
      .single();

    if (insertError) {
      console.error("Failed to create pending record:", insertError);
      throw insertError;
    }

    console.log("Created pending record:", pendingRecord.id);

    // Build context for the Observer
    const historyContext = history.slice(-10).map((h: { role: string; content: string }) => 
      `[${h.role === 'user' ? 'USUÁRIO' : 'ZYON'}]: ${h.content}`
    ).join('\n\n');

    const metadataContext = `
METADADOS DO TURNO:
- Intent detectado: ${metadata.intent || 'não identificado'}
- Risk level: ${metadata.risk_level || 'none'}
- Foi reescrito: ${metadata.was_rewritten ? 'sim' : 'não'}
- Low confidence retrieval: ${metadata.low_confidence_retrieval ? 'sim' : 'não'}
- Issues do validator: ${metadata.validation_issues?.join(', ') || 'nenhum'}
`;

    const userPromptForLLM = `ANÁLISE DO TURNO DE CONVERSA

${historyContext}

---

ÚLTIMA MENSAGEM DO USUÁRIO:
${user_prompt}

RESPOSTA DO ZYON:
${assistant_response}

${metadataContext}

Analise este turno e extraia os insights estruturados.`;

    // ============================================
    // MULTI-MODEL RETRY STRATEGY
    // ============================================
    
    const MODEL_ATTEMPTS = [
      { model: "openai/gpt-5-mini", useTools: true },
      { model: "openai/gpt-5", useTools: true },
      { model: "google/gemini-2.5-flash", useTools: false }, // Fallback without tools
    ];

    let usedModel = MODEL_ATTEMPTS[0].model;
    let extractedData: any = null;
    let lastError: string | null = null;

    for (const attempt of MODEL_ATTEMPTS) {
      try {
        console.log(`Attempt with ${attempt.model} (tools: ${attempt.useTools})`);
        
        let llmResult: any;
        if (attempt.useTools) {
          llmResult = await callLLMWithTools(attempt.model, OBSERVER_SYSTEM_PROMPT, userPromptForLLM, LOVABLE_API_KEY);
        } else {
          llmResult = await callLLMWithoutTools(attempt.model, OBSERVER_SYSTEM_PROMPT, userPromptForLLM, LOVABLE_API_KEY);
        }

        extractedData = extractFromLlmResult(llmResult);
        usedModel = attempt.model;

        if (extractedData) {
          console.log(`Success with ${attempt.model}`);
          break;
        } else {
          // Log raw response for debugging
          const rawContent = llmResult?.choices?.[0]?.message?.content;
          const rawToolCall = llmResult?.choices?.[0]?.message?.tool_calls?.[0]?.function?.arguments;
          console.warn(`No valid JSON from ${attempt.model}. Raw content: ${rawContent?.substring(0, 300)}. Raw tool: ${rawToolCall?.substring(0, 300)}`);
          lastError = `No valid JSON from ${attempt.model}`;
        }
      } catch (err) {
        console.error(`Error with ${attempt.model}:`, err);
        lastError = err instanceof Error ? err.message : `Error with ${attempt.model}`;
        // Continue to next model
      }
    }

    // If all attempts failed
    if (!extractedData) {
      console.error("All model attempts failed. Last error:", lastError);

      await supabase
        .from("turn_insights")
        .update({
          extraction_status: "failed",
          extraction_error: lastError || "All model attempts failed",
          observer_model_id: usedModel,
        })
        .eq("id", pendingRecord.id);

      return new Response(
        JSON.stringify({ status: "failed", error: lastError || "All model attempts failed" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log("Extracted data:", JSON.stringify(extractedData).substring(0, 200));

    // Extract taxonomy from lie_active if present
    const lieActive = extractedData.lie_active || {};
    
    // Valid values for CHECK constraints - sanitize "N/A", empty strings, or invalid values to null
    const VALID_CENTERS = ['MENTE', 'CORACAO', 'INSTINTO'];
    const VALID_SCENARIOS = ['AUTONOMIA', 'CONEXAO', 'SEGURANCA'];
    const VALID_SECURITY_MATRICES = ['SELF', 'OTHERS', 'WORLD', 'GOD'];
    
    const rawScenario = lieActive.scenario;
    const rawCenter = lieActive.center;
    const rawSecurityMatrix = lieActive.security_matrix;
    
    // Sanitize: only accept valid enum values, otherwise null
    const lieScenario = (rawScenario && VALID_SCENARIOS.includes(rawScenario)) ? rawScenario : null;
    const lieCenter = (rawCenter && VALID_CENTERS.includes(rawCenter)) ? rawCenter : null;
    const lieSecurityMatrix = (rawSecurityMatrix && VALID_SECURITY_MATRICES.includes(rawSecurityMatrix)) ? rawSecurityMatrix : null;

    // Update record with extracted data
    const { error: updateError } = await supabase
      .from("turn_insights")
      .update({
        phase: extractedData.phase,
        phase_confidence: extractedData.phase_confidence,
        primary_emotions: extractedData.primary_emotions || [],
        emotion_intensity: extractedData.emotion_intensity,
        emotion_stability: extractedData.emotion_stability,
        zion_cycle: extractedData.zion_cycle || {},
        lie_active: extractedData.lie_active || {},
        truth_target: extractedData.truth_target || {},
        shift_detected: extractedData.shift_detected || false,
        shift_description: extractedData.shift_description,
        shift_evidence: extractedData.shift_evidence || [],
        primary_virtue: extractedData.primary_virtue || {},
        next_best_question_type: extractedData.next_best_question_type,
        rubric_scores: extractedData.rubric_scores || {},
        overall_score: extractedData.overall_score,
        issues_detected: extractedData.issues_detected || [],
        quality_rationale: extractedData.quality_rationale,
        extraction_status: "completed",
        extraction_error: null,
        observer_model_id: usedModel,
        // ZION Taxonomy columns
        lie_scenario: lieScenario,
        lie_center: lieCenter,
        lie_security_matrix: lieSecurityMatrix,
      })
      .eq("id", pendingRecord.id);

    if (updateError) {
      console.error("Failed to update record:", updateError);
      throw updateError;
    }

    // Get user_id from session
    let userId: string | null = null;
    if (session_id) {
      const { data: sessionData } = await supabase
        .from("chat_sessions")
        .select("user_id")
        .eq("id", session_id)
        .maybeSingle();
      userId = sessionData?.user_id || null;
    }

    // Call aggregate-user-journey if we have taxonomy data and a user
    if (userId && lieSecurityMatrix && lieScenario) {
      console.log("Calling aggregate-user-journey for user:", userId);
      try {
        const aggregateResponse = await fetch(
          `${supabaseUrl}/functions/v1/aggregate-user-journey`,
          {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              "Authorization": `Bearer ${supabaseServiceKey}`,
            },
            body: JSON.stringify({
              user_id: userId,
              session_id,
              insight_id: pendingRecord.id,
              lie_active: lieActive,
              phase: extractedData.phase,
              phase_confidence: extractedData.phase_confidence,
              shift_detected: extractedData.shift_detected || false,
              overall_score: extractedData.overall_score,
              truth_target: extractedData.truth_target || {},
            }),
          }
        );
        
        if (!aggregateResponse.ok) {
          console.error("Aggregate call failed:", await aggregateResponse.text());
        } else {
          console.log("Aggregate call succeeded");
        }
      } catch (aggErr) {
        console.error("Error calling aggregate:", aggErr);
        // Non-critical, don't fail the main flow
      }
    }

    // ============================================
    // NEW: PERSIST EXTRACTED FACTS TO memory_items
    // ============================================
    let factsStored = 0;
    if (userId && extractedData.extracted_facts && extractedData.extracted_facts.length > 0) {
      console.log(`Processing ${extractedData.extracted_facts.length} extracted facts for user ${userId}`);
      
      for (const fact of extractedData.extracted_facts) {
        // Only store facts with high confidence
        if (fact.confidence >= 0.8 && fact.key && fact.value) {
          try {
            // Create a unique identifier for deduplication based on key + value structure
            const valueHash = JSON.stringify(fact.value);
            
            // Check if similar fact already exists
            const { data: existing } = await supabase
              .from("memory_items")
              .select("id, value, confidence")
              .eq("user_id", userId)
              .eq("key", fact.key)
              .maybeSingle();

            // Calculate TTL based on permanence
            const ttl = fact.is_permanent 
              ? null 
              : new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(); // 30 days

            if (existing) {
              // Update if new fact has higher confidence or different value
              const existingHash = JSON.stringify(existing.value);
              if (fact.confidence > (existing.confidence || 0) || valueHash !== existingHash) {
                const { error: updateError } = await supabase
                  .from("memory_items")
                  .update({ 
                    value: fact.value, 
                    confidence: fact.confidence,
                    ttl,
                    updated_at: new Date().toISOString()
                  })
                  .eq("id", existing.id);
                  
                if (!updateError) {
                  factsStored++;
                  console.log(`Updated memory_item: ${fact.key}`);
                }
              }
            } else {
              // Insert new fact
              const { error: insertError } = await supabase
                .from("memory_items")
                .insert({
                  user_id: userId,
                  session_id: session_id,
                  key: fact.key,
                  value: fact.value,
                  confidence: fact.confidence,
                  ttl,
                });
                
              if (!insertError) {
                factsStored++;
                console.log(`Inserted memory_item: ${fact.key}`);
              }
            }
          } catch (factErr) {
            console.error(`Error storing fact ${fact.key}:`, factErr);
            // Non-critical, continue with other facts
          }
        }
      }
      
      console.log(`Stored ${factsStored} memory_items`);
    }

    // Cleanup expired memory items (5% chance to run)
    if (Math.random() < 0.05) {
      try {
        const { error: cleanupError } = await supabase
          .from("memory_items")
          .delete()
          .lt("ttl", new Date().toISOString())
          .not("ttl", "is", null);
          
        if (!cleanupError) {
          console.log("Cleaned up expired memory_items");
        }
      } catch (cleanupErr) {
        console.error("Error cleaning up memory_items:", cleanupErr);
      }
    }

    const latencyMs = Date.now() - startTime;
    console.log(`=== OBSERVER COMPLETE (${latencyMs}ms) ===`);

    return new Response(
      JSON.stringify({ 
        status: "completed",
        insight_id: pendingRecord.id,
        phase: extractedData.phase,
        overall_score: extractedData.overall_score,
        latency_ms: latencyMs,
        model_used: usedModel,
        taxonomy: lieSecurityMatrix ? { scenario: lieScenario, center: lieCenter, security_matrix: lieSecurityMatrix } : null,
        facts_stored: factsStored,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error) {
    console.error("Observer error:", error);
    return new Response(
      JSON.stringify({ 
        error: error instanceof Error ? error.message : "Unknown error",
        status: "failed",
      }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
