import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { diary_entry_id, content } = await req.json();

    if (!diary_entry_id || !content) {
      return new Response(
        JSON.stringify({ error: "diary_entry_id and content are required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Skip short content
    if (content.trim().length < 10) {
      return new Response(
        JSON.stringify({ success: false, error: "Content too short" }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Check if already has title
    const { data: existing } = await supabase
      .from("diary_entries")
      .select("title")
      .eq("id", diary_entry_id)
      .single();

    if (existing?.title) {
      return new Response(
        JSON.stringify({ success: true, title: existing.title, skipped: true }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) {
      console.error("LOVABLE_API_KEY not configured");
      return new Response(
        JSON.stringify({ success: false, error: "API key not configured" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

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
            content:
              "Você é um gerador de títulos curtos para reflexões de um diário espiritual. Gere um título de 3-5 palavras em português que capture a essência emocional ou temática da reflexão. Sem pontuação final. Sem aspas. Apenas o título. Exemplos: 'Medo de não ser suficiente', 'Decisão de recomeçar', 'Angústia sobre o futuro', 'Gratidão pela família'.",
          },
          { role: "user", content },
        ],
        temperature: 0.3,
        max_tokens: 20,
      }),
    });

    if (!aiResponse.ok) {
      const errText = await aiResponse.text();
      console.error("AI gateway error:", aiResponse.status, errText);
      return new Response(
        JSON.stringify({ success: false, error: "AI generation failed" }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const aiData = await aiResponse.json();
    let title = aiData.choices?.[0]?.message?.content?.trim() || "";

    // Clean up: remove quotes, limit to 50 chars
    title = title.replace(/^["'""'']+|["'""'']+$/g, "").trim();
    if (title.length > 50) {
      title = title.substring(0, 50);
    }

    if (!title) {
      return new Response(
        JSON.stringify({ success: false, error: "Empty title generated" }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Update entry title
    const { error: updateError } = await supabase
      .from("diary_entries")
      .update({ title })
      .eq("id", diary_entry_id);

    if (updateError) {
      console.error("Update error:", updateError);
      return new Response(
        JSON.stringify({ success: false, error: "Failed to update title" }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    return new Response(
      JSON.stringify({ success: true, title }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("generate-diary-title error:", error);
    return new Response(
      JSON.stringify({ success: false, error: "Internal error" }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
