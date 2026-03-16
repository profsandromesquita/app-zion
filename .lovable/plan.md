

# Geração Automática de Títulos para Conversas

## Resumo
Substituir a lógica atual de truncar a primeira mensagem como título por uma chamada a um edge function que usa IA (gemini-2.5-flash-lite) para gerar títulos curtos de 3-5 palavras descrevendo o tema emocional.

## O que existe hoje
- `updateSessionTitle` em `Chat.tsx` (linha 545) simplesmente faz `userMessage.substring(0, 50)` e salva como título
- A sidebar já exibe `session.title` com fallback para "Nova Conversa" — não precisa de alteração
- A tabela `chat_sessions` já tem coluna `title`

## Alterações

### 1. Criar edge function `generate-chat-title`
**Arquivo:** `supabase/functions/generate-chat-title/index.ts`

- Recebe `{ session_id, first_message }`
- Verifica se sessão já tem título diferente do padrão (se o título atual parece truncado/default, prossegue)
- Chama Lovable AI Gateway (`gemini-2.5-flash-lite`, temperature 0.3, max_tokens 20) com system prompt para gerar título de 3-5 palavras em português sobre o tema emocional
- Limpa resposta (trim, remove aspas, limita 50 chars)
- UPDATE `chat_sessions SET title = :titulo WHERE id = :session_id`
- Se LLM falhar, retorna sem alterar (título truncado permanece como fallback)

**Config:** Adicionar `[functions.generate-chat-title] verify_jwt = false` ao config.toml

### 2. Modificar `updateSessionTitle` em `Chat.tsx` (linha 545-551)
Manter o comportamento atual (título truncado salvo imediatamente como fallback), e adicionar chamada fire-and-forget ao edge function:

```typescript
const updateSessionTitle = async (sessionId: string, userMessage: string) => {
  // Fallback imediato: título truncado (aparece na sidebar instantaneamente)
  const title = userMessage.substring(0, 50) + (userMessage.length > 50 ? "..." : "");
  await supabase
    .from("chat_sessions")
    .update({ title, updated_at: new Date().toISOString() })
    .eq("id", sessionId);

  // Fire-and-forget: gerar título inteligente via IA
  if (userMessage.length > 10) {
    supabase.functions.invoke('generate-chat-title', {
      body: { session_id: sessionId, first_message: userMessage }
    }).catch(err => console.warn("Title generation failed:", err));

    // Refresh sidebar após delay para mostrar título gerado
    setTimeout(() => {
      refreshSidebarRef.current?.();
    }, 3000);
  }
};
```

### 3. Sidebar — sem alterações
A sidebar já renderiza `session.title || "Nova Conversa"` com truncate CSS. O título gerado pela IA substituirá o truncado automaticamente.

## Comportamento
- Usuário envia primeira mensagem → título truncado aparece imediatamente na sidebar
- 2-3 segundos depois → edge function atualiza com título inteligente → sidebar refresha
- Se IA falhar → título truncado permanece (zero impacto)
- Conversas existentes não são afetadas

## Arquivos alterados
- `supabase/functions/generate-chat-title/index.ts` (novo)
- `src/pages/Chat.tsx` (modificar `updateSessionTitle`)

