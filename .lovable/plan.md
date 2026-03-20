

# Novas Regras no Validator: REPEATED_BODY_QUESTION + MISSED_CONSOLIDATION

## Arquivo
`supabase/functions/zyon-chat/index.ts`

## Alterações

### Inserir 2 regras após UNNECESSARY_MIRRORING (linha 1223), antes do bloco "POLÍTICA DE DECISÃO" (linha 1225)

#### Regra 1: REPEATED_BODY_QUESTION
- Regex patterns para detectar perguntas sobre corpo/sensações físicas
- Condição: match em qualquer pattern E `turnCount > 3`
- Severidade: MEDIUM
- RewriteInstruction orientando substituir por pergunta de conexão, função ou consequência

#### Regra 2: MISSED_CONSOLIDATION
- Regex patterns exploratórios genéricos + patterns de consolidação
- Condição: `turnCount >= 7` E é exploratório E NÃO é consolidação
- Severidade: MEDIUM
- RewriteInstruction orientando avançar para consolidação

### Código a inserir (entre linhas 1223 e 1225):

```typescript
// REPEATED_BODY_QUESTION — pergunta de corpo após turno 3
const bodyQuestionPatterns = [
  /onde (no |em |pelo )?(seu |teu )?(corpo|peito|estômago|barriga|garganta|cabeça)/i,
  /onde (você )?(sente|percebe|carrega) (isso|essa|esse)/i,
  /(no|em que parte do) corpo/i,
  /como (essa?|isso) se manifesta/i,
  /fisicamente|sensação física|sente no corpo/i
];
if (turnCount > 3 && bodyQuestionPatterns.some(p => p.test(response))) {
  issues.push({ code: 'REPEATED_BODY_QUESTION', severity: 'MEDIUM', message: `Pergunta sobre corpo no turno ${turnCount}` });
  rewriteInstructions.push(`Pergunta sobre corpo/sensação física detectada no turno ${turnCount}. A instrução limita perguntas de corpo a 1 vez por conversa, preferencialmente nos turnos iniciais. SUBSTITUA por uma pergunta de CONEXÃO ('Essa sensação se parece com algo que você já viveu antes?'), FUNÇÃO ('Se esse sentimento pudesse falar, o que ele diria?') ou CONSEQUÊNCIA ('O que acontece se isso continuar assim?'). NÃO pergunte sobre corpo.`);
}

// MISSED_CONSOLIDATION — perguntas exploratórias genéricas após turno 7
const exploratoryPatterns = [
  /o que (você |isso )?(sente|te diz|te traz|toca em|revela)/i,
  /que sensação|que sentimento/i,
  /como (isso|essa|esse) te (faz sentir|afeta)/i
];
const consolidationPatterns = [
  /o que (você )?quer fazer com/i,
  /o que muda (em você|quando)/i,
  /agora que (você )?v(ê|iu|ê isso)/i,
  /quer (começar|continuar|mudar|responder diferente)/i,
  /vai continuar (mandando|governando|controlando)/i,
  /o que (essa descoberta|esse insight|essa conexão)/i,
  /próximo passo|daqui para frente|a partir de agora/i
];
const isExploratory = exploratoryPatterns.some(p => p.test(response));
const isConsolidating = consolidationPatterns.some(p => p.test(response));
if (turnCount >= 7 && isExploratory && !isConsolidating) {
  issues.push({ code: 'MISSED_CONSOLIDATION', severity: 'MEDIUM', message: `Turno ${turnCount}: perguntas exploratórias sem consolidação` });
  rewriteInstructions.push(`Turno ${turnCount}: a conversa já tem profundidade suficiente para CONSOLIDAR. Em vez de mais perguntas exploratórias ('o que você sente?', 'o que isso te diz?'), avance para consolidação. Exemplos: 'Você viu a conexão. O que quer fazer com essa descoberta?', 'Agora que enxerga isso, o que muda?', 'O medo vai continuar mandando, ou você quer responder diferente?'. CONFRONTE a mentira identificada com amor, não continue explorando.`);
}
```

## Nada mais muda
- Regras existentes intactas
- Mesma política de decisão (MEDIUM não bloqueia, gera rewrite)
- `turnCount` já disponível como parâmetro de `validateResponseIO`

