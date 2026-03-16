

# Plano: buildIORAGPlan + Ativação Semântica por Flag (Fase 7, Bloco 4)

## Situação Atual

- `buildRAGPlan(intent)` é chamada na linha 2439, produz o `ragPlan` usado em todo o pipeline
- A flag `io_rag_domains_enabled` já é lida (linha 2381) e controla `useSemanticEmbedding` (embedding type + threshold)
- Mas o `ragPlan` em si **não muda** quando a flag está ON — sempre usa `buildRAGPlan(intent)` sem considerar fase IO
- O `ioPhaseContext` é carregado no Step 2.5 (linha 2489), **depois** do `ragPlan` ser definido
- O log de `prompt_assembly` (linha 3209) não registra qual RAG plan foi usado

## Alterações em `supabase/functions/zyon-chat/index.ts`

### 1. Adicionar `buildIORAGPlan` (após `buildRAGPlan`, ~linha 476)

Nova função conforme especificação do usuário: recebe `intent` + `ioPhase`, faz merge de domínios da fase com domínios do intent, aumenta topK em +2 (cap 12).

### 2. Mover construção do `ragPlan` para depois do Step 2.5

Atualmente (linha 2439):
```
const ragPlan = buildRAGPlan(intent);
```

Mover para após o carregamento do `ioPhaseContext` (~linha 2505), e condicionar:
```typescript
const ragPlan = (useSemanticEmbedding && ioPhaseContext?.current_phase)
  ? buildIORAGPlan(intent, ioPhaseContext.current_phase)
  : buildRAGPlan(intent);
const ragPlanType = (useSemanticEmbedding && ioPhaseContext?.current_phase) ? 'io' : 'legacy';
```

### 3. Atualizar log de `prompt_assembly` (linha 3213)

Adicionar `rag_plan_type` e `rag_domains` ao `event_data`:
```typescript
event_data: {
  prompt_path: isPromptAdapterEnabled ? 'io_adapter' : 'legacy',
  rag_plan_type: ragPlanType, // 'io' ou 'legacy'
  rag_domains: ragPlan.filters.domains || [],
  io_phase: ioPhaseContext?.current_phase || null,
  ...
},
flags_active: { 
  io_prompt_adapter_enabled: isPromptAdapterEnabled,
  io_rag_domains_enabled: useSemanticEmbedding,
},
```

### 4. Nenhuma outra alteração

- `buildRAGPlan` permanece intacto (flag OFF = comportamento legado)
- `search_chunks` RPC não muda
- Prompt Adapter e Validator não mudam
- Embedding switch (semantic vs hash) já funciona via flag

## Fluxo resultante

```text
Flag OFF:
  buildRAGPlan(intent) → hash embedding → threshold 0.03

Flag ON + sem fase IO:
  buildRAGPlan(intent) → semantic embedding → threshold 0.40

Flag ON + com fase IO:
  buildIORAGPlan(intent, phase) → semantic embedding → threshold 0.40
  → domínios = merge(fase, intent), topK += 2
```

## Arquivo alterado
- `supabase/functions/zyon-chat/index.ts` (apenas edge function, sem tabelas)

