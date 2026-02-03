import { createClient } from "jsr:@supabase/supabase-js@2";
import webpush from "npm:web-push@3.6.7";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

// ZION Taxonomy constants
const SCENARIOS = [
  "CASAMENTO", "CARREIRA", "FAMILIA", "VIDA_SOCIAL", "AUTOESTIMA",
  "SAUDE", "FINANCAS", "MINISTERIO", "LUTO", "SEXUALIDADE",
  "PATERNIDADE", "MATERNIDADE"
] as const;

const CENTERS = ["INSTINTIVO", "EMOCIONAL", "MENTAL"] as const;
const SECURITY_MATRICES = ["SOBREVIVENCIA", "IDENTIDADE", "CAPACIDADE"] as const;

// Analysis extraction tool for structured output
const ANALYSIS_EXTRACTION_TOOL = {
  type: "function",
  function: {
    name: "extract_testimony_analysis",
    description: "Extrai análise estruturada do testemunho segundo a metodologia ZION",
    parameters: {
      type: "object",
      properties: {
        repentance_classification: {
          type: "string",
          enum: ["true_repentance", "remorse", "unclear"],
          description: "Classificação do tipo de arrependimento"
        },
        repentance_confidence: {
          type: "number",
          minimum: 0,
          maximum: 1,
          description: "Confiança na classificação (0-1)"
        },
        repentance_evidence: {
          type: "array",
          items: { type: "string" },
          description: "Citações diretas que evidenciam a classificação"
        },
        entities: {
          type: "object",
          properties: {
            traumas: {
              type: "array",
              items: { type: "string" },
              description: "Traumas identificados (abandono, abuso, negligência, etc)"
            },
            addictions: {
              type: "array",
              items: { type: "string" },
              description: "Vícios mencionados (álcool, drogas, pornografia, etc)"
            },
            victories: {
              type: "array",
              items: { type: "string" },
              description: "Vitórias alcançadas (sobriedade, reconciliação, cura, etc)"
            }
          }
        },
        lie_matrix: {
          type: "object",
          properties: {
            security_lost: {
              type: "string",
              enum: ["SOBREVIVENCIA", "IDENTIDADE", "CAPACIDADE"],
              description: "Qual matriz de segurança foi ferida"
            },
            false_security: {
              type: "string",
              description: "O que a pessoa buscou como falsa segurança"
            },
            lie_believed: {
              type: "string",
              description: "A mentira que a pessoa acreditou"
            }
          }
        },
        transformation_pattern: {
          type: "array",
          items: { type: "string" },
          description: "Elementos do padrão de transformação (oração, jejum, comunidade, terapia, etc)"
        },
        suggested_tags: {
          type: "array",
          items: { type: "string" },
          description: "Tags sugeridas no formato #Tag (ex: #Alcool, #Familia, #Restauracao)"
        },
        scenario: {
          type: "string",
          enum: SCENARIOS,
          description: "Cenário principal do testemunho"
        },
        related_scenarios: {
          type: "array",
          items: { type: "string" },
          description: "Cenários secundários relacionados"
        },
        center: {
          type: "string",
          enum: CENTERS,
          description: "Centro dominante na experiência"
        },
        security_matrix: {
          type: "string",
          enum: SECURITY_MATRICES,
          description: "Matriz de segurança raiz"
        },
        safe_for_publication: {
          type: "boolean",
          description: "Se o conteúdo parece seguro para publicação sem curadoria adicional"
        },
        curator_required_reason: {
          type: "string",
          description: "Razão pela qual curadoria humana é necessária (heresia, conteúdo sensível, etc)"
        },
        anonymized_transcript: {
          type: "string",
          description: "Transcrição com nomes de terceiros anonimizados ([PESSOA_1], [PESSOA_2], etc)"
        }
      },
      required: [
        "repentance_classification", "repentance_confidence", "scenario",
        "center", "security_matrix", "safe_for_publication", "anonymized_transcript"
      ],
      additionalProperties: false
    }
  }
};

const ANALYSIS_SYSTEM_PROMPT = `Você é um analista teológico especializado na metodologia ZION.
Analise o testemunho transcrito e extraia informações estruturadas.

TAXONOMIA ZION:
- CENÁRIO (onde dói): CASAMENTO, CARREIRA, FAMILIA, VIDA_SOCIAL, AUTOESTIMA, SAUDE, FINANCAS, MINISTERIO, LUTO, SEXUALIDADE, PATERNIDADE, MATERNIDADE
- CENTRO (como reage): INSTINTIVO (raiva/controle), EMOCIONAL (mágoa/vergonha), MENTAL (ansiedade/paralisia)
- MATRIZ DE SEGURANÇA (raiz): SOBREVIVENCIA (Eu estou seguro?), IDENTIDADE (Eu sou amado?), CAPACIDADE (Eu sou capaz?)

CLASSIFICAÇÃO DE ARREPENDIMENTO:
- ARREPENDIMENTO VERDADEIRO (true_repentance): Reconhece que ofendeu a Deus, não apenas consequências.
  Indicadores: "pequei contra Deus", "desobedeci a Palavra", "me arrependi diante do Senhor", reconhecimento de pecado como ofensa a Deus
- REMORSO (remorse): Foco nas consequências pessoais, dor própria, medo do castigo.
  Indicadores: "me arrependo do que sofri", "foi muito difícil para mim", "não quero sofrer de novo"
- INCERTO (unclear): Quando não há evidência clara para classificar

REGRAS IMPORTANTES:
1. Se não identificar claramente, use confidence baixa e classifique como "unclear"
2. Cite evidências diretas do texto para justificar a classificação
3. ANONIMIZE todos os nomes de terceiros com [PESSOA_1], [PESSOA_2], etc
4. Mantenha nome do testemunhante se mencionado
5. Sinalize conteúdo potencialmente problemático (heresia, violência extrema, conteúdo sexual explícito)
6. Para tags, use formato #PascalCase sem acentos (ex: #Alcool, #Familia, #Reconciliacao)
7. Identifique padrões de transformação genuínos (oração, comunidade, terapia, jejum, confissão, etc)`;

const TRANSCRIPTION_SYSTEM_PROMPT = `Você é um transcritor de áudio especializado em português brasileiro.
Transcreva o áudio fielmente, seguindo estas regras:
- Mantenha pausas longas como "..."
- Indique expressões emocionais entre colchetes: [choro], [riso], [pausa longa], [suspiro]
- Preserve gírias e expressões regionais
- Não adicione comentários próprios
- Não corrija gramática ou pronúncia
- Mantenha repetições e hesitações naturais da fala`;

// Testimony type definition
interface Testimony {
  id: string;
  user_id: string;
  application_id: string | null;
  audio_url: string;
  duration_seconds: number;
  file_size_bytes: number | null;
  mime_type: string | null;
  status: string;
  transcript: string | null;
  analysis: Record<string, unknown> | null;
  curator_notes: string | null;
  curated_by: string | null;
  curated_at: string | null;
  created_at: string;
  updated_at: string;
}

interface PushSubscription {
  endpoint: string;
  p256dh: string;
  auth: string;
}

// Generate simple hash-based embedding (1536 dimensions, compatible with existing chunks)
async function generateSimpleEmbedding(text: string): Promise<number[]> {
  const embedding: number[] = [];
  const encoder = new TextEncoder();

  // Generate multiple hashes to create 1536-dimensional vector
  for (let i = 0; i < 48; i++) {
    const data = encoder.encode(text + i.toString());
    const hashBuffer = await crypto.subtle.digest("SHA-256", data);
    const hashArray = new Float32Array(hashBuffer);

    for (let j = 0; j < 32 && embedding.length < 1536; j++) {
      // Normalize to [-1, 1]
      const val = (hashArray[j % hashArray.length] || 0) / 2147483647;
      embedding.push(Math.max(-1, Math.min(1, val)));
    }
  }

  // Normalize the vector
  const magnitude = Math.sqrt(embedding.reduce((sum, v) => sum + v * v, 0));
  return embedding.map((v) => v / (magnitude || 1));
}

// Convert blob to base64
async function blobToBase64(blob: Blob): Promise<string> {
  const arrayBuffer = await blob.arrayBuffer();
  const uint8Array = new Uint8Array(arrayBuffer);
  let binary = "";
  for (let i = 0; i < uint8Array.length; i++) {
    binary += String.fromCharCode(uint8Array[i]);
  }
  return btoa(binary);
}

// Extract storage path from URL
function extractStoragePath(audioUrl: string): string {
  // URL format: https://<project>.supabase.co/storage/v1/object/public/testimonies/<path>
  // Or signed URL format
  const match = audioUrl.match(/testimonies\/(.+?)(?:\?|$)/);
  if (match) {
    return decodeURIComponent(match[1]);
  }
  // Fallback: assume it's just the path
  return audioUrl.replace(/^.*testimonies\//, "");
}

// Send push notification to a user
async function sendPushToUser(
  supabaseUrl: string,
  supabaseKey: string,
  userId: string,
  payload: { title: string; body: string; data?: Record<string, string> }
): Promise<void> {
  const vapidPublicKey = Deno.env.get("VAPID_PUBLIC_KEY");
  const vapidPrivateKey = Deno.env.get("VAPID_PRIVATE_KEY");

  if (!vapidPublicKey || !vapidPrivateKey) {
    console.log("VAPID keys not configured, skipping push notification");
    return;
  }

  webpush.setVapidDetails(
    "mailto:contato@zion.app",
    vapidPublicKey,
    vapidPrivateKey
  );

  const supabase = createClient(supabaseUrl, supabaseKey);

  const { data: subscriptions, error } = await supabase
    .from("push_subscriptions")
    .select("endpoint, p256dh, auth")
    .eq("user_id", userId)
    .eq("is_active", true);

  if (error || !subscriptions || subscriptions.length === 0) {
    console.log(`No active subscriptions for user ${userId}`);
    return;
  }

  const typedSubscriptions = subscriptions as PushSubscription[];

  const notificationPayload = JSON.stringify({
    title: payload.title,
    body: payload.body,
    icon: "/icons/icon-192.png",
    badge: "/icons/badge-72.png",
    data: payload.data || {},
  });

  for (const sub of typedSubscriptions) {
    try {
      await webpush.sendNotification(
        {
          endpoint: sub.endpoint,
          keys: { p256dh: sub.p256dh, auth: sub.auth },
        },
        notificationPayload
      );
      console.log(`Push notification sent to user ${userId}`);
    } catch (err) {
      console.error(`Failed to send push to ${userId}:`, err);
      // Deactivate invalid subscriptions
      const statusCode = (err as { statusCode?: number })?.statusCode;
      if (statusCode === 410 || statusCode === 404) {
        await supabase
          .from("push_subscriptions")
          .update({ is_active: false, updated_at: new Date().toISOString() })
          .eq("endpoint", sub.endpoint);
      }
    }
  }
}

// Main processing function
async function processTestimony(
  supabaseUrl: string,
  supabaseKey: string,
  testimonyId: string,
  skipTranscription: boolean = false
): Promise<{ success: boolean; error?: string }> {
  const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");

  if (!LOVABLE_API_KEY) {
    return { success: false, error: "LOVABLE_API_KEY not configured" };
  }

  const supabase = createClient(supabaseUrl, supabaseKey);

  console.log(`Processing testimony ${testimonyId}`);

  // Fetch testimony record
  const { data, error: fetchError } = await supabase
    .from("testimonies")
    .select("*")
    .eq("id", testimonyId)
    .single();

  if (fetchError || !data) {
    return { success: false, error: `Testimony not found: ${fetchError?.message}` };
  }

  const testimony = data as Testimony;

  console.log(`Testimony found: user=${testimony.user_id}, status=${testimony.status}`);

  let transcript = testimony.transcript;

  // STEP 1: Transcription (if not skipping and no transcript exists)
  if (!skipTranscription && !transcript) {
    console.log("Starting transcription...");

    try {
      // Extract storage path and download audio
      const audioPath = extractStoragePath(testimony.audio_url);
      console.log(`Downloading audio from path: ${audioPath}`);

      const { data: audioBlob, error: downloadError } = await supabase.storage
        .from("testimonies")
        .download(audioPath);

      if (downloadError || !audioBlob) {
        console.error("Audio download failed:", downloadError);
        return { success: false, error: `Failed to download audio: ${downloadError?.message}` };
      }

      console.log(`Audio downloaded: ${audioBlob.size} bytes, type: ${audioBlob.type}`);

      // Convert to base64
      const audioBase64 = await blobToBase64(audioBlob);
      console.log(`Audio converted to base64: ${audioBase64.length} chars`);

      // Call Lovable AI for transcription using Gemini multimodal
      const transcriptionResponse = await fetch(
        "https://ai.gateway.lovable.dev/v1/chat/completions",
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${LOVABLE_API_KEY}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            model: "google/gemini-2.5-flash",
            messages: [
              { role: "system", content: TRANSCRIPTION_SYSTEM_PROMPT },
              {
                role: "user",
                content: [
                  { type: "text", text: "Transcreva este áudio de testemunho:" },
                  {
                    type: "input_audio",
                    input_audio: {
                      data: audioBase64,
                      format: testimony.mime_type?.includes("webm") ? "webm" : "mp3",
                    },
                  },
                ],
              },
            ],
            max_tokens: 16000,
          }),
        }
      );

      if (!transcriptionResponse.ok) {
        const errorText = await transcriptionResponse.text();
        console.error("Transcription API error:", transcriptionResponse.status, errorText);
        
        // If audio transcription not supported, set a placeholder
        if (transcriptionResponse.status === 400 || transcriptionResponse.status === 422) {
          console.log("Audio transcription not supported, setting placeholder for manual entry");
          transcript = "[TRANSCRIÇÃO PENDENTE - Áudio requer transcrição manual]";
        } else {
          return { success: false, error: `Transcription failed: ${transcriptionResponse.status}` };
        }
      } else {
        const transcriptionData = await transcriptionResponse.json();
        transcript = transcriptionData.choices?.[0]?.message?.content || "";
        console.log(`Transcription complete: ${(transcript || "").length} chars`);
      }
    } catch (err) {
      console.error("Transcription error:", err);
      // Don't fail completely, allow analysis with placeholder
      transcript = "[ERRO NA TRANSCRIÇÃO - Requer transcrição manual]";
    }
  }

  // STEP 2: Theological Analysis
  console.log("Starting theological analysis...");

  let analysisData: Record<string, unknown> = {};

  try {
    const analysisResponse = await fetch(
      "https://ai.gateway.lovable.dev/v1/chat/completions",
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${LOVABLE_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: "google/gemini-3-flash-preview",
          messages: [
            { role: "system", content: ANALYSIS_SYSTEM_PROMPT },
            { role: "user", content: `Analise este testemunho e extraia as informações estruturadas:\n\n${transcript}` },
          ],
          tools: [ANALYSIS_EXTRACTION_TOOL],
          tool_choice: { type: "function", function: { name: "extract_testimony_analysis" } },
        }),
      }
    );

    if (!analysisResponse.ok) {
      const errorText = await analysisResponse.text();
      console.error("Analysis API error:", analysisResponse.status, errorText);
      
      // Set minimal analysis on failure
      analysisData = {
        repentance_classification: "unclear",
        repentance_confidence: 0,
        scenario: "FAMILIA",
        center: "EMOCIONAL",
        security_matrix: "IDENTIDADE",
        safe_for_publication: false,
        curator_required_reason: "Falha na análise automática - requer revisão manual",
        processing_error: errorText,
      };
    } else {
      const analysisResult = await analysisResponse.json();
      console.log("Analysis response received");

      // Extract tool call result
      const toolCall = analysisResult.choices?.[0]?.message?.tool_calls?.[0];
      if (toolCall && toolCall.function?.arguments) {
        try {
          analysisData = JSON.parse(toolCall.function.arguments);
          console.log("Analysis extracted successfully");
        } catch (parseErr) {
          console.error("Failed to parse analysis:", parseErr);
          analysisData = {
            repentance_classification: "unclear",
            repentance_confidence: 0,
            safe_for_publication: false,
            curator_required_reason: "Erro ao processar análise",
            raw_response: toolCall.function.arguments,
          };
        }
      } else {
        // Fallback: try to extract from content
        const content = analysisResult.choices?.[0]?.message?.content;
        if (content) {
          try {
            analysisData = JSON.parse(content);
          } catch {
            analysisData = {
              repentance_classification: "unclear",
              repentance_confidence: 0,
              safe_for_publication: false,
              curator_required_reason: "Resposta não estruturada",
              raw_content: content,
            };
          }
        }
      }
    }
  } catch (err) {
    console.error("Analysis error:", err);
    analysisData = {
      repentance_classification: "unclear",
      repentance_confidence: 0,
      safe_for_publication: false,
      curator_required_reason: "Erro interno na análise",
      error: String(err),
    };
  }

  // STEP 3: Generate embedding
  console.log("Generating embedding...");

  const textForEmbedding = (analysisData.anonymized_transcript as string) || transcript || "";
  const embedding = await generateSimpleEmbedding(textForEmbedding);
  console.log(`Embedding generated: ${embedding.length} dimensions`);

  // STEP 4: Update testimony record
  console.log("Updating testimony record...");

  const finalTranscript = (analysisData.anonymized_transcript as string) || transcript;

  const { error: updateError } = await supabase
    .from("testimonies")
    .update({
      transcript: finalTranscript,
      analysis: analysisData,
      embedding: embedding,
      status: "analyzed",
      updated_at: new Date().toISOString(),
    })
    .eq("id", testimonyId);

  if (updateError) {
    console.error("Failed to update testimony:", updateError);
    return { success: false, error: `Failed to update testimony: ${updateError.message}` };
  }

  console.log("Testimony updated successfully");

  // STEP 5: Send notifications
  console.log("Sending notifications...");

  try {
    await sendPushToUser(supabaseUrl, supabaseKey, testimony.user_id, {
      title: "Testemunho Analisado ✅",
      body: "Seu testemunho foi processado e está aguardando revisão.",
      data: { url: "/profile" },
    });
  } catch (notifErr) {
    console.error("Notification error:", notifErr);
    // Don't fail the whole process for notification errors
  }

  return { success: true };
}

Deno.serve(async (req) => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  console.log("Process testimony function called");

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const body = await req.json();
    const { testimony_id, skip_transcription = false, batch = false } = body;

    // Batch mode: process all pending testimonies
    if (batch) {
      console.log("Batch mode: processing all pending testimonies");

      const { data: pendingTestimonies, error: fetchError } = await supabase
        .from("testimonies")
        .select("id")
        .eq("status", "processing")
        .limit(10); // Process max 10 at a time to avoid timeouts

      if (fetchError) {
        return new Response(
          JSON.stringify({ error: fetchError.message }),
          {
            status: 500,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          }
        );
      }

      if (!pendingTestimonies || pendingTestimonies.length === 0) {
        return new Response(
          JSON.stringify({ message: "No pending testimonies to process", processed: 0 }),
          {
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          }
        );
      }

      const results = {
        processed: 0,
        failed: 0,
        errors: [] as string[],
      };

      for (const t of pendingTestimonies) {
        const result = await processTestimony(supabaseUrl, supabaseKey, t.id, skip_transcription);
        if (result.success) {
          results.processed++;
        } else {
          results.failed++;
          results.errors.push(`${t.id}: ${result.error}`);
        }
      }

      console.log("Batch processing complete:", results);

      return new Response(JSON.stringify(results), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Single testimony mode
    if (!testimony_id) {
      return new Response(
        JSON.stringify({ error: "testimony_id is required" }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    const result = await processTestimony(supabaseUrl, supabaseKey, testimony_id, skip_transcription);

    if (!result.success) {
      return new Response(
        JSON.stringify({ error: result.error }),
        {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    return new Response(
      JSON.stringify({ success: true, message: "Testimony processed successfully" }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (error) {
    console.error("Error in process-testimony:", error);
    return new Response(
      JSON.stringify({
        error: error instanceof Error ? error.message : "Unknown error",
      }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
