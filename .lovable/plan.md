

# Plano Corrigido: Prompt Adapter IO no zyon-chat

## Correções vs plano anterior

| Item | Plano anterior | Corrigido |
|---|---|---|
| event_type | `prompt_assembly` (não existe no trigger) | Migration para adicionar `prompt_assembly` ao trigger |
| Campo flags | `flags_snapshot` | `flags_active` |

## Etapa 0: Migration — Adicionar event_type 'prompt_assembly'

```sql
CREATE OR REPLACE FUNCTION public.validate_observability_event_type()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO 'public'
AS $$
BEGIN
  IF NEW.event_type NOT IN (
    'chat_response', 'phase_transition', 'igi_update',
    'session_daily', 'rag_retrieval', 'validation_result',
    'rewrite', 'crisis_event', 'flag_check',
    'prompt_assembly'
  ) THEN
    RAISE EXCEPTION 'Invalid event_type: %', NEW.event_type;
  END IF;
  RETURN NEW;
END;
$$;
```

## Alterações em `supabase/functions/zyon-chat/index.ts`

### 1. Funções auxiliares (antes do MAIN HANDLER)

- `getIOPhaseOrientation(phase: number): string` — orientações por fase (7 fases)
- `buildIOSystemPrompt(config): string` — prompt modular com 14 blocos

### 2. STEP 2.5: Fetch IO Phase (após observer, antes do Step 3)

```typescript
let ioPhaseContext = null;
let isPromptAdapterEnabled = false;

const { data: promptAdapterFlag } = await supabase.rpc('get_feature_flag', {
  p_flag_name: 'io_prompt_adapter_enabled',
  p_user_id: userId
});
isPromptAdapterEnabled = promptAdapterFlag === true;

if (isPromptAdapterEnabled && userId) {
  // fetch io_user_phase
}
```

### 3. STEP 5: Branch por flag

- `if (isPromptAdapterEnabled)` → `buildIOSystemPrompt({...})`
- `else` → cópia literal do código legado atual

### 4. Observability log (corrigido)

```typescript
await supabase.from('observability_logs').insert({
  event_type: 'prompt_assembly',
  user_id: userId || null,
  session_id: sessionId || null,
  event_data: {
    prompt_path: isPromptAdapterEnabled ? 'io_adapter' : 'legacy',
    io_phase: ioPhaseContext?.current_phase || null,
    prompt_length: systemPrompt.length,
  },
  flags_active: { io_prompt_adapter_enabled: isPromptAdapterEnabled },
  latency_ms: 0,
});
```

### 5. Debug info (isAdmin block)

Adicionar `prompt_adapter` e `io_phase` ao objeto debug.

## O que NÃO muda

- Flag OFF = comportamento 100% idêntico (branch legado é cópia literal)
- Observer, validator, Steps 1-4, Steps 6-8 — intocados
- Nenhum outro edge function alterado
- UX inalterada

