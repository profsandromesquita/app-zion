

# Plano: Diary Signals no Phase Manager (Informativo)

## Resumo

Adicionar consulta às `diary_entries` com `io_analysis` como sinal informativo (nunca bloqueante) no Phase Manager, controlado pela flag `io_diary_integration_enabled`.

## Alterações em `supabase/functions/io-phase-manager/index.ts`

### 1. Flag check (~linha 798, após registro flag)

```typescript
const { data: diaryFlagResult } = await supabase.rpc("get_feature_flag", {
  p_flag_name: "io_diary_integration_enabled",
  p_user_id: userId,
});
const isDiaryIntegrationEnabled = diaryFlagResult === true;
```

### 2. Função `fetchDiarySignals` (antes de `handleEvaluate`)

```typescript
async function fetchDiarySignals(supabase: any, userId: string, days: number) {
  const since = new Date();
  since.setDate(since.getDate() - days);

  const { data: entries } = await supabase
    .from("diary_entries")
    .select("io_analysis, created_at")
    .eq("user_id", userId)
    .not("io_analysis", "is", null)
    .gte("created_at", since.toISOString())
    .order("created_at", { ascending: false });

  const valid = (entries || []).filter((e: any) => e.io_analysis && !e.io_analysis.skipped);
  if (valid.length === 0) return null;

  const avgGenuineness = valid.reduce((s: number, e: any) => s + (e.io_analysis.genuineness_score || 0), 0) / valid.length;

  const depthCounts = { superficial: 0, moderate: 0, deep: 0 };
  const toneCounts: Record<string, number> = {};
  const themeCounts: Record<string, number> = {};

  for (const e of valid) {
    const a = e.io_analysis;
    if (a.depth_level) depthCounts[a.depth_level] = (depthCounts[a.depth_level] || 0) + 1;
    if (a.emotional_tone) toneCounts[a.emotional_tone] = (toneCounts[a.emotional_tone] || 0) + 1;
    if (Array.isArray(a.key_themes)) {
      for (const t of a.key_themes) themeCounts[t] = (themeCounts[t] || 0) + 1;
    }
  }

  const dominantTone = Object.entries(toneCounts).sort((a, b) => b[1] - a[1])[0]?.[0] || "unknown";
  const keyThemes = Object.entries(themeCounts).sort((a, b) => b[1] - a[1]).slice(0, 5).map(([t]) => t);

  return {
    total_entries: valid.length,
    avg_genuineness: Math.round(avgGenuineness * 1000) / 1000,
    depth_distribution: depthCounts,
    dominant_tone: dominantTone,
    key_themes: keyThemes,
    diary_engagement: Math.round((valid.length / days) * 1000) / 1000,
  };
}
```

### 3. Chamar no evaluate (~após Step 4.6 registro block, ~linha 1025)

```typescript
let diarySignals: Record<string, unknown> | null = null;
if (isDiaryIntegrationEnabled) {
  try {
    diarySignals = await fetchDiarySignals(supabase, userId, 30);
  } catch (err) {
    console.warn("Diary signals fetch failed:", err);
  }
}
```

Sem bloqueio. Sem modificar `criteriaResult`.

### 4. Enrichment do criteria_snapshot (~linha 1133)

Adicionar: `diary_signals: diarySignals || null`

### 5. Enrichment do observability_logs (~linha 1182)

Adicionar ao `event_data`:
- `diary_integration_consulted: isDiaryIntegrationEnabled`
- `diary_entries_analyzed: diarySignals?.total_entries ?? null`
- `diary_avg_genuineness: diarySignals?.avg_genuineness ?? null`
- `diary_engagement: diarySignals?.diary_engagement ?? null`
- `diary_dominant_tone: diarySignals?.dominant_tone ?? null`

### 6. Enrichment da response (~linha 1233)

```typescript
if (diarySignals) {
  response.diary_signals = {
    consulted: true,
    ...diarySignals,
    blocking: false, // always informational
  };
}
```

## Arquivo alterado
- `supabase/functions/io-phase-manager/index.ts`

## Segurança
- Flag OFF = zero consulta ao diário
- Nunca bloqueia avanço — puramente informativo
- Try/catch isolado — falha não afeta avaliação

