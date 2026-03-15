

# Plano: Fase 4 — Validator IO Calibrado por Fase

## Resumo

Adicionar `validateResponseIO` e `buildRewritePromptIO` ao `zyon-chat/index.ts`, controlados pela flag `io_safety_expanded_enabled`. Quando OFF, `validateResponseComplete` + `buildRewritePrompt` continuam exatamente como hoje.

## Alterações em `supabase/functions/zyon-chat/index.ts`

### 1. Novas funções (após `buildRewritePrompt`, ~linha 801)

Inserir duas funções:

- **`validateResponseIO()`** — Validator calibrado por fase IO com:
  - Formato calibrado por fase (maxChars, maxQuestions, maxLines variam)
  - Regras universais (SINTO_QUE expandido, PRESUNÇÃO, ESPECULAÇÃO, CONFLITO, LUTO)
  - Regras calibradas por fase (CAUSALIDADE, DIAGNÓSTICO, EXPLICAÇÃO com severidade variável)
  - Regras novas IO: TOXIC_POSITIVITY, IDENTITY_QUESTION_WRONG_PHASE, UNFOUNDED_SUBSTANTIVE (Premissa 15), REDUNDANT_QUESTIONS, PHASE_DEPTH_VIOLATION, JARGON por fase
  - Teologia com cascata por fase + maturidade

- **`buildRewritePromptIO()`** — Prompt de reescrita com contexto de fase e instruções de MODO PRESENÇA expandidas

Código exato conforme a tarefa do usuário.

### 2. STEP 7: Branch por flag (substituir linhas 2601-2665)

O Step 7 atual será substituído por:

```
// Verificar flag io_safety_expanded_enabled
const { data: safetyFlag } = await supabase.rpc('get_feature_flag', {
  p_flag_name: 'io_safety_expanded_enabled', p_user_id: userId
});
const isSafetyExpanded = safetyFlag === true;
let usedIOValidator = false;

if (isSafetyExpanded) {
  validationResult = validateResponseIO(aiResponse, intent, userContext, turnCount,
    spiritualMaturity, ioPhaseContext?.current_phase || null,
    chunks.length > 0, lowConfidence, false);
  usedIOValidator = true;
} else {
  validationResult = validateResponseComplete(aiResponse, intent, userContext, turnCount, spiritualMaturity);
}

// Rewrite: usa buildRewritePromptIO ou buildRewritePrompt conforme o validator usado
const rewritePrompt = usedIOValidator
  ? buildRewritePromptIO(aiResponse, validationResult, ioPhaseContext?.current_phase || null)
  : buildRewritePrompt(aiResponse, validationResult);
```

O resto da lógica de rewrite (fetch, fallback MINIMAL_SAFE) permanece igual.

### 3. Observability log do validator (após rewrite, antes do Step 8)

```typescript
await supabase.from('observability_logs').insert({
  event_type: 'validation_result',
  user_id: userId, session_id: sessionId,
  event_data: {
    validator: usedIOValidator ? 'io' : 'legacy',
    io_phase: ioPhaseContext?.current_phase || null,
    issues: validationResult.issues.map(i => ({ code: i.code, severity: i.severity })),
    needs_rewrite: validationResult.needsRewrite,
    did_rewrite: didRewrite,
  },
  flags_active: {
    io_safety_expanded_enabled: isSafetyExpanded,
    io_prompt_adapter_enabled: isPromptAdapterEnabled || false
  },
});
```

### 4. Debug info (isAdmin, ~linha 2767)

Expandir o bloco `validation` existente:

```typescript
validation: {
  char_count: aiResponse.length,
  line_count: aiResponse.split('\n').filter((l: string) => l.trim()).length,
  question_count: (aiResponse.match(/\?/g) || []).length,
  issues: validationResult.issues,
  was_rewritten: didRewrite,
  validator_type: usedIOValidator ? 'io' : 'legacy',
  io_phase_at_validation: ioPhaseContext?.current_phase || null,
},
```

## O que NÃO muda

- `validateResponseComplete` — intacta (usada quando flag OFF)
- `buildRewritePrompt` — intacta (usada quando flag OFF)
- `buildIOSystemPrompt` / `getIOPhaseOrientation` — intocados (Fase 3)
- Observer, Steps 1-6, Step 8 — intocados
- Nenhum outro edge function alterado
- Nenhuma migration necessária (`validation_result` já é event_type válido)

## Segurança

- Flag `io_safety_expanded_enabled` global está `false` no banco
- Se RPC falhar, `isSafetyExpanded = false` → validator legado
- Branch legado é chamada exata ao código atual

