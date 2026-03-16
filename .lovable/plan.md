

# Títulos Automáticos para o Diário Espiritual

## Resumo
Adicionar coluna `title` em `diary_entries`, criar edge function `generate-diary-title` (mesma lógica do chat), chamar fire-and-forget ao salvar, e exibir título na sidebar e na visualização.

## Alterações

### 1. Migration — coluna title
```sql
ALTER TABLE diary_entries ADD COLUMN title text DEFAULT NULL;
```

### 2. Edge Function `supabase/functions/generate-diary-title/index.ts`
- Entrada: `{ diary_entry_id, content }`
- Verifica se já tem título (skip se sim), skip se content < 10 chars
- Chama Lovable AI (gemini-2.5-flash-lite, temp 0.3, max_tokens 20) com system prompt para gerar título 3-5 palavras em português
- Limpa aspas, limita 50 chars, UPDATE diary_entries SET title
- Se falhar: retorna sem gravar (fallback no frontend)
- Config.toml: `[functions.generate-diary-title] verify_jwt = false`

### 3. `src/pages/Diary.tsx` — Chamada + UI

**Interface**: Adicionar `title?: string | null` ao `DiaryEntry`.

**Select**: Adicionar `title` ao `.select(...)` do `loadEntries`.

**Chamada fire-and-forget**: Extrair a chamada de `generate-diary-title` para FORA do `triggerIOAnalysis` (que é condicionada a flag IO). No `handleSave`, após o save bem-sucedido (tanto create quanto update):

```typescript
// Sempre (independente de flag IO):
supabase.functions.invoke('generate-diary-title', {
  body: { diary_entry_id: id, content: content.trim() }
}).catch(err => console.warn("Diary title gen failed:", err));

// Reload após delay
setTimeout(() => loadEntries(), 3000);

// Condicional IO:
triggerIOAnalysis(id, content.trim());
```

**Sidebar cards**: Se `entry.title` existe, mostrar título como texto principal (font-medium) e conteúdo truncado menor abaixo (text-xs muted). Se não, manter como hoje.

**Visualização**: Se `selectedEntry.title` existe, mostrar como heading `text-lg font-semibold mb-2` acima do conteúdo. Data abaixo em `text-sm text-muted-foreground`. Se não, manter como hoje.

## Arquivos alterados
- Migration SQL (nova coluna)
- `supabase/functions/generate-diary-title/index.ts` (novo)
- `supabase/config.toml` (adicionar função)
- `src/pages/Diary.tsx` (interface, select, chamada, UI sidebar + visualização)

