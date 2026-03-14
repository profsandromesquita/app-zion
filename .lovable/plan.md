

# Plano Corrigido: zyon-chat buscar prompts de ai_prompt_blocks

## Correção identificada

Os campos `CRISIS_KEYWORDS_HIGH`, `CRISIS_KEYWORDS_MEDIUM` e `CRISIS_KEYWORDS_LOW` no banco são **texto plano** (uma keyword por linha), não JSON arrays. O plano original usava `JSON.parse()` para esses campos — incorreto.

## Alterações em `supabase/functions/zyon-chat/index.ts`

### 1. Renomear constantes hardcoded para FALLBACK_*

- `AVATAR_EMOTIONAL_CONTEXT` → `FALLBACK_AVATAR_CONTEXT`
- `BASE_IDENTITY` → `FALLBACK_BASE_IDENTITY`
- `CRISIS_KEYWORDS` → `FALLBACK_CRISIS_KEYWORDS`
- `SYNONYM_MAP` → `FALLBACK_SYNONYM_MAP`
- `intentGuidance` inline → `FALLBACK_INTENT_GUIDANCE` (extrair para constante top-level)

Conteúdo mantido idêntico.

### 2. Fetch de prompt blocks (após criar supabase client, antes do Step 1)

```typescript
let promptBlocks: Array<{key: string; content: string; category: string}> | null = null;
if (supabase) {
  try {
    const { data } = await supabase
      .from('ai_prompt_blocks')
      .select('key, content, category')
      .eq('is_active', true);
    promptBlocks = data;
    console.log("Prompt blocks loaded:", promptBlocks?.length || 0);
  } catch (err) {
    console.error("Failed to load prompt blocks, using fallbacks:", err);
  }
}

const getBlock = (key: string): string => {
  return promptBlocks?.find(b => b.key === key)?.content || '';
};
```

### 3. Resolver variáveis dinâmicas

```typescript
const BASE_IDENTITY = getBlock('BASE_IDENTITY') || FALLBACK_BASE_IDENTITY;

// JSON blocks — usar JSON.parse com try/catch
let AVATAR_EMOTIONAL_CONTEXT = FALLBACK_AVATAR_CONTEXT;
try {
  const raw = getBlock('AVATAR_EMOTIONAL_CONTEXT');
  if (raw) AVATAR_EMOTIONAL_CONTEXT = JSON.parse(raw);
} catch { /* fallback */ }

let SYNONYM_MAP = FALLBACK_SYNONYM_MAP;
try {
  const raw = getBlock('SYNONYM_MAP');
  if (raw) SYNONYM_MAP = JSON.parse(raw);
} catch { /* fallback */ }

let intentGuidance = FALLBACK_INTENT_GUIDANCE;
try {
  const raw = getBlock('INTENT_GUIDANCE');
  if (raw) intentGuidance = JSON.parse(raw);
} catch { /* fallback */ }

// CRISIS KEYWORDS — texto plano, uma keyword por linha (NÃO JSON)
const parseKeywordLines = (text: string): string[] =>
  text.split('\n').map(l => l.trim()).filter(Boolean);

const crisisHighRaw = getBlock('CRISIS_KEYWORDS_HIGH');
const crisisMediumRaw = getBlock('CRISIS_KEYWORDS_MEDIUM');
const crisisLowRaw = getBlock('CRISIS_KEYWORDS_LOW');

const CRISIS_KEYWORDS = {
  high: crisisHighRaw ? parseKeywordLines(crisisHighRaw) : FALLBACK_CRISIS_KEYWORDS.high,
  medium: crisisMediumRaw ? parseKeywordLines(crisisMediumRaw) : FALLBACK_CRISIS_KEYWORDS.medium,
  low: crisisLowRaw ? parseKeywordLines(crisisLowRaw) : FALLBACK_CRISIS_KEYWORDS.low,
};
```

### 4. Ajustar funções que usam variáveis globais

- `detectCrisis(text, crisisKeywords)` — novo parâmetro
- `applyGuardrails(response, chunks, baseId)` — novo parâmetro
- `rerankByLexicalOverlap(chunks, msg, synMap)` — novo parâmetro
- `intentGuidance` inline (linha ~1941) — substituir pelo objeto já resolvido

Cada chamada atualizada para passar a variável correspondente.

### 5. O que NÃO muda

- Nenhuma lógica de pipeline (Steps 1-7)
- Nenhum edge function além de zyon-chat
- Nenhuma tabela ou schema
- Observer, validator, router — intocados
- Resultado final para o usuário — idêntico

### Resumo da diferença vs plano anterior

| Campo | Plano anterior | Plano corrigido |
|---|---|---|
| CRISIS_KEYWORDS_* | `JSON.parse()` | `split('\n').filter(Boolean)` |
| AVATAR_EMOTIONAL_CONTEXT | `JSON.parse()` | `JSON.parse()` ✓ |
| SYNONYM_MAP | `JSON.parse()` | `JSON.parse()` ✓ |
| INTENT_GUIDANCE | `JSON.parse()` | `JSON.parse()` ✓ |
| BASE_IDENTITY | string direto | string direto ✓ |

