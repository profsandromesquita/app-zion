

# Fix: Botão "Reprocessar Embeddings" na página DocumentChunks

## Problema
O handler `reprocessEmbeddings` usa a action antiga `generate_embeddings` em vez da nova `reprocess_all_embeddings`. Ele também não tem loop para processar batches nem loading state.

## Correção em `src/pages/admin/DocumentChunks.tsx`

1. **Adicionar estado `reprocessing`** (`useState<boolean>(false)`) para loading state do botão.

2. **Reescrever `reprocessEmbeddings`** para:
   - Setar `reprocessing = true`
   - Chamar `supabase.functions.invoke("ingest-document", { body: { action: "reprocess_all_embeddings" } })` em loop
   - A cada iteração, mostrar toast de progresso com counts parciais
   - Continuar enquanto `data.continued === true`
   - Ao final, mostrar toast com resultado total (success/failed)
   - Setar `reprocessing = false` e chamar `fetchData()`

3. **Atualizar o botão** para usar `disabled={reprocessing}` e mostrar spinner durante processamento.

## Arquivo alterado
- `src/pages/admin/DocumentChunks.tsx` (apenas frontend, nenhum edge function ou tabela alterada)

