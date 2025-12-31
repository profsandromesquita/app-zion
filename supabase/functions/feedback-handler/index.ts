import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.89.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

type FeedbackType = "helpful" | "not_helpful" | "heresia";

interface FeedbackRequest {
  message_id: string;
  session_id: string;
  user_id?: string;
  type: FeedbackType;
  reason?: string;
}

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

    // If heresia, trigger admin notification (could be a webhook, email, etc.)
    if (type === "heresia") {
      console.log("⚠️ HERESIA ALERT for message:", message_id);
      
      // Get the message content for context
      const { data: messageData } = await supabase
        .from("chat_messages")
        .select("content")
        .eq("id", message_id)
        .single();

      // Log for admin review
      console.log("Message flagged as heresia:", {
        message_id,
        session_id,
        content_preview: messageData?.content?.substring(0, 200),
        reason,
        timestamp: new Date().toISOString(),
      });

      // TODO: Could add notification to admin here (email, push, etc.)
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
