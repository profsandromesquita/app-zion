

# Icebreakers Contextuais por Fase IO

## Resumo
Passar icebreakers baseados na fase IO para o `ConversationStarters` quando `io_prompt_adapter_enabled = true`, com prioridade sobre os starters personalizados existentes.

## Alterações

### 1. `src/hooks/usePersonalizedStarters.ts` — Exportar mapeamento de fases

Adicionar ao final do arquivo (antes do hook):

```typescript
export const PHASE_ICEBREAKERS: Record<number, StarterItem[]> = {
  1: [ /* 5 botões fase 1 */ ],
  2: [ /* 5 botões fase 2 */ ],
  // ... até 7
};
```

Incluir os 7 conjuntos de botões conforme especificado na tarefa. Fica neste arquivo porque é onde mora toda a lógica de starters.

### 2. `src/pages/Chat.tsx` — Selecionar starters por fase IO

Na linha ~1230 (authenticated ConversationStarters), alterar a prop `starters`:

```typescript
starters={
  isIOEnabled && ioPhaseNumber
    ? (PHASE_ICEBREAKERS[ioPhaseNumber] || undefined)
    : (isReturningUser ? personalizedStarters ?? undefined : undefined)
}
```

Lógica: se IO ativo e fase disponível → usar botões da fase. Senão → comportamento atual (personalizados ou defaults).

Importar `PHASE_ICEBREAKERS` de `usePersonalizedStarters`.

### 3. Instância anônima (linha ~1084) — sem alteração
Continua usando defaults (`starters={undefined}`).

## Arquivos alterados
- `src/hooks/usePersonalizedStarters.ts` (adicionar `PHASE_ICEBREAKERS`)
- `src/pages/Chat.tsx` (importar e usar na prop)

