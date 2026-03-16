

# Plano: Integração Diário Espiritual com IO

## Alterações

### 1. Migration SQL

- `ALTER TABLE diary_entries ADD COLUMN io_analysis jsonb DEFAULT NULL`
- `ALTER TABLE diary_entries ADD COLUMN io_phase_at_entry integer DEFAULT NULL`
- Inserir flag `io_diary_integration_enabled` (global, false, description)

### 2. Nova edge function `analyze-diary/index.ts`

Criar edge function separada (não modificar `io-session-feedback`) que:
- Recebe `{ user_id, diary_entry_id, content }`
- Chama LLM (gemini-2.5-flash-lite, temp 0.3) via tool calling para extrair:
  - `genuineness_score` (0.0-1.0)
  - `depth_level`: "superficial" | "moderate" | "deep"
  - `key_themes`: string[]
  - `emotional_tone`: "positive" | "neutral" | "negative" | "mixed"
  - `analysis_summary`: string
- Grava resultado em `diary_entries.io_analysis` via `UPDATE`
- Try/catch: se falhar, grava `null`, retorna sucesso parcial
- Se content < 10 chars: grava objeto `{ skipped: true, analysis_summary: "Registro insuficiente" }`

### 3. Frontend `src/pages/Diary.tsx`

No `handleSave`, após salvar com sucesso:

- Checar flag `io_diary_integration_enabled` via `useFeatureFlag`
- Se true:
  - Buscar `io_user_phase.current_phase` do usuário
  - Atualizar `diary_entries.io_phase_at_entry` com a fase
  - Invocar `analyze-diary` edge function em background (fire-and-forget, sem bloquear UI)

### Arquivos alterados
- `supabase/functions/analyze-diary/index.ts` (novo)
- `src/pages/Diary.tsx`
- 1 migration SQL (2 colunas + flag)
- `supabase/config.toml` — adicionar entry para `analyze-diary` com `verify_jwt = false`

### Segurança
- Flag OFF = zero mudança no comportamento do diário
- Falha na análise não bloqueia save
- Nenhum outro edge function alterado

