

# Plano: Atualizar Teste RAG para Embedding Semântico

## Situação Atual

- O `search-chunks` edge function **já usa** `generateSemanticEmbedding` (migrado no Bloco 1) - não precisa mudar.
- O threshold default no frontend é 0.05 (precisa mudar para 0.40).
- A RPC `search_chunks` não retorna `embedding_model_id`, `doc_title`, `doc_status` nem `retrievable` - precisa ser atualizada para mostrar esses campos.

## Alterações

### 1. Migração SQL: Atualizar RPC `search_chunks`

Adicionar campos ao `RETURNS TABLE`:
- `embedding_model_id TEXT`
- `doc_title TEXT`
- `doc_status doc_status`
- `retrievable BOOLEAN`

Esses campos vêm dos JOINs já existentes (`documents d`, `chunks c`). Não altera nenhuma tabela.

### 2. `src/pages/admin/RagTest.tsx`

- **Threshold default**: 0.05 → 0.40
- **Interface `SearchResult`**: adicionar `embedding_model_id`
- **Modo multi-threshold**: adicionar checkbox "Comparar thresholds". Quando ativado, executa 5 buscas em paralelo (0.30, 0.35, 0.40, 0.45, 0.50) e mostra resultados em colunas/tabs lado a lado
- **Badge embedding_model_id**: mostrar em cada card de resultado
- **Estado**: adicionar `multiMode`, `multiResults` (mapa threshold → results[])

```text
UI Multi-Threshold:

┌─────────────────────────────────────────────┐
│ [✓] Comparar múltiplos thresholds           │
│                                             │
│ Tab: 0.30 | 0.35 | [0.40] | 0.45 | 0.50   │
│                                             │
│ Threshold 0.40: 8 resultados (230ms)        │
│ ┌─────────────────────────────────────────┐ │
│ │ #1  85.2% similar  [text-embedding-3-s] │ │
│ │ [CONSTITUICAO] [geral] [P:100]          │ │
│ │ Texto do chunk...                       │ │
│ └─────────────────────────────────────────┘ │
└─────────────────────────────────────────────┘
```

### 3. `supabase/functions/search-chunks/index.ts`

Sem alterações (já usa `generateSemanticEmbedding`).

