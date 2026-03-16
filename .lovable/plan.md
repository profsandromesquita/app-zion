

# Plano: Migração de Embedding Hash para Semântico (Fase 7 - Bloco 1)

## Resumo

Substituir `generateSimpleEmbedding` (SHA-256 hash) por `generateSemanticEmbedding` (OpenAI `text-embedding-3-small`) em 3 edge functions, com fallback automático para hash em caso de falha da API.

## Alterações por Arquivo

### 1. `supabase/functions/ingest-document/index.ts`

- **Adicionar** função `generateSemanticEmbedding(text)`:
  - Chama `POST https://api.openai.com/v1/embeddings` com `model: "text-embedding-3-small"`
  - Usa `Deno.env.get("OPENAI_API_KEY")`
  - Em caso de erro, loga warning e faz fallback para `generateSimpleEmbedding`
  - Retorna `{ embedding: number[], model: string }` (para saber qual modelo foi usado)
- **Linha 393**: Substituir `generateSimpleEmbedding(chunk.text)` por `generateSemanticEmbedding(chunk.text)`
- **Linha 399**: Alterar `embedding_model_id` de `"simple-hash-v1"` para o modelo retornado (será `"text-embedding-3-small"` ou `"simple-hash-v1"` no fallback)
- **Manter** `generateSimpleEmbedding` intacta como fallback

### 2. `supabase/functions/search-chunks/index.ts`

- **Adicionar** função `generateSemanticEmbedding(text)` (mesma lógica: OpenAI API + fallback hash)
- **Linha 42**: Substituir `generateSimpleEmbedding(query)` por `generateSemanticEmbedding(query)`
- Adicionar log de qual embedding foi usado
- Incluir `embedding_type` na resposta JSON
- **Manter** `generateSimpleEmbedding` como fallback

### 3. `supabase/functions/zyon-chat/index.ts`

- **Adicionar** função `generateSemanticEmbedding(text)` (mesma lógica)
- **Linha 2522**: Proteger com feature flag `io_rag_domains_enabled`:
  - Flag ON: usar `generateSemanticEmbedding`, `CURRENT_EMBEDDING_TYPE = 'semantic-real'`
  - Flag OFF: manter `generateSimpleEmbedding`, `CURRENT_EMBEDDING_TYPE = 'simple-hash-v1'`
- A decisão de qual embedding usar é feita em runtime, não no nível da constante
- **Manter** `generateSimpleEmbedding` intacta

## Estrutura da Função `generateSemanticEmbedding`

```typescript
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
    if (!res.ok) throw new Error(`OpenAI API error: ${res.status}`);
    const data = await res.json();
    console.log("[Embedding] Semantic embedding generated successfully");
    return { embedding: data.data[0].embedding, model: "text-embedding-3-small" };
  } catch (err) {
    console.error("[Embedding] OpenAI API failed, falling back to hash:", err);
    return { embedding: await generateSimpleEmbedding(text), model: "simple-hash-v1" };
  }
}
```

## O que NÃO muda

- Schema da tabela `chunks` (vector(1536) compatível)
- Função RPC `search_chunks`
- Pipeline de chat, montagem de prompt, validator
- Lógica de crise, intent router, guardrails
- Feature flags existentes (valores permanecem `false`)

## Nota sobre Compatibilidade

Chunks antigos (hash) e novos (semântico) coexistirão na tabela. A busca semântica só retornará resultados de alta qualidade quando os chunks forem reprocessados (Bloco 2). Enquanto isso, o fallback de threshold baixo do `search_chunks` RPC garante continuidade.

