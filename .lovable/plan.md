

# Plano: Registro Analysis no Phase Manager

## Resumo

Integrar os dados de `registro_analysis` (gravados pelo `io-session-feedback`) como sinal adicional no Phase Manager, controlado pela flag `io_pm_registro_analysis_enabled`.

## Alterações em `supabase/functions/io-phase-manager/index.ts`

### 1. Flag check (após linha 790, junto ao observer flag)

```typescript
const { data: registroFlagResult } = await supabase.rpc("get_feature_flag", {
  p_flag_name: "io_pm_registro_analysis_enabled",
  p_user_id: userId,
});
const isRegistroAnalysisEnabled = registroFlagResult === true;
```

### 2. Step 3 — incluir `registro_analysis` no SELECT

O SELECT atual usa `select("*")` (linhas 867, 877), então `registro_analysis` já é incluído automaticamente. Nenhuma alteração necessária no SELECT.

### 3. Agregação (após Step 4.5 observer block, ~linha 955)

Se flag true, iterar sessões com `registro_analysis` não-null e calcular:

```typescript
let registroBlock = false;
let registroSummary: Record<string, unknown> | null = null;

if (isRegistroAnalysisEnabled) {
  const withAnalysis = sessions.filter(
    (s: any) => s.registro_analysis && !s.registro_analysis.skipped
  );

  if (withAnalysis.length > 0) {
    const avgGenuineness = withAnalysis.reduce(
      (sum: number, s: any) => sum + (s.registro_analysis.genuineness_score || 0), 0
    ) / withAnalysis.length;
    const avgCoherence = withAnalysis.reduce(
      (sum: number, s: any) => sum + (s.registro_analysis.coherence_with_scales || 0), 0
    ) / withAnalysis.length;
    const superficialCount = withAnalysis.filter(
      (s: any) => s.registro_analysis.depth_level === "superficial"
    ).length;
    const repetitionCount = withAnalysis.filter(
      (s: any) => s.registro_analysis.repetition_detected
    ).length;

    registroSummary = {
      sessions_analyzed: withAnalysis.length,
      avg_genuineness: Math.round(avgGenuineness * 1000) / 1000,
      avg_coherence: Math.round(avgCoherence * 1000) / 1000,
      superficial_count: superficialCount,
      repetition_count: repetitionCount,
    };

    // Bloqueio: últimas 3 sessões com avgCoherence < 0.3 E avgGenuineness < 0.3
    const recent3 = withAnalysis
      .sort((a: any, b: any) => b.session_date.localeCompare(a.session_date))
      .slice(0, 3);
    if (recent3.length >= 3) {
      const r3Genuineness = recent3.reduce(
        (sum: number, s: any) => sum + (s.registro_analysis.genuineness_score || 0), 0
      ) / 3;
      const r3Coherence = recent3.reduce(
        (sum: number, s: any) => sum + (s.registro_analysis.coherence_with_scales || 0), 0
      ) / 3;
      if (r3Coherence < 0.3 && r3Genuineness < 0.3 && criteriaResult.met) {
        criteriaResult = {
          met: false,
          details: criteriaResult.details +
            " | BLOQUEIO REGISTRO: Registros indicam incoerência grave entre escalas e reflexão textual" +
            ` (genuineness: ${r3Genuineness.toFixed(2)}, coherence: ${r3Coherence.toFixed(2)})`,
        };
        registroBlock = true;
      }
    }
  }
}
```

### 4. Enrichment do criteria_snapshot (linha ~1064)

Adicionar `registro_analysis_summary: registroSummary || null` e `blocked_by_registro: registroBlock` ao objeto.

### 5. Enrichment do observability_logs (linha ~1091)

Adicionar ao `event_data`:
- `registro_analysis_consulted: isRegistroAnalysisEnabled`
- `registro_avg_genuineness: registroSummary?.avg_genuineness || null`
- `registro_avg_coherence: registroSummary?.avg_coherence || null`
- `registro_block: registroBlock`

### 6. Enrichment da response (linha ~1141)

Se `registroSummary`, adicionar `registro_analysis` ao response JSON com os dados agregados e status de bloqueio.

## Arquivo alterado
- `supabase/functions/io-phase-manager/index.ts`

## Segurança
- Flag OFF = `registroSummary` e `registroBlock` permanecem null/false, zero impacto
- Hard rules obrigatórias — registro só pode bloquear, nunca promover
- Bloqueio exige condição grave: ambos scores < 0.3 nas últimas 3 sessões

