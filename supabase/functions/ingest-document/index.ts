import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.89.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Vocabulário ZION para tagging automático
const ZION_VOCABULARY: Record<string, string[]> = {
  seguranca: ["segurança", "proteção", "medo", "ansiedade", "confiança", "fé"],
  medo_raiz: ["rejeição", "abandono", "fracasso", "insignificância", "vulnerabilidade"],
  idolatria: ["idolatria", "ídolo", "falso deus", "dependência", "apego"],
  metanoia: ["arrependimento", "transformação", "conversão", "mudança", "renovação"],
  identidade: ["identidade", "quem sou", "filho de deus", "amado", "escolhido"],
  virtude: ["virtude", "caráter", "fruto do espírito", "amor", "paciência", "bondade"],
  eneagrama: ["eneagrama", "tipo", "personalidade", "centro", "asa", "integração"],
  tres_centros: ["instintivo", "emocional", "mental", "corpo", "coração", "mente"],
  ciclos: ["ciclo", "padrão", "repetição", "libertação", "cura"],
  exegese: ["exegese", "hermenêutica", "interpretação", "contexto", "bíblia"],
};

// Normalização do texto
function normalizeText(rawText: string): string {
  let text = rawText;
  
  // Remover caracteres de controle (exceto newlines e tabs)
  text = text.replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, "");
  
  // Padronizar quebras de linha
  text = text.replace(/\r\n/g, "\n").replace(/\r/g, "\n");
  
  // Remover múltiplas quebras de linha consecutivas (mais de 2)
  text = text.replace(/\n{3,}/g, "\n\n");
  
  // Padronizar bullets
  text = text.replace(/^[\s]*[•●○◦▪▫]/gm, "- ");
  
  // Remover numeração repetida no começo de linhas (1. 2. 3. etc)
  text = text.replace(/^(\d+\.\s*){2,}/gm, "");
  
  // Trim linhas
  text = text.split("\n").map(line => line.trimEnd()).join("\n");
  
  // Trim geral
  text = text.trim();
  
  return text;
}

// Detecção de seções por headings
interface Section {
  level: number;
  title: string;
  content: string;
  startPos: number;
  endPos: number;
}

function extractSections(text: string): Section[] {
  const lines = text.split("\n");
  const sections: Section[] = [];
  let currentSection: Section | null = null;
  let currentContent: string[] = [];
  let charPos = 0;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const headingMatch = line.match(/^(#{1,6})\s+(.+)$/);
    
    if (headingMatch) {
      // Salvar seção anterior
      if (currentSection) {
        currentSection.content = currentContent.join("\n").trim();
        currentSection.endPos = charPos - 1;
        sections.push(currentSection);
      }
      
      // Nova seção
      currentSection = {
        level: headingMatch[1].length,
        title: headingMatch[2].trim(),
        content: "",
        startPos: charPos,
        endPos: charPos,
      };
      currentContent = [];
    } else {
      currentContent.push(line);
    }
    
    charPos += line.length + 1; // +1 for newline
  }
  
  // Última seção
  if (currentSection) {
    currentSection.content = currentContent.join("\n").trim();
    currentSection.endPos = charPos;
    sections.push(currentSection);
  }
  
  // Se não houver seções com headings, tratar todo o texto como uma seção
  if (sections.length === 0) {
    sections.push({
      level: 1,
      title: "Conteúdo",
      content: text,
      startPos: 0,
      endPos: text.length,
    });
  }
  
  return sections;
}

// Chunking semântico
interface Chunk {
  text: string;
  sectionPath: string[];
  position: number;
  charStart: number;
  charEnd: number;
}

function chunkText(text: string, targetChars = 2500, overlapChars = 400): Chunk[] {
  const sections = extractSections(text);
  const chunks: Chunk[] = [];
  let position = 0;
  
  // Track section hierarchy
  const currentPath: string[] = [];
  
  for (const section of sections) {
    // Update path based on level
    while (currentPath.length >= section.level) {
      currentPath.pop();
    }
    currentPath.push(section.title);
    
    const sectionPath = [...currentPath];
    const sectionContent = section.content;
    
    // Se a seção é pequena o suficiente, usar como chunk único
    if (sectionContent.length <= targetChars) {
      if (sectionContent.trim().length > 50) { // Ignorar seções muito pequenas
        chunks.push({
          text: sectionContent.trim(),
          sectionPath,
          position,
          charStart: section.startPos,
          charEnd: section.endPos,
        });
        position++;
      }
      continue;
    }
    
    // Dividir seção grande em chunks com overlap
    const paragraphs = sectionContent.split(/\n\n+/);
    let currentChunk = "";
    let chunkStart = section.startPos;
    
    for (let i = 0; i < paragraphs.length; i++) {
      const para = paragraphs[i].trim();
      if (!para) continue;
      
      if (currentChunk.length + para.length + 2 <= targetChars) {
        currentChunk += (currentChunk ? "\n\n" : "") + para;
      } else {
        // Salvar chunk atual
        if (currentChunk.trim().length > 50) {
          chunks.push({
            text: currentChunk.trim(),
            sectionPath,
            position,
            charStart: chunkStart,
            charEnd: chunkStart + currentChunk.length,
          });
          position++;
        }
        
        // Começar novo chunk com overlap
        const lastPart = currentChunk.slice(-overlapChars);
        const overlapStart = lastPart.indexOf("\n");
        const overlap = overlapStart > 0 ? lastPart.slice(overlapStart + 1) : lastPart;
        
        chunkStart = section.startPos + sectionContent.indexOf(para);
        currentChunk = overlap + (overlap ? "\n\n" : "") + para;
      }
    }
    
    // Último chunk da seção
    if (currentChunk.trim().length > 50) {
      chunks.push({
        text: currentChunk.trim(),
        sectionPath,
        position,
        charStart: chunkStart,
        charEnd: section.endPos,
      });
      position++;
    }
  }
  
  return chunks;
}

// Tagging automático
function generateTags(text: string): Record<string, { matched: string[]; confidence: number }> {
  const tags: Record<string, { matched: string[]; confidence: number }> = {};
  const lowerText = text.toLowerCase();
  
  for (const [category, keywords] of Object.entries(ZION_VOCABULARY)) {
    const matched: string[] = [];
    
    for (const keyword of keywords) {
      if (lowerText.includes(keyword.toLowerCase())) {
        matched.push(keyword);
      }
    }
    
    if (matched.length > 0) {
      const confidence = Math.min(matched.length / keywords.length + 0.3, 1);
      tags[category] = { matched, confidence };
    }
  }
  
  return tags;
}

// Calcular prioridade baseada na layer
function getDefaultPriority(layer: string): number {
  switch (layer) {
    case "CONSTITUICAO":
      return 100;
    case "NUCLEO":
      return 80;
    case "BIBLIOTECA":
      return 50;
    default:
      return 50;
  }
}

// Verificar se layer é retrievable por padrão
function isRetrievableByDefault(layer: string): boolean {
  return layer !== "CONSTITUICAO";
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { doc_id, version_id, action } = await req.json();

    // ===== REPROCESS ALL EMBEDDINGS (batch action) =====
    if (action === "reprocess_all_embeddings") {
      console.log("[Reprocess] Starting batch reprocessing of hash embeddings...");
      
      const supabaseUrl = Deno.env.get("SUPABASE_URL");
      const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
      if (!supabaseUrl || !supabaseServiceKey) {
        throw new Error("Supabase credentials not configured");
      }
      const supabase = createClient(supabaseUrl, supabaseServiceKey);

      // Fetch chunks still on hash embedding (limit 50 per invocation to avoid timeout)
      const { data: hashChunks, error: fetchErr } = await supabase
        .from("chunks")
        .select("id, text")
        .eq("embedding_model_id", "simple-hash-v1")
        .eq("embedding_status", "ok")
        .limit(50);

      if (fetchErr) throw new Error(`Failed to fetch chunks: ${fetchErr.message}`);

      const total = hashChunks?.length || 0;
      if (total === 0) {
        console.log("[Reprocess] No chunks with simple-hash-v1 found.");
        return new Response(
          JSON.stringify({ success: true, total: 0, success_count: 0, failed: 0, remaining: 0 }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      console.log(`[Reprocess] Found ${total} chunks to reprocess in this batch`);

      let successCount = 0;
      let failedCount = 0;
      const batchSize = 10;

      for (let i = 0; i < total; i += batchSize) {
        const batch = hashChunks!.slice(i, i + batchSize);
        
        for (const chunk of batch) {
          try {
            const { embedding, model: embeddingModel } = await generateSemanticEmbedding(chunk.text);
            
            // Only update if we got a real semantic embedding
            if (embeddingModel === "simple-hash-v1") {
              console.warn(`[Reprocess] Chunk ${chunk.id}: fallback to hash (API issue), skipping update`);
              failedCount++;
              continue;
            }

            const { error: updateErr } = await supabase
              .from("chunks")
              .update({
                embedding,
                embedding_model_id: embeddingModel,
                embedding_status: "ok",
              })
              .eq("id", chunk.id);

            if (updateErr) {
              console.error(`[Reprocess] Update failed for chunk ${chunk.id}:`, updateErr.message);
              failedCount++;
            } else {
              successCount++;
            }
          } catch (err) {
            console.error(`[Reprocess] Error processing chunk ${chunk.id}:`, err);
            await supabase
              .from("chunks")
              .update({ embedding_status: "failed" })
              .eq("id", chunk.id);
            failedCount++;
          }
        }

        // Rate limiting delay between batches
        if (i + batchSize < total) {
          await new Promise(resolve => setTimeout(resolve, 1000));
        }
        console.log(`[Reprocess] Progress: ${Math.min(i + batchSize, total)}/${total}`);
      }

      // Check if more remain
      const { count: remainingCount } = await supabase
        .from("chunks")
        .select("id", { count: "exact", head: true })
        .eq("embedding_model_id", "simple-hash-v1")
        .eq("embedding_status", "ok");

      const remaining = remainingCount || 0;

      // Log to observability
      await supabase.from("observability_logs").insert({
        event_type: "rag_retrieval",
        event_data: {
          action: "reprocess_embeddings",
          batch_total: total,
          success: successCount,
          failed: failedCount,
          remaining,
        },
        flags_active: {},
      });

      console.log(`[Reprocess] Batch complete: ${successCount} success, ${failedCount} failed, ${remaining} remaining`);

      return new Response(
        JSON.stringify({
          success: true,
          total,
          success_count: successCount,
          failed: failedCount,
          remaining,
          continued: remaining > 0,
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }
    // ===== END REPROCESS =====
    
    if (!doc_id || !version_id) {
      return new Response(
        JSON.stringify({ error: "doc_id and version_id are required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log(`Processing document ${doc_id}, version ${version_id}, action: ${action}`);

    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    
    if (!supabaseUrl || !supabaseServiceKey) {
      throw new Error("Supabase credentials not configured");
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Buscar documento e versão
    const { data: document, error: docError } = await supabase
      .from("documents")
      .select("*")
      .eq("id", doc_id)
      .single();

    if (docError || !document) {
      throw new Error(`Document not found: ${docError?.message}`);
    }

    const { data: version, error: verError } = await supabase
      .from("document_versions")
      .select("*")
      .eq("id", version_id)
      .single();

    if (verError || !version) {
      throw new Error(`Version not found: ${verError?.message}`);
    }

    console.log(`Document: ${document.title}, Layer: ${document.layer}`);

    // PASSO 1: Normalização
    const rawText = version.raw_text || "";
    const normalizedText = normalizeText(rawText);
    
    console.log(`Normalized text: ${normalizedText.length} chars`);

    // Atualizar versão com texto normalizado
    const { error: updateVerError } = await supabase
      .from("document_versions")
      .update({ 
        normalized_text: normalizedText,
        content_hash: await computeHash(normalizedText),
      })
      .eq("id", version_id);

    if (updateVerError) {
      throw new Error(`Failed to update version: ${updateVerError.message}`);
    }

    // PASSO 2: Chunking
    const chunks = chunkText(normalizedText);
    console.log(`Generated ${chunks.length} chunks`);

    // PASSO 3: Deletar chunks antigos desta versão
    await supabase
      .from("chunks")
      .delete()
      .eq("version_id", version_id);

    // PASSO 4: Inserir novos chunks
    const chunkRecords = chunks.map((chunk) => ({
      doc_id,
      version_id,
      version: version.version,
      layer: document.layer,
      domain: document.domain,
      language: document.language,
      priority: getDefaultPriority(document.layer),
      retrievable: isRetrievableByDefault(document.layer),
      section_path: chunk.sectionPath,
      position: chunk.position,
      text: chunk.text,
      char_start: chunk.charStart,
      char_end: chunk.charEnd,
      tags_json: generateTags(chunk.text),
      embedding_status: "pending",
    }));

    const { error: insertError } = await supabase
      .from("chunks")
      .insert(chunkRecords);

    if (insertError) {
      throw new Error(`Failed to insert chunks: ${insertError.message}`);
    }

    // PASSO 5: Gerar embeddings (se action === "generate_embeddings")
    if (action === "generate_embeddings") {
      console.log("Generating embeddings...");
      
      const { data: pendingChunks, error: fetchChunksError } = await supabase
        .from("chunks")
        .select("id, text")
        .eq("version_id", version_id)
        .eq("embedding_status", "pending");

      if (fetchChunksError) {
        throw new Error(`Failed to fetch chunks for embedding: ${fetchChunksError.message}`);
      }

      const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
      if (!LOVABLE_API_KEY) {
        console.warn("LOVABLE_API_KEY not configured, skipping embeddings");
      } else {
        // Processar embeddings em lotes
        const batchSize = 10;
        let successCount = 0;
        let errorCount = 0;

        for (let i = 0; i < pendingChunks.length; i += batchSize) {
          const batch = pendingChunks.slice(i, i + batchSize);
          
          for (const chunk of batch) {
            try {
              // Marcar como processando
              await supabase
                .from("chunks")
                .update({ embedding_status: "processing" })
                .eq("id", chunk.id);

              // Gerar embedding semântico (com fallback para hash)
              const { embedding, model: embeddingModel } = await generateSemanticEmbedding(chunk.text);

              await supabase
                .from("chunks")
                .update({ 
                  embedding,
                  embedding_model_id: embeddingModel,
                  embedding_status: "ok"
                })
                .eq("id", chunk.id);

              successCount++;
            } catch (embErr) {
              console.error(`Embedding error for chunk ${chunk.id}:`, embErr);
              await supabase
                .from("chunks")
                .update({ embedding_status: "failed" })
                .eq("id", chunk.id);
              errorCount++;
            }
          }
        }

        console.log(`Embeddings: ${successCount} success, ${errorCount} failed`);
      }
    }

    // Atualizar status da versão e documento para PUBLISHED após sucesso
    // Isso garante que os chunks sejam recuperáveis via search_chunks
    const newStatus = action === "generate_embeddings" ? "published" : version.status;
    
    await supabase
      .from("document_versions")
      .update({ status: newStatus })
      .eq("id", version_id);

    // Auto-publicar documento após processamento bem-sucedido
    if (action === "generate_embeddings") {
      await supabase
        .from("documents")
        .update({ status: "published", updated_at: new Date().toISOString() })
        .eq("id", doc_id);
      
      console.log("Document auto-published after successful embedding generation");
    }

    return new Response(
      JSON.stringify({ 
        success: true,
        chunks_created: chunks.length,
        message: `Processed ${chunks.length} chunks`,
        auto_published: action === "generate_embeddings",
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error) {
    console.error("Ingest error:", error);
    return new Response(
      JSON.stringify({ 
        error: error instanceof Error ? error.message : "Unknown error"
      }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});

// Helper: Compute hash
async function computeHash(text: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(text);
  const hashBuffer = await crypto.subtle.digest("SHA-256", data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, "0")).join("");
}

// Helper: Gerar embedding semântico via OpenAI (com fallback para hash)
async function generateSemanticEmbedding(text: string): Promise<{ embedding: number[], model: string }> {
  const apiKey = Deno.env.get("OPENAI_API_KEY");
  if (!apiKey) {
    console.warn("[Embedding] OPENAI_API_KEY not found, falling back to hash");
    return { embedding: await generateSimpleEmbedding(text), model: "simple-hash-v1" };
  }
  try {
    const res = await fetch("https://api.openai.com/v1/embeddings", {
      method: "POST",
      headers: { "Authorization": `Bearer ${apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({ model: "text-embedding-3-small", input: text }),
    });
    if (!res.ok) {
      const errBody = await res.text();
      throw new Error(`OpenAI API error ${res.status}: ${errBody}`);
    }
    const data = await res.json();
    console.log("[Embedding] Semantic embedding generated (text-embedding-3-small)");
    return { embedding: data.data[0].embedding, model: "text-embedding-3-small" };
  } catch (err) {
    console.error("[Embedding] OpenAI API failed, falling back to hash:", err);
    return { embedding: await generateSimpleEmbedding(text), model: "simple-hash-v1" };
  }
}

// Helper: Gerar embedding simples baseado em hash (FALLBACK)
async function generateSimpleEmbedding(text: string): Promise<number[]> {
  const embedding: number[] = [];
  const encoder = new TextEncoder();
  
  // Gerar múltiplos hashes para criar vetor de 1536 dimensões
  for (let i = 0; i < 48; i++) {
    const data = encoder.encode(text + i.toString());
    const hashBuffer = await crypto.subtle.digest("SHA-256", data);
    const hashArray = new Float32Array(hashBuffer);
    
    for (let j = 0; j < 32 && embedding.length < 1536; j++) {
      // Normalizar para [-1, 1]
      const val = (hashArray[j % hashArray.length] || 0) / 2147483647;
      embedding.push(Math.max(-1, Math.min(1, val)));
    }
  }
  
  // Normalizar o vetor
  const magnitude = Math.sqrt(embedding.reduce((sum, v) => sum + v * v, 0));
  return embedding.map(v => v / (magnitude || 1));
}
