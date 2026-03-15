import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const GENERIC_FEEDBACK = "Você completou mais um passo na sua jornada. A constância constrói o que a motivação apenas começa.";

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { user_id, session_id, phase, phase_name, mood, scales, previous_scales, mission_title, streak } = await req.json();

    // Step 0: Feature flag check
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const { data: flagEnabled } = await supabase.rpc("get_feature_flag", {
      p_flag_name: "io_daily_session_enabled",
      p_user_id: user_id,
    });

    if (!flagEnabled) {
      console.log("io_daily_session_enabled is false, returning generic feedback");
      return new Response(JSON.stringify({ feedback: GENERIC_FEEDBACK, success: false, fallback: true }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Build scale comparison text
    const scaleNames: Record<string, string> = {
      clareza: "Clareza", regulacao: "Regulação", identidade: "Identidade",
      constancia: "Constância", vitalidade: "Vitalidade", agencia: "Agência", autonomia: "Autonomia",
    };

    let scalesText = "";
    if (scales) {
      for (const [key, val] of Object.entries(scales)) {
        if (val != null) {
          const prev = previous_scales?.[key];
          const diff = prev != null ? ` (ontem: ${prev})` : "";
          scalesText += `- ${scaleNames[key] || key}: ${val}/10${diff}\n`;
        }
      }
    }

    const prompt = `Você é Zyon, mentor espiritual. Gere um feedback breve (2-3 frases) para um usuário que acabou de completar sua sessão diária.

Fase atual: ${phase} — ${phase_name}
Estado emocional (check-in): ${mood}
${mission_title ? `Missão de hoje: ${mission_title}` : ""}
Streak: ${streak} dias consecutivos

Escalas de hoje:
${scalesText || "Nenhuma escala preenchida"}

REGRAS:
- Máximo 3 frases
- Tom encorajador, nunca clínico ou diagnóstico
- Se uma escala subiu vs ontem, celebre brevemente
- Se uma escala caiu, normalize sem alarme
- Se streak > 5, reconheça a constância
- Use o reforço identitário da fase se natural
- NUNCA use 'Fico feliz', 'É ótimo que', 'Parabéns'
- NUNCA diagnostique ou explique por que a escala subiu/caiu
- Responda APENAS com o texto do feedback, sem marcação`;

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) {
      console.error("LOVABLE_API_KEY not configured");
      return new Response(JSON.stringify({ feedback: GENERIC_FEEDBACK, success: false, fallback: true }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
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
          { role: "system", content: prompt },
          { role: "user", content: "Gere o feedback da sessão." },
        ],
        max_tokens: 200,
        temperature: 0.5,
      }),
    });

    if (!aiResponse.ok) {
      const status = aiResponse.status;
      const body = await aiResponse.text();
      console.error(`AI gateway error [${status}]:`, body);

      if (status === 429) {
        return new Response(JSON.stringify({ feedback: GENERIC_FEEDBACK, success: false, fallback: true, error: "rate_limited" }), {
          status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (status === 402) {
        return new Response(JSON.stringify({ feedback: GENERIC_FEEDBACK, success: false, fallback: true, error: "payment_required" }), {
          status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      return new Response(JSON.stringify({ feedback: GENERIC_FEEDBACK, success: false, fallback: true }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const data = await aiResponse.json();
    const feedback = data.choices?.[0]?.message?.content?.trim() || GENERIC_FEEDBACK;

    return new Response(JSON.stringify({ feedback, success: true }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("io-session-feedback error:", error);
    return new Response(JSON.stringify({ feedback: GENERIC_FEEDBACK, success: false, fallback: true }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
