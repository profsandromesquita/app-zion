

# Mensagem Inicial Contextualizada pelo Estado IO

## Resumo
Modificar `sendWelcomeMessage` em `src/pages/Chat.tsx` para gerar saudações contextuais baseadas no estado IO do usuário quando `io_prompt_adapter_enabled = true`.

## Alterações em `src/pages/Chat.tsx`

### 1. Expandir query IO existente (linhas 82-94)
Mudar de `select('current_phase')` para `select('current_phase, streak_current, total_sessions, last_session_date')` e retornar o objeto completo em vez de só `current_phase`.

Criar nova variável derivada para manter compatibilidade com o header:
```typescript
const ioPhaseNumber = ioPhaseData?.current_phase || null;
```
Atualizar referência no header (linha 1106) para usar `ioPhaseNumber`.

### 2. Adicionar query de sessão de hoje (leve, junto às queries existentes)
```typescript
const { data: didSessionToday } = useQuery({
  queryKey: ['io-today-session', user?.id],
  queryFn: async () => {
    const today = new Date().toISOString().split('T')[0];
    const { data } = await supabase
      .from('io_daily_sessions')
      .select('id')
      .eq('user_id', user!.id)
      .eq('session_date', today)
      .eq('completed', true)
      .maybeSingle();
    return !!data;
  },
  staleTime: 5 * 60 * 1000,
  enabled: isIOEnabled && !!user?.id,
});
```

### 3. Adicionar funções de greeting (antes do componente)

`getPhaseTouch(phase)` — retorna frase contextual para fases 1-3.

`getContextualGreeting({ nome, totalSessions, hasConversations, didSessionToday, streakCurrent, currentPhase })` — árvore de decisão com 5 cenários conforme especificado na tarefa.

### 4. Modificar `sendWelcomeMessage` (linhas 320-356)
No bloco `else` (returning user, linha 334-336), adicionar condição:

```typescript
} else {
  if (isIOEnabled && ioPhaseData) {
    welcomeText = getContextualGreeting({
      nome: name,
      totalSessions: ioPhaseData.total_sessions || 0,
      hasConversations: !isFirstTime,
      didSessionToday: didSessionToday || false,
      streakCurrent: ioPhaseData.streak_current || 0,
      currentPhase: ioPhaseData.current_phase || 1,
    });
  } else {
    // Fallback: mensagem original
    welcomeText = `Olá${name ? `, ${name}` : ""}! Que bom conversar...`;
  }
}
```

Também atualizar o bloco `isFirstTime` para usar greeting IO quando flag ativa (Cenário 1 da árvore de decisão).

### 5. Comportamento
- Flag ON + dados IO: mensagem contextual (5 cenários)
- Flag OFF ou erro na query: mensagem original preservada
- Mesmo visual, apenas texto muda

## Arquivo alterado
- `src/pages/Chat.tsx`

