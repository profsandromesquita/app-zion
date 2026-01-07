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

FASES DA JORNADA:
0: ACOLHIMENTO - Primeiro contato, estabelecer confiança
1: CLARIFICACAO - Entender a situação, perguntas exploratórias
2: PADROES - Identificar ciclos, repetições, defesas
3: RAIZ - Chegar ao medo/perda original
4: TROCA - Propor substituição mentira→verdade
5: CONSOLIDACAO - Prática, virtude, dons

CICLO ZION (detectar se presentes):
- loss: A perda original (rejeição, abandono, fracasso...)
- fear_root: O medo que nasce da perda
- insecurity: A insegurança resultante
- false_desire: O que a pessoa busca para compensar
- defense_mechanism: Como ela se protege

RUBRICAS DO AGENTE (0-5):
- presence: Acolhimento genuíno, validação de sentimentos
- conduction_questions: Perguntas abertas que aprofundam
- non_diagnostic: Evita rótulos e afirmações absolutas
- method_alignment: Segue a lógica ZION (perda→medo→troca)
- bible_permission_alignment: Usa Bíblia apenas quando pedido
- safety_alignment: Respeita limites, não retraumatiza

ISSUES COMUNS:
- PRESUMPTION: Assumiu algo sem perguntar
- DIAGNOSTIC: Diagnosticou ao invés de explorar
- BIBLE_WITHOUT_PERMISSION: Usou Bíblia sem pedido
- TOO_LONG: Resposta muito longa (>10 linhas)
- FEW_QUESTIONS: Poucas perguntas abertas
- CONFLICT_CONFIRMED: Confirmou conflito externo como fato`;

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
            evidence_quotes: { type: "array", items: { type: "string" } }
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
        }
      },
      required: ["phase", "phase_confidence", "rubric_scores", "overall_score", "quality_rationale"]
    }
  }
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
        extractor_version: "v1.0",
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

    const userPrompt = `ANÁLISE DO TURNO DE CONVERSA

${historyContext}

---

ÚLTIMA MENSAGEM DO USUÁRIO:
${user_prompt}

RESPOSTA DO ZYON:
${assistant_response}

${metadataContext}

Analise este turno e extraia os insights estruturados.`;

    // Call LLM for extraction
    console.log("Calling LLM for extraction...");
    
    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "openai/gpt-5-mini",
        messages: [
          { role: "system", content: OBSERVER_SYSTEM_PROMPT },
          { role: "user", content: userPrompt }
        ],
        tools: [EXTRACTION_TOOL],
        tool_choice: { type: "function", function: { name: "extract_turn_insight" } },
        max_completion_tokens: 2000,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error("LLM error:", response.status, errorText);
      
      // Mark as failed
      await supabase
        .from("turn_insights")
        .update({ 
          extraction_status: "failed",
          extraction_error: `LLM error: ${response.status}`,
        })
        .eq("id", pendingRecord.id);
      
      throw new Error(`LLM error: ${response.status}`);
    }

    const llmResult = await response.json();
    console.log("LLM response received");

    // Extract tool call result
    const toolCall = llmResult.choices?.[0]?.message?.tool_calls?.[0];
    if (!toolCall?.function?.arguments) {
      console.error("No tool call in response");
      
      await supabase
        .from("turn_insights")
        .update({ 
          extraction_status: "failed",
          extraction_error: "No tool call in LLM response",
        })
        .eq("id", pendingRecord.id);
      
      throw new Error("No tool call in LLM response");
    }

    let extractedData;
    try {
      extractedData = JSON.parse(toolCall.function.arguments);
    } catch (parseErr) {
      console.error("Failed to parse tool call arguments:", parseErr);
      
      await supabase
        .from("turn_insights")
        .update({ 
          extraction_status: "failed",
          extraction_error: "Failed to parse extraction result",
        })
        .eq("id", pendingRecord.id);
      
      throw parseErr;
    }

    console.log("Extracted data:", JSON.stringify(extractedData).substring(0, 200));

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
      })
      .eq("id", pendingRecord.id);

    if (updateError) {
      console.error("Failed to update record:", updateError);
      throw updateError;
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
