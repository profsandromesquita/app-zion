import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const SYSTEM_PROMPT = `Você é Zyon, um conselheiro espiritual cristão acolhedor e empático. Seu papel é oferecer apoio emocional e espiritual baseado nos ensinamentos bíblicos.

DIRETRIZES IMPORTANTES:
1. ACOLHIMENTO PRIMEIRO: Sempre valide os sentimentos da pessoa antes de oferecer qualquer orientação.
2. TOM: Seja gentil, paciente e compreensivo. Use linguagem calorosa e acessível.
3. ESCUTA ATIVA: Faça perguntas abertas para entender melhor a situação.
4. REFERÊNCIAS BÍBLICAS: Quando apropriado, compartilhe versículos relevantes de forma natural e reconfortante.
5. NÃO JULGUE: Nunca condene ou critique. Todos merecem graça e misericórdia.
6. ESPERANÇA: Sempre aponte para a esperança em Cristo, mesmo nas situações mais difíceis.
7. LIMITE PROFISSIONAL: Não substitua terapia profissional. Se perceber sinais de crise (suicídio, violência), incentive gentilmente a buscar ajuda especializada (CVV: 188).

EXEMPLO DE RESPOSTA:
- "Entendo que você está passando por um momento difícil. É corajoso da sua parte compartilhar isso comigo."
- "Você não está sozinho(a). Deus nos lembra em Isaías 41:10: 'Não temas, porque eu sou contigo; não te assombres, porque eu sou o teu Deus'."

Responda sempre em português brasileiro, de forma acolhedora e com empatia genuína.`;

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { message, history = [] } = await req.json();

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) {
      throw new Error("LOVABLE_API_KEY is not configured");
    }

    console.log("Processing message:", message.substring(0, 50) + "...");

    const messages = [
      { role: "system", content: SYSTEM_PROMPT },
      ...history,
      { role: "user", content: message },
    ];

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages,
        max_tokens: 1024,
        temperature: 0.7,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error("AI gateway error:", response.status, errorText);

      if (response.status === 429) {
        return new Response(
          JSON.stringify({ 
            error: "Muitas solicitações. Por favor, aguarde um momento.",
            response: "Estou um pouco sobrecarregado agora. Por favor, aguarde alguns segundos e tente novamente." 
          }),
          {
            status: 429,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          }
        );
      }

      if (response.status === 402) {
        return new Response(
          JSON.stringify({ 
            error: "Limite de uso atingido.",
            response: "Preciso de um momento para me recuperar. Por favor, tente novamente mais tarde." 
          }),
          {
            status: 402,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          }
        );
      }

      throw new Error(`AI gateway error: ${response.status}`);
    }

    const data = await response.json();
    const aiResponse = data.choices?.[0]?.message?.content || 
      "Estou aqui para você. Por favor, compartilhe o que está em seu coração.";

    console.log("AI response generated successfully");

    return new Response(
      JSON.stringify({ response: aiResponse }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (error) {
    console.error("Error in zyon-chat function:", error);
    return new Response(
      JSON.stringify({ 
        error: error instanceof Error ? error.message : "Unknown error",
        response: "Desculpe, tive um problema para responder. Estou aqui para você, por favor tente novamente." 
      }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
