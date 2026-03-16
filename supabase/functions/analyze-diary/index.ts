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
    const { user_id, diary_entry_id, content } = await req.json();

    if (!user_id || !diary_entry_id || !content) {
      return new Response(
        JSON.stringify({ error: "Missing required fields" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // Short content — skip analysis
    if (content.trim().length < 10) {
      const skippedResult = { skipped: true, analysis_summary: "Registro insuficiente" };
      await supabase
        .from("diary_entries")
        .update({ io_analysis: skippedResult })
        .eq("id", diary_entry_id);

      return new Response(
        JSON.stringify({ success: true, skipped: true }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) {
      console.error("LOVABLE_API_KEY not configured");
      return new Response(
        JSON.stringify({ success: false, error: "AI key not configured" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Call LLM with tool calling for structured output
    const systemPrompt = `Você é um analista de reflexões espirituais. Analise o texto do diário e extraia informações estruturadas sobre a qualidade e profundidade da reflexão. Responda APENAS usando a ferramenta fornecida.

Classifique também a categoria principal da reflexão:
- familia: sobre pais, filhos, cônjuge, parentes, dinâmica familiar
- carreira: sobre trabalho, profissão, estudos, carreira
- relacionamento: sobre amizades, namoro, casamento, vínculos afetivos
- autoestima: sobre valor próprio, autoimagem, insegurança pessoal
- saude: sobre corpo, doença, saúde mental, hábitos físicos
- financas: sobre dinheiro, dívidas, provisão, estabilidade financeira
- fe_espiritualidade: sobre Deus, oração, fé, dúvidas espirituais
- autoconhecimento: sobre padrões internos, descobertas pessoais, reflexão profunda
- outro: quando não se encaixa claramente em nenhuma categoria acima`;

    const userPrompt = `Analise esta reflexão espontânea de um diário espiritual:\n\n"${content}"`;

    let analysisResult = null;

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
            { role: "system", content: systemPrompt },
            { role: "user", content: userPrompt },
          ],
          temperature: 0.3,
          tools: [
            {
              type: "function",
              function: {
                name: "analyze_diary_entry",
                description: "Retorna a análise estruturada de uma reflexão do diário espiritual.",
                parameters: {
                  type: "object",
                  properties: {
                    genuineness_score: {
                      type: "number",
                      description: "Score de 0.0 a 1.0 indicando autenticidade e vulnerabilidade da reflexão",
                    },
                    depth_level: {
                      type: "string",
                      enum: ["superficial", "moderate", "deep"],
                      description: "Nível de profundidade da reflexão",
                    },
                    key_themes: {
                      type: "array",
                      items: { type: "string" },
                      description: "Lista de temas principais identificados (máx 5)",
                    },
                    emotional_tone: {
                      type: "string",
                      enum: ["positive", "neutral", "negative", "mixed"],
                      description: "Tom emocional predominante",
                    },
                    analysis_summary: {
                      type: "string",
                      description: "Uma frase resumindo a reflexão",
                    },
                    primary_category: {
                      type: "string",
                      enum: [
                        "familia", "carreira", "relacionamento",
                        "autoestima", "saude", "financas",
                        "fe_espiritualidade", "autoconhecimento", "outro"
                      ],
                      description: "Categoria principal da reflexão baseada no tema dominante. Escolha a que melhor representa o foco central do texto.",
                    },
                  },
                  required: ["genuineness_score", "depth_level", "key_themes", "emotional_tone", "analysis_summary", "primary_category"],
                  additionalProperties: false,
                },
              },
            },
          ],
          tool_choice: { type: "function", function: { name: "analyze_diary_entry" } },
        }),
      });

      if (!aiResponse.ok) {
        const errText = await aiResponse.text();
        console.error("AI gateway error:", aiResponse.status, errText);
      } else {
        const aiData = await aiResponse.json();
        const toolCall = aiData.choices?.[0]?.message?.tool_calls?.[0];
        if (toolCall?.function?.arguments) {
          analysisResult = JSON.parse(toolCall.function.arguments);
        }
      }
    } catch (aiErr) {
      console.error("AI analysis failed:", aiErr);
    }

    // Update diary entry with analysis (null if failed)
    await supabase
      .from("diary_entries")
      .update({ io_analysis: analysisResult })
      .eq("id", diary_entry_id);

    return new Response(
      JSON.stringify({
        success: true,
        analyzed: analysisResult !== null,
        analysis: analysisResult,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    console.error("analyze-diary error:", err);
    return new Response(
      JSON.stringify({ error: err instanceof Error ? err.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
