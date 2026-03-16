

# Plano: Promover UNFOUNDED_SUBSTANTIVE com flag io_rag_foundation_required

## Alterações em `supabase/functions/zyon-chat/index.ts`

### 1. Adicionar parâmetro à função `validateResponseIO` (linha 842)

Adicionar `isRagFoundationRequired: boolean` como último parâmetro da assinatura.

### 2. Atualizar seção UNFOUNDED_SUBSTANTIVE (linhas 1099-1106)

```typescript
if (!hasRAGChunks || lowConfidenceRAG) {
  const substantiveRegex = /\b(seu medo (de|é)|sua cren[cç]a|...)\b/i;
  if (substantiveRegex.test(response)) {
    const unfoundedSeverity = isRagFoundationRequired ? 'HIGH' : 'MEDIUM';
    issues.push({ 
      code: 'UNFOUNDED_SUBSTANTIVE', severity: unfoundedSeverity,
      message: `Afirmação substantiva sem fundamentação RAG (Premissa 15 — ${unfoundedSeverity})` 
    });
    if (unfoundedSeverity === 'HIGH') {
      rewriteInstructions.push(
        'REMOVA afirmações sobre medo, crença, padrão ou virtude que não estejam fundamentadas na Base de Conhecimento. Permaneça no MODO ACOLHIMENTO: espelhe e pergunte.'
      );
    }
  }
}
```

### 3. Buscar flag no call site (antes da linha 3110)

Junto com a flag `io_safety_expanded_enabled`, buscar `io_rag_foundation_required`:

```typescript
const { data: ragFoundationFlag } = await supabase.rpc('get_feature_flag', {
  p_flag_name: 'io_rag_foundation_required',
  p_user_id: userId
});
const isRagFoundationRequired = ragFoundationFlag === true;
```

### 4. Atualizar call site (linha 3117-3124)

Passar `isRagFoundationRequired` como último argumento na chamada a `validateResponseIO`.

## Arquivo alterado
- `supabase/functions/zyon-chat/index.ts`

