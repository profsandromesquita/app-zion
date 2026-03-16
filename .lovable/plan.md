

# Regras REPETITIVE_OPENING e UNNECESSARY_MIRRORING no Validator IO

## Resumo
Adicionar 2 regras MEDIUM no `validateResponseIO` para: (1) detectar início repetitivo "Você sente/percebe que..." após turnos iniciais, e (2) detectar espelhamento desnecessário em pedidos operacionais.

## Alterações

### 1. `supabase/functions/zyon-chat/index.ts` — Assinatura do validateResponseIO

Adicionar parâmetro `userMessage: string` à função (após `isRagFoundationRequired`):

```typescript
function validateResponseIO(
  response: string,
  intent: string,
  userContext: UserContext,
  turnCount: number,
  spiritualMaturity: string,
  ioPhase: number | null,
  hasRAGChunks: boolean,
  lowConfidenceRAG: boolean,
  isSessionDaily: boolean,
  crisisRiskLevel: string,
  isRagFoundationRequired: boolean = false,
  userMessage: string = ''    // NOVO
): ValidationResult {
```

### 2. Regra REPETITIVE_OPENING (após bloco SESSION_DEPTH_OVERFLOW, ~linha 1193)

```typescript
// REPETITIVE_OPENING — início mecânico repetitivo
const repetitiveOpeningRegex = /^Você (sente|percebe|está sentindo|nota|observa) que/i;
if (repetitiveOpeningRegex.test(response.trim()) && turnCount > 2) {
  issues.push({
    code: 'REPETITIVE_OPENING', severity: 'MEDIUM',
    message: 'Início repetitivo com "Você sente/percebe que..."'
  });
  rewriteInstructions.push(
    'VARIE o início da resposta. NÃO comece com "Você sente", "Você percebe" ou "Você está sentindo". Use uma das alternativas: (a) comece com uma observação usando as palavras do usuário como ponte ("Essa irritação com..."), (b) vá direto para a pergunta sem preâmbulo, ou (c) use reconhecimento breve ("Entendo." + pergunta).'
  );
}
```

### 3. Regra UNNECESSARY_MIRRORING (logo após REPETITIVE_OPENING)

```typescript
// UNNECESSARY_MIRRORING — espelhamento em pedido operacional
const operationalRequestRegex = /reformul|explica melhor|não entendi|muda de assunto|outra pergunta|pode repetir|não sei responder/i;
const mirroringOperationalRegex = /^Você (sente|está dizendo|está sentindo|percebe) que (não|n[aã]o)/i;
if (operationalRequestRegex.test(userMessage) && mirroringOperationalRegex.test(response.trim())) {
  issues.push({
    code: 'UNNECESSARY_MIRRORING', severity: 'MEDIUM',
    message: 'Espelhamento desnecessário em pedido operacional'
  });
  rewriteInstructions.push(
    'O usuário fez um PEDIDO OPERACIONAL. NÃO espelhe o pedido. Atenda diretamente: reformule a pergunta, explique de outra forma, ou mude de assunto conforme solicitado.'
  );
}
```

### 4. Atualizar chamada do validator (~linha 3131)

Passar `userMessage` (variável que já existe no escopo — é o texto da mensagem do usuário):

```typescript
validationResult = validateResponseIO(
  aiResponse, intent, userContext, turnCount, spiritualMaturity,
  ioPhaseContext?.current_phase || null,
  chunks.length > 0,
  lowConfidence,
  false,
  crisisResult?.risk_level || 'none',
  isRagFoundationRequired,
  userMessage   // NOVO
);
```

Preciso verificar o nome exato da variável da mensagem do usuário no escopo da chamada — provavelmente `message` ou `userMessage`.

## Arquivos alterados
- `supabase/functions/zyon-chat/index.ts` (4 pontos de edição: assinatura, 2 regras, chamada)

