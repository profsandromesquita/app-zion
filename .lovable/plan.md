

# Categorização Automática + Mapa de Temas no Diário

## Resumo
3 partes: (1) adicionar `primary_category` ao tool calling do analyze-diary, (2) área interativa no estado vazio do Diary.tsx com mapa de temas ou prompts temáticos, (3) filtro por categoria na sidebar.

## Parte 1: Edge Function `analyze-diary`

**Arquivo:** `supabase/functions/analyze-diary/index.ts`

- Adicionar `primary_category` ao schema da tool (linha 82-106), com enum dos 9 valores e adicionar ao `required`
- Expandir system prompt (linha 54) com instruções de categorização

## Parte 2 + 3: `src/pages/Diary.tsx`

### Novos constants e types
- `CATEGORY_MAP` com emoji + label para cada categoria
- `THEME_PROMPTS` com prompts temáticos para cada categoria
- Adicionar `primary_category?: string` ao `IOAnalysis` interface
- State: `activeFilter: string | null`, `themePlaceholder: string | null`

### Sidebar changes
- Computar `filteredEntries` baseado em `activeFilter`
- Renderizar `filteredEntries` em vez de `entries`
- Quando filtro ativo: badge no topo com "🏠 Família (4) ✕"
- Atualizar `SidebarCounter` para refletir filtro
- Adicionar emoji da categoria ao lado do badge de fase nos cards

### Área direita (estado vazio, linhas 588-604)
Substituir por lógica condicional:

**Se `isDiaryIOEnabled` e >= 3 entradas com `primary_category`:** Mapa de Temas
- Título "Suas reflexões por tema"
- Lista de categorias com barras proporcionais e contadores
- Cada tema clicável → `setActiveFilter(category)`
- Botão "+ Nova Entrada" + frase inspiradora abaixo

**Se `isDiaryIOEnabled` e < 3 entradas categorizadas:** Prompts Temáticos
- Título "Sobre o que quer refletir?"
- Grid 2 colunas com cards temáticos (emoji + prompt)
- Clique → `setIsCreating(true)` + `setThemePlaceholder(prompt)`
- Card "Livre" para escrita sem tema
- Frase inspiradora abaixo

**Se `!isDiaryIOEnabled`:** Estado vazio original (logo + frase + botão)

### Placeholder do textarea
- Se `themePlaceholder` está setado, usar ele; senão usar `getPlaceholder()` existente
- Resetar `themePlaceholder` ao salvar ou selecionar entrada existente

## Arquivos alterados
- `supabase/functions/analyze-diary/index.ts` (tool schema + prompt)
- `src/pages/Diary.tsx` (types, constants, state, sidebar filter, empty state)

