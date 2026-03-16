

# Redesign do Diário Espiritual

## Resumo
Enriquecer a página `/diary` com dados IO (fase, análise), placeholders contextuais por fase, card de análise na visualização, e contadores na sidebar. Tudo retrocompatível — sem dados IO, funciona como hoje.

## Alterações em `src/pages/Diary.tsx`

### 1. Interface e constantes

- Expandir `DiaryEntry` para incluir `io_analysis?: any` e `io_phase_at_entry?: number | null`
- Adicionar constantes `PHASE_INSPIRATIONS` (7 frases por fase), `PHASE_PLACEHOLDERS` (7 placeholders por fase), `PHASE_NAMES` (mapeamento fase → nome: Consciência, Limites, etc.)
- Adicionar query de `io_user_phase` para o usuário atual (apenas `current_phase`), condicionada a `isDiaryIOEnabled`

### 2. Select enriquecido

Atualizar `loadEntries` de `.select("*")` para `.select("id, content, created_at, updated_at, io_analysis, io_phase_at_entry")` — garante que os campos IO vêm no resultado.

### 3. Mini contador no topo da sidebar (item 5)

Entre o header e o ScrollArea, inserir linha `text-xs text-muted-foreground`:
- Se `entries.length > 0`: `📖 X reflexões · última há Y dias`
- Se vazio: `📖 Comece sua primeira reflexão`

Calcular Y com `differenceInDays(new Date(), new Date(entries[0].created_at))`.

### 4. Cards enriquecidos na sidebar (item 1)

Em cada card de entrada:
- Ao lado da data, se `entry.io_phase_at_entry`: badge `Fase N` com estilo `text-[10px] bg-muted rounded-full px-1.5`
- Abaixo do texto truncado, se `entry.io_analysis` existe:
  - Dot colorido + depth_level traduzido (deep→verde/profundo, moderate→amarelo/moderado, superficial→cinza/breve)
  - Separador ` · ` + até 2 key_themes
  - Tudo em `text-[10px] text-muted-foreground`

### 5. Estado vazio inspirador (item 2)

Substituir o bloco central (quando nada selecionado) por:
- Logo Zion (menor, `h-12 w-12`)
- Frase inspiradora por fase IO (se `isDiaryIOEnabled && currentPhase`) ou fallback atual
- Contadores: `X reflexões · última há Y dias` ou `Nenhuma reflexão ainda`
- Botão Nova Entrada (manter)

### 6. Placeholder contextual no textarea (item 3)

Quando `isCreating`, usar placeholder da fase IO se disponível, senão fallback genérico.

### 7. Card de análise abaixo do conteúdo (item 4)

Quando `selectedEntry?.io_analysis` existe e `isDiaryIOEnabled`:
- Card sutil `bg-muted/30 rounded-lg p-4 mt-4 border border-border/50`
- Título: "Sobre esta reflexão" uppercase tracking-wide
- Badges: tom emocional (positive→verde, neutral→cinza, negative→"sensível" vermelho-suave, mixed→amarelo), profundidade (deep→profundo, moderate→moderado, superficial→breve)
- Tags de key_themes
- Fase na época: `Escrito na Fase N — Nome`
- Resumo em itálico (analysis_summary)

### 8. Imports adicionais

- `Badge` de `@/components/ui/badge`
- `differenceInDays` de `date-fns`
- `useQuery` de `@tanstack/react-query` (para io_user_phase query)

## Arquivos alterados
- `src/pages/Diary.tsx` (único arquivo)

