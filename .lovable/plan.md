

# Reprocessar Diários — Botão Admin + Backfill io_phase_at_entry

## Análise

- **analyze-diary** já tem `primary_category` no schema e sempre sobrescreve `io_analysis` — não há check de "já analisado". Nenhuma alteração necessária na edge function.
- Entradas antigas precisam ser reprocessadas para ganhar `primary_category`.
- `io_phase_at_entry` NULL precisa ser preenchido com `1` como default.

## Alterações

### 1. Migration: backfill `io_phase_at_entry`

```sql
UPDATE diary_entries SET io_phase_at_entry = 1 WHERE io_phase_at_entry IS NULL;
```

### 2. Botão "Reprocessar Diários" no IOOverview

**Arquivo:** `src/pages/admin/IOOverview.tsx`

Adicionar seção após os Overview Cards (antes do Phase Distribution) com um Card contendo:

- Botão "Reprocessar Diários" que ao clicar:
  1. Busca `diary_entries` onde `io_analysis` IS NULL ou não contém `primary_category`, com `content` >= 10 chars (usando service role via RPC ou client query com admin RLS)
  2. Itera sequencialmente chamando `supabase.functions.invoke('analyze-diary', { body: { diary_entry_id, content, user_id } })`
  3. Delay de 1s entre chamadas
  4. Mostra progresso: "Reprocessando X de Y..."
  5. Ao final: toast com total reprocessado

- State: `reprocessing: boolean`, `reprocessProgress: { current: number, total: number } | null`

- Query para buscar entradas pendentes: buscar todas `diary_entries` e filtrar client-side as que não têm `io_analysis?.primary_category` (já que `io_analysis` é jsonb e não dá para filtrar campo interno facilmente via PostgREST)

- Nota: admin RLS já permite SELECT em `diary_entries`? Não — RLS só permite users verem suas próprias. Precisamos de uma abordagem alternativa: criar uma **edge function `reprocess-diaries`** que roda com service role, busca as entradas pendentes e chama analyze-diary internamente (ou processa em batch).

**Decisão de arquitetura:** Criar edge function `reprocess-diaries` que:
1. Usa service role para buscar diary_entries pendentes
2. Processa em batches de até 20 por invocação (respeitando timeout de 60s com ~1s delay = ~20 entradas)
3. Retorna `{ processed, remaining, continued }` para o frontend continuar chamando
4. Frontend faz loop automático enquanto `remaining > 0`

### 3. Nova Edge Function: `supabase/functions/reprocess-diaries/index.ts`

- Recebe `{ batch_size?: number }` (default 20)
- Query com service role: `diary_entries` onde content >= 10 chars
- Filtra client-side: `io_analysis IS NULL` ou `io_analysis` não contém `primary_category`
- Para cada entrada (até batch_size): chama analyze-diary internamente (inline, não invoke) — copia a lógica de chamada AI diretamente para evitar overhead de invoke
- Na verdade, mais simples: usa `supabase.functions.invoke('analyze-diary')` internamente com delay de 1.5s
- Retorna `{ processed, remaining, total }`

### 4. Frontend no IOOverview

Adicionar Card "Ferramentas de Manutenção" com:
- Botão "Reprocessar Diários"
- Progress bar durante execução
- Texto "Processando X de Y..." 
- Resultado final "Y entradas reprocessadas"

## Arquivos

- `supabase/functions/reprocess-diaries/index.ts` (novo)
- `src/pages/admin/IOOverview.tsx` (adicionar seção de reprocessamento)
- Migration SQL para backfill `io_phase_at_entry`

