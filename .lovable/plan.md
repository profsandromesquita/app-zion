

# Plano: Safety Expandida — 4 cenários novos no validateResponseIO

## Alterações em `supabase/functions/zyon-chat/index.ts`

### 1. Adicionar `crisisRiskLevel` como parâmetro (linha 816)

Novo parâmetro na assinatura:
```typescript
function validateResponseIO(
  response: string, intent: string, userContext: UserContext,
  turnCount: number, spiritualMaturity: string, ioPhase: number | null,
  hasRAGChunks: boolean, lowConfidenceRAG: boolean,
  isSessionDaily: boolean,
  crisisRiskLevel: string  // NEW: 'none' | 'low' | 'medium' | 'high'
): ValidationResult {
```

### 2. Inserir 4 novos cenários (linhas 1106-1107, antes da POLÍTICA DE DECISÃO)

Após o bloco `PHASE_DEPTH_VIOLATION` e antes da seção "POLÍTICA DE DECISÃO":

- **REGRESSION_INSENSITIVE** (HIGH): Detecta se a resposta menciona "voltou de fase", "regrediu", "fase anterior", "retrocedeu" quando o contexto indica sofrimento. Regex sobre a resposta.
- **CRISIS_IN_SESSION** (CRITICAL): Se `isSessionDaily && crisisRiskLevel in ['medium','high']` e a resposta contém termos de sessão ("missão", "escala", "registro", "check-in"). Instrução de rewrite: sair da sessão, entrar em modo segurança.
- **SESSION_DEPTH_OVERFLOW** (MEDIUM): Se `isSessionDaily && isEarlyPhase` e resposta contém termos de profundidade avançada (identidade, raiz, padrão profundo, crença-raiz). Rewrite: "Esse assunto é importante. Vamos explorar isso no chat com mais calma?"
- **BIBLE_REFUSED reforço**: Alterar o rewriteInstruction existente (linha 1001) para incluir "IMPORTANTE: Mesmo em fases avançadas, a recusa do usuário prevalece sobre a fase."

### 3. Atualizar POLÍTICA DE DECISÃO (linha 1115-1118)

Adicionar `REGRESSION_INSENSITIVE` à lista de `presenceModeViolation`:
```typescript
const presenceModeViolation = issues.some(i => 
  ['PRESUMPTION', 'SINTO_QUE_BANNED', 'CAUSALITY_DIAGNOSTIC', 
   'DIAGNOSTIC_ABSOLUTE', 'TOXIC_POSITIVITY', 'REGRESSION_INSENSITIVE'].includes(i.code)
);
```

### 4. Atualizar call site (linha 2989-2995)

Passar `crisisRiskLevel` na chamada:
```typescript
validationResult = validateResponseIO(
  aiResponse, intent, userContext, turnCount, spiritualMaturity,
  ioPhaseContext?.current_phase || null,
  chunks.length > 0, lowConfidence, false,
  crisisResult?.risk_level || 'none'  // NEW
);
```

## O que NÃO muda

- `validateResponseComplete` — intacta
- `buildRewritePrompt` / `buildRewritePromptIO` — intocados
- `buildIOSystemPrompt` / `getIOPhaseOrientation` — intocados
- Observer, Steps 1-6, Step 8, outros edge functions — intocados

