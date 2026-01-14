import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.89.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

type FeedbackType = "helpful" | "not_helpful" | "heresia";
type DatasetLabel = "useful" | "not_useful" | "theology_report";

interface FeedbackRequest {
  message_id: string;
  session_id: string;
  user_id?: string;
  type: FeedbackType;
  reason?: string;
}

// Mapear tipos de feedback para labels do dataset
const feedbackToLabel: Record<FeedbackType, DatasetLabel> = {
  helpful: "useful",
  not_helpful: "not_useful",
  heresia: "theology_report",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const body: FeedbackRequest = await req.json();
    const { message_id, session_id, user_id, type, reason } = body;

    if (!message_id || !session_id || !type) {
      return new Response(
        JSON.stringify({ error: "message_id, session_id, and type are required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (!["helpful", "not_helpful", "heresia"].includes(type)) {
      return new Response(
        JSON.stringify({ error: "Invalid feedback type" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log("Processing feedback:", type, "for message:", message_id);

    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

    if (!supabaseUrl || !supabaseServiceKey) {
      throw new Error("Supabase configuration missing");
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Insert feedback event
    const { data: feedback, error: feedbackError } = await supabase
      .from("feedback_events")
      .insert({
        message_id,
        session_id,
        user_id: user_id || null,
        type,
        reason: reason || null,
      })
      .select("id")
      .single();

    if (feedbackError) {
      console.error("Error inserting feedback:", feedbackError);
      throw feedbackError;
    }

    console.log("Feedback saved:", feedback.id);

    // =============================================
    // CAPTURA PARA DATASET DE FINE-TUNING
    // =============================================
    try {
      // Buscar mensagem do assistente (a que recebeu o feedback)
      const { data: assistantMsg, error: assistantError } = await supabase
        .from("chat_messages")
        .select("id, content, intent, risk_level, metadata, session_id, created_at")
        .eq("id", message_id)
        .single();

      if (assistantError) {
        console.error("Error fetching assistant message:", assistantError);
      } else if (assistantMsg) {
        // Buscar a mensagem anterior do usuário (a pergunta que gerou a resposta)
        const { data: userMsg, error: userError } = await supabase
          .from("chat_messages")
          .select("id, content")
          .eq("session_id", assistantMsg.session_id)
          .eq("sender", "user")
          .lt("created_at", assistantMsg.created_at)
          .order("created_at", { ascending: false })
          .limit(1)
          .single();

        if (userError) {
          console.error("Error fetching user message:", userError);
        } else if (userMsg) {
          // Extrair metadados do debug (se existirem)
          const metadata = assistantMsg.metadata || {};
          const debug = typeof metadata === 'object' && metadata !== null ? (metadata as Record<string, unknown>).debug || {} : {};
          const debugObj = typeof debug === 'object' && debug !== null ? debug as Record<string, unknown> : {};
          const validation = typeof debugObj.validation === 'object' && debugObj.validation !== null 
            ? debugObj.validation as Record<string, unknown> 
            : {};

          const feedbackLabel = feedbackToLabel[type];
          
          // NOVO: Buscar fase do turn_insights
          let phase: string | null = null;
          try {
            const { data: turnInsight } = await supabase
              .from("turn_insights")
              .select("phase")
              .eq("message_assistant_id", message_id)
              .maybeSingle();

            if (turnInsight?.phase) {
              phase = turnInsight.phase;
              console.log("Phase captured from turn_insights:", phase);
            }
          } catch (phaseErr) {
            console.error("Error fetching phase (non-fatal):", phaseErr);
          }
          
          // Preparar dados do dataset
          const datasetItem = {
            chat_session_id: session_id,
            user_id: user_id || null,
            message_user_id: userMsg.id,
            message_assistant_id: message_id,
            feedback_event_id: feedback.id,
            user_prompt_text: userMsg.content,
            assistant_answer_text: assistantMsg.content,
            feedback_label: feedbackLabel,
            feedback_note: reason || null,
            model_id: (debugObj.model_id as string) || "google/gemini-2.5-flash-lite",
            intent: assistantMsg.intent,
            risk_level: assistantMsg.risk_level,
            was_rewritten: Boolean(validation.was_rewritten),
            rag_used: Array.isArray(debugObj.chunk_ids) && debugObj.chunk_ids.length > 0,
            rag_low_confidence: Boolean(debugObj.low_confidence_retrieval),
            retrieved_chunk_ids: Array.isArray(debugObj.chunk_ids) ? debugObj.chunk_ids : [],
            retrieval_stats: typeof debugObj.retrieval_stats === 'object' ? debugObj.retrieval_stats : {},
            // Default: incluir apenas 'useful' no export
            include_in_export: type === "helpful",
            // NOVO: Fase da jornada
            phase,
          };

          // Upsert para evitar duplicação (atualiza se já existe)
          const { error: datasetError } = await supabase
            .from("feedback_dataset_items")
            .upsert(datasetItem, {
              onConflict: "message_assistant_id,feedback_label",
              ignoreDuplicates: false,
            });

          if (datasetError) {
            console.error("Error saving to dataset:", datasetError);
          } else {
            console.log("Dataset item saved for feedback:", feedbackLabel, "phase:", phase);
          }
        }
      }
    } catch (datasetErr) {
      // Não falhar o feedback principal se o dataset der erro
      console.error("Error in dataset capture (non-fatal):", datasetErr);
    }

    // If heresia, trigger admin notification
    if (type === "heresia") {
      console.log("⚠️ HERESIA ALERT for message:", message_id);
      
      const { data: messageData } = await supabase
        .from("chat_messages")
        .select("content")
        .eq("id", message_id)
        .single();

      console.log("Message flagged as heresia:", {
        message_id,
        session_id,
        content_preview: messageData?.content?.substring(0, 200),
        reason,
        timestamp: new Date().toISOString(),
      });
    }

    return new Response(
      JSON.stringify({ 
        success: true,
        feedback_id: feedback.id,
        message: type === "heresia" 
          ? "Obrigado pelo feedback. A equipe de curadoria será notificada."
          : "Obrigado pelo seu feedback!",
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Error in feedback-handler:", error);
    return new Response(
      JSON.stringify({ 
        error: error instanceof Error ? error.message : "Unknown error",
        success: false,
      }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
