import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
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

    const isFirstSession = !previous_scales && (streak || 0) <= 1;

    // Fetch registro_text if session_id available
    let registroContext = "";
    if (session_id) {
      const { data: sessionData } = await supabase
        .from("io_daily_sessions")
        .select("registro_text")
        .eq("id", session_id)
        .single();
      const rt = sessionData?.registro_text || "";
      if (rt.length >= 15) {
        registroContext = `\nRegistro do usuário: "${rt}"`;
      } else {
        registroContext = `\nNOTA: O registro do usuário foi vazio ou muito curto. Reconheça isso no feedback de forma acolhedora.`;
      }
    }

    // Detect critical scales
    const lowScales = scales
      ? Object.entries(scales).filter(([_, v]) => v != null && (v as number) <= 2).map(([k]) => scaleNames[k] || k)
      : [];

    const prompt = `Você é Zyon, mentor espiritual. Gere um feedback breve (2-3 frases) para um usuário que acabou de completar sua sessão diária.

Fase atual: ${phase} — ${phase_name}
Estado emocional (check-in): ${mood}
${mission_title ? `Missão de hoje: ${mission_title}` : ""}
Streak: ${streak} dias consecutivos
${isFirstSession ? "\n⚠️ PRIMEIRA SESSÃO — NÃO existe histórico. NÃO fale em crescimento, progresso ou continuidade. Reconheça que o usuário COMEÇOU." : ""}

Escalas de hoje:
${scalesText || "Nenhuma escala preenchida"}
${lowScales.length > 0 ? `\n⚠️ Escalas críticas (≤ 2): ${lowScales.join(", ")}` : ""}
${registroContext}

REGRAS DE CALIBRAÇÃO:

PRIMEIRA SESSÃO (sem previous_scales, streak ≤ 1):
- NUNCA fale em "crescimento", "progresso" ou "continue"
- NUNCA compare com sessões anteriores (não existem)
- Se escalas baixas: acolha ("começar já é coragem")
- Se escalas altas: valide sem celebrar exageradamente

ESCALAS MUITO BAIXAS (≤ 2):
- NÃO minimize ("é natural que flutue" é PROIBIDO para escala ≤ 2)
- NÃO celebre ("vislumbre de crescimento" é PROIBIDO)
- Acolha: reconheça que está difícil, valide a presença
- Ex: "Está difícil enxergar agora. Tudo bem. Você não precisa ter clareza pra estar aqui."

REGISTRO VAZIO OU EVASIVO:
- Se registro é vazio, "não lembro", "nada", ou muito curto: reconheça sem julgar
- Ex: "Às vezes 'não lembrar' é sinal de que há muita coisa acumulada."

ESCALAS CAINDO (queda ≥ 3 pontos vs ontem):
- Normalizar SEM minimizar
- Ex: "Ontem estava mais leve, hoje nem tanto. Dias assim existem. O importante é que você está aqui."

ESCALAS SUBINDO:
- Celebrar brevemente SEM exagero
- Ex: "Algo mudou hoje, né? O que será?"

REGRAS DE TOM:
- NUNCA cite escalas pelo número no texto do feedback.
  PROIBIDO: "Clareza em 1", "Com identidade em 3", "Suas escalas mostram"
  As escalas informam o TOM internamente, mas o texto NÃO as menciona. O usuário já sabe o que marcou.
- NUNCA use linguagem formal ou clínica.
  PROIBIDO: "Acolho sua presença", "Valido seu sentimento", "momento desafiador", "indicam que"
  USE linguagem humana natural: "Está pesado, né.", "Faz sentido.", "Você veio mesmo assim."
- USE as palavras do usuário (registro ou mood) como gancho.
  Se registro diz "Raiva": "Raiva. Você nomeou. Isso já é o começo."
  Se mood é "pesado": "Dia pesado. Mas você está aqui."
- Se a missão pedia nomear algo e o usuário nomeou no registro, reconheça que CUMPRIU.
  "A missão era nomear. Você nomeou. Feito."
- O feedback deve soar como um amigo presente, não como um sistema analisando dados.

REGRAS GERAIS:
- Máximo 3 frases
- NUNCA use: "Que bom!", "Parabéns!", "É ótimo que...", "Sua jornada é notável", "cada passo é um avanço"
- NUNCA fabrique tendência sem dados reais
- NUNCA diagnostique ou explique por que a escala subiu/caiu
- Se streak > 5, reconheça a constância
- Se não há nada específico para celebrar, valide a PRESENÇA: "Você veio. Isso conta."
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

    // --- Registro Analysis (post-feedback, non-blocking) ---
    let registroAnalysisCompleted = false;
    try {
      const { data: analysisFlagEnabled } = await supabase.rpc("get_feature_flag", {
        p_flag_name: "io_pm_registro_analysis_enabled",
        p_user_id: user_id,
      });

      if (analysisFlagEnabled && session_id) {
        // Fetch registro_text from the session
        const { data: sessionData } = await supabase
          .from("io_daily_sessions")
          .select("registro_text")
          .eq("id", session_id)
          .single();

        const registroText = sessionData?.registro_text || "";

        if (registroText.length >= 10) {
          // Build analysis context
          const analysisPrompt = `Você é um analista de jornada interior. Analise o registro abaixo escrito por um usuário após completar uma missão diária.

REGISTRO DO USUÁRIO:
"${registroText}"

${mission_title ? `MISSÃO DO DIA: ${mission_title}` : ""}

ESCALAS PREENCHIDAS (0-10):
${scalesText || "Nenhuma escala preenchida"}

Avalie o registro usando a tool "analyze_registro".

INSTRUÇÕES:
- genuineness_score: 0.0 = texto vazio/copiado/genérico, 1.0 = profundamente pessoal e autêntico
- coherence_with_scales: 0.0 = totalmente incoerente com as escalas informadas, 1.0 = perfeitamente alinhado
- depth_level: "superficial" (relato raso, sem reflexão), "moderado" (alguma reflexão), "profundo" (introspecção genuína)
- repetition_detected: true se o texto parecer repetitivo ou formulaico
- key_themes: até 5 temas principais extraídos do texto
- analysis_summary: resumo de 1 frase sobre a qualidade do registro`;

          const analysisResponse = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
            method: "POST",
            headers: {
              Authorization: `Bearer ${LOVABLE_API_KEY}`,
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              model: "google/gemini-2.5-flash-lite",
              messages: [
                { role: "system", content: analysisPrompt },
                { role: "user", content: "Analise o registro." },
              ],
              tools: [
                {
                  type: "function",
                  function: {
                    name: "analyze_registro",
                    description: "Retorna a análise estruturada do registro da missão.",
                    parameters: {
                      type: "object",
                      properties: {
                        genuineness_score: { type: "number", description: "0.0-1.0: autenticidade do registro" },
                        coherence_with_scales: { type: "number", description: "0.0-1.0: coerência com escalas" },
                        depth_level: { type: "string", enum: ["superficial", "moderado", "profundo"] },
                        repetition_detected: { type: "boolean" },
                        key_themes: { type: "array", items: { type: "string" } },
                        analysis_summary: { type: "string" },
                      },
                      required: ["genuineness_score", "coherence_with_scales", "depth_level", "repetition_detected", "key_themes", "analysis_summary"],
                      additionalProperties: false,
                    },
                  },
                },
              ],
              tool_choice: { type: "function", function: { name: "analyze_registro" } },
              temperature: 0.3,
            }),
          });

          if (analysisResponse.ok) {
            const analysisData = await analysisResponse.json();
            const toolCall = analysisData.choices?.[0]?.message?.tool_calls?.[0];
            if (toolCall?.function?.arguments) {
              const analysis = JSON.parse(toolCall.function.arguments);
              await supabase
                .from("io_daily_sessions")
                .update({ registro_analysis: analysis })
                .eq("id", session_id);
              registroAnalysisCompleted = true;
              console.log("Registro analysis saved for session:", session_id);
            }
          } else {
            console.warn("Registro analysis LLM call failed:", analysisResponse.status);
          }
        } else {
          // Empty or too short
          const skippedAnalysis = {
            genuineness_score: 0,
            coherence_with_scales: 0,
            depth_level: "superficial",
            repetition_detected: false,
            key_themes: [],
            analysis_summary: "Registro vazio ou insuficiente",
            skipped: true,
          };
          await supabase
            .from("io_daily_sessions")
            .update({ registro_analysis: skippedAnalysis })
            .eq("id", session_id);
          registroAnalysisCompleted = true;
          console.log("Registro analysis skipped (short text) for session:", session_id);
        }
      }
    } catch (analysisError) {
      console.warn("Registro analysis failed (non-blocking):", analysisError);
      // Do NOT update registro_analysis — leave as null
    }

    return new Response(JSON.stringify({ feedback, success: true, registro_analysis_completed: registroAnalysisCompleted }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("io-session-feedback error:", error);
    return new Response(JSON.stringify({ feedback: GENERIC_FEEDBACK, success: false, fallback: true }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
