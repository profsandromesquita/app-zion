import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.89.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const BASE_IDENTITY = `Você é Zyon, um conselheiro espiritual cristão acolhedor e empático. Seu papel é oferecer apoio emocional e espiritual baseado nos ensinamentos bíblicos.

DIRETRIZES FUNDAMENTAIS:
1. ACOLHIMENTO PRIMEIRO: Sempre valide os sentimentos da pessoa antes de oferecer qualquer orientação.
2. TOM: Seja gentil, paciente e compreensivo. Use linguagem calorosa e acessível.
3. ESCUTA ATIVA: Faça perguntas abertas para entender melhor a situação.
4. REFERÊNCIAS BÍBLICAS: Quando apropriado, compartilhe versículos relevantes de forma natural e reconfortante.
5. NÃO JULGUE: Nunca condene ou critique. Todos merecem graça e misericórdia.
6. ESPERANÇA: Sempre aponte para a esperança em Cristo, mesmo nas situações mais difíceis.
7. LIMITE PROFISSIONAL: Não substitua terapia profissional. Se perceber sinais de crise (suicídio, violência), incentive gentilmente a buscar ajuda especializada (CVV: 188).

Responda sempre em português brasileiro, de forma acolhedora e com empatia genuína.`;

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { message, history = [], userId } = await req.json();

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) {
      throw new Error("LOVABLE_API_KEY is not configured");
    }

    console.log("Processing message:", message.substring(0, 50) + "...");

    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    
  let systemInstructionsContext = "";
    let ragContext = "";
    let diaryContext = "";

    if (supabaseUrl && supabaseServiceKey) {
      const supabase = createClient(supabaseUrl, supabaseServiceKey);

      // Fetch active system instructions (ordered by priority)
      try {
        const { data: instructions, error: instrError } = await supabase
          .from("system_instructions")
          .select("name, content")
          .eq("is_active", true)
          .order("priority", { ascending: true });

        if (!instrError && instructions && instructions.length > 0) {
          const instructionsText = instructions.map((i) => 
            `## ${i.name}\n${i.content}`
          ).join("\n\n");
          
          systemInstructionsContext = `

INSTRUÇÕES CUSTOMIZADAS DO SISTEMA:
${instructionsText}`;
          
          console.log("System instructions loaded:", instructions.length);
        }
      } catch (err) {
        console.error("Error fetching system instructions:", err);
      }

      // RAG: Buscar chunks relevantes via busca vetorial
      try {
        // Gerar embedding simples da mensagem para busca
        const queryEmbedding = await generateSimpleEmbedding(message);
        
        // Buscar chunks usando a função RPC
        const { data: chunks, error: chunksError } = await supabase.rpc("search_chunks", {
          query_embedding: queryEmbedding,
          match_threshold: 0.4,
          match_count: 5,
          filter_layer: null,
          filter_domain: null,
        });

        if (!chunksError && chunks && chunks.length > 0) {
          const chunksText = chunks.map((c: any, i: number) => {
            const sectionPath = c.section_path?.join(" > ") || "";
            return `### Referência ${i + 1} (${c.layer} - ${c.domain})${sectionPath ? `\nSeção: ${sectionPath}` : ""}\n${c.text}`;
          }).join("\n\n---\n\n");
          
          ragContext = `

CONTEXTO RECUPERADO DA BASE DE CONHECIMENTO ZION:
Use as seguintes referências para fundamentar suas respostas quando relevante:

${chunksText}`;
          
          console.log("RAG context loaded:", chunks.length, "chunks");
        } else {
          // Fallback para knowledge_base legado
          const { data: knowledge, error: kbError } = await supabase
            .from("knowledge_base")
            .select("title, content, category")
            .eq("is_active", true);

          if (!kbError && knowledge && knowledge.length > 0) {
            const knowledgeText = knowledge.map((k) => {
              const contentPreview = k.content.length > 1000 
                ? k.content.substring(0, 1000) + "..." 
                : k.content;
              return `### ${k.title} (${k.category})\n${contentPreview}`;
            }).join("\n\n---\n\n");
            
            ragContext = `

BASE DE CONHECIMENTO ZION:
Use os seguintes materiais como guia para suas respostas quando relevante:

${knowledgeText}`;
            
            console.log("Legacy knowledge base loaded:", knowledge.length, "documents");
          }
        }
      } catch (err) {
        console.error("Error fetching RAG context:", err);
      }

      // Fetch diary entries for authenticated users
      if (userId) {
        try {
          const { data: diaryEntries, error: diaryError } = await supabase
            .from("diary_entries")
            .select("content, created_at")
            .eq("user_id", userId)
            .order("created_at", { ascending: false })
            .limit(5);

          if (!diaryError && diaryEntries && diaryEntries.length > 0) {
            const entriesSummary = diaryEntries.map((entry) => {
              const date = new Date(entry.created_at).toLocaleDateString("pt-BR");
              const contentPreview = entry.content.length > 200 
                ? entry.content.substring(0, 200) + "..." 
                : entry.content;
              return `- ${date}: "${contentPreview}"`;
            }).join("\n");

            diaryContext = `

CONTEXTO PESSOAL DO USUÁRIO:
Este usuário compartilhou recentemente em seu diário espiritual:
${entriesSummary}

Use estas informações para oferecer apoio mais personalizado e contextualizado. 
Não mencione diretamente o diário a menos que seja naturalmente relevante para a conversa.`;
            
            console.log("Diary context loaded for user:", userId);
          }
        } catch (err) {
          console.error("Error fetching diary entries:", err);
        }
      }
    }

    // Build the complete system prompt
    const systemPrompt = BASE_IDENTITY + systemInstructionsContext + ragContext + diaryContext;

    console.log("System prompt length:", systemPrompt.length, "characters");

    const messages = [
      { role: "system", content: systemPrompt },
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

// Helper: Gerar embedding simples baseado em hash
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
