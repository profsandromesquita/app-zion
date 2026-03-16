

# Plano: Reprocessar Embeddings (Fase 7 - Bloco 2)

## Abordagem

Opção A: Adicionar action `reprocess_all_embeddings` ao `ingest-document` + botão no admin Documents.

## Alterações

### 1. `supabase/functions/ingest-document/index.ts`

Adicionar novo branch no handler para `action === "reprocess_all_embeddings"`:

- Aceita chamada sem `doc_id`/`version_id` (tornar opcionais quando action é reprocess)
- Busca todos os chunks com `embedding_model_id = 'simple-hash-v1'` e `embedding_status = 'ok'`
- Processa em batches de 10 com delay de 1s entre batches (rate limiting)
- Para cada chunk: gera embedding via `generateSemanticEmbedding`, atualiza `embedding` + `embedding_model_id`, mantém todos outros campos intactos
- Se falhar: marca `embedding_status = 'failed'`, continua
- Log de progresso a cada batch
- Ao final, registra em `observability_logs` com `event_type = 'rag_retrieval'`
- Retorna JSON com `{ total, success, failed, skipped }`

Ajuste na validação: `doc_id`/`version_id` só são obrigatórios se action não for `reprocess_all_embeddings`.

### 2. `src/pages/admin/Documents.tsx`

Adicionar botão "Reprocessar Todos os Embeddings" na área de ações:
- Chama `supabase.functions.invoke("ingest-document", { body: { action: "reprocess_all_embeddings" } })`
- Mostra progresso via toast
- Exibe resultado final (success/failed counts)

### 3. Validação pós-reprocessamento

Após implementar, invocar manualmente para reprocessar os 308 chunks. Verificar via query que `embedding_model_id` mudou de `simple-hash-v1` para `text-embedding-3-small`.

## Detalhes técnicos

```text
Request flow:
  Admin UI → "Reprocessar Embeddings" button
    → POST ingest-document { action: "reprocess_all_embeddings" }
      → SELECT chunks WHERE embedding_model_id = 'simple-hash-v1'
      → FOR EACH batch of 10:
          → generateSemanticEmbedding(chunk.text)
          → UPDATE chunks SET embedding, embedding_model_id
          → sleep(1000ms)
      → INSERT observability_logs { event_type: 'rag_retrieval', ... }
      → RETURN { total, success, failed }
```

**Edge function timeout**: Deno edge functions have a ~60s timeout. With 308 chunks in batches of 10 (~31 batches, ~1s delay each + API time), this may exceed the limit. Solution: process up to 50 chunks per invocation, return `{ continued: true, remaining: N }`, and have the admin UI call repeatedly until done.

