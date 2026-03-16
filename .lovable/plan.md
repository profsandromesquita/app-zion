

# Plano: Observer Signals no Phase Manager

## Resumo

Adicionar sinais do observer (turn_insights) como apoio auxiliar na avaliação de progressão de fase, controlado pela flag `io_pm_observer_signals_enabled`. O único sinal bloqueante é `hasSevereBlock` — todos os outros são informativos.

## Alterações em `supabase/functions/io-phase-manager/index.ts`

### 1. Interface e função `fetchObserverSignals` (após linha 308)

Nova interface `ObserverSignals` e função que consulta `turn_insights` JOIN `chat_sessions` nos últimos N dias:

```typescript
interface ObserverSignals {
  totalConversations: number;
  shiftsDetected: number;
  avgEmotionIntensity: number;
  unstableCount: number;
  avgOverallScore: number;
  severeIssuesCount: number;
  hasSevereBlock: boolean;
  observerPhase: string | null;
  recentShiftDescriptions: string[];
}

async function fetchObserverSignals(
  supabase: any, userId: string, lookbackDays = 14
): Promise<ObserverSignals> {
  const since = new Date(Date.now() - lookbackDays * 86400000)
    .toISOString();

  const { data: insights } = await supabase
    .from('turn_insights')
    .select(`
      shift_detected, shift_description,
      emotion_intensity, emotion_stability,
      overall_score, phase, phase_confidence,
      created_at,
      chat_session_id
    `)
    .in('chat_session_id', 
      supabase.from('chat_sessions')
        .select('id')
        .eq('user_id', userId)
    )
    .gte('created_at', since)
    .order('created_at', { ascending: false });

  const rows = insights || [];
  // ... aggregate into ObserverSignals
}
```

Nota: como `.in()` com subquery não é suportado pelo SDK, usaremos duas queries sequenciais (primeiro buscar session IDs, depois filtrar turn_insights).

### 2. Flag check em `handleEvaluate` (após Step 0, ~linha 460)

```typescript
const { data: observerFlagResult } = await supabase.rpc('get_feature_flag', {
  p_flag_name: 'io_pm_observer_signals_enabled',
  p_user_id: userId,
});
const isObserverSignalsEnabled = observerFlagResult === true;
```

### 3. Fetch observer signals (após Step 3, ~linha 760)

```typescript
let observerSignals: ObserverSignals | null = null;
if (isObserverSignalsEnabled) {
  observerSignals = await fetchObserverSignals(supabase, userId, 14);
}
```

### 4. Bloqueio por observer (após Step 4, ~linha 796)

Após calcular `criteriaResult`, se hard rules foram cumpridas mas observer detecta bloqueio severo:

```typescript
let blockedByObserver = false;
if (criteriaResult.met && observerSignals?.hasSevereBlock) {
  criteriaResult = {
    met: false,
    details: criteriaResult.details + 
      ' | BLOQUEIO: observer detectou instabilidade severa.'
  };
  blockedByObserver = true;
}
```

### 5. Enrichment do criteria_snapshot (linha ~900)

Adicionar `observer_signals: observerSignals || null` ao objeto `criteria_snapshot` na inserção de `io_phase_transitions`.

### 6. Enrichment do observability_logs (linha ~926)

Adicionar ao `event_data`:
```typescript
observer_signals_consulted: isObserverSignalsEnabled,
observer_shifts: observerSignals?.shiftsDetected || 0,
observer_severe_block: observerSignals?.hasSevereBlock || false,
observer_recommendation: observerSignals
  ? (observerSignals.hasSevereBlock ? 'blocked' 
     : observerSignals.shiftsDetected > 0 ? 'positive' : 'neutral')
  : null,
```

### 7. Enrichment da resposta (linha ~945)

Adicionar `observer_signals` ao response JSON quando disponível.

## Arquivo alterado
- `supabase/functions/io-phase-manager/index.ts`

## Segurança
- Flag OFF = zero mudança no comportamento (observerSignals permanece null)
- Hard rules permanecem obrigatórias — observer só pode bloquear, nunca promover
- Nenhuma outra edge function é alterada

