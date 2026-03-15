

# Plano: Pontos de Entrada para Sessão Diária

## Resumo

Adicionar banner no chat e item na sidebar para navegar a `/session`, condicionais à flag `io_daily_session_enabled` e à sessão do dia não estar concluída.

## Arquivos

### 1. `src/components/chat/DailySessionBanner.tsx` (NOVO)

Componente leve que:
- Recebe `userId: string`
- Usa `useFeatureFlag("io_daily_session_enabled")` para verificar flag
- Query `io_daily_sessions` filtrando `user_id` + `session_date = today` + `completed = true`
- Se flag off OU sessão já completa → render null
- Estado local `dismissed` (useState, não persistido)
- Se dismissed → render null
- Renderiza banner sutil (mesmo padrão visual do `WelcomeBackBanner` / `PendingApplicationBanner`):
  - `☀️ Sua sessão do dia está disponível`
  - Botão "Iniciar sessão" → `navigate("/session")`
  - Botão X para dispensar
- Posicionado entre os banners existentes e o header no Chat.tsx

### 2. `src/pages/Chat.tsx` (ALTERAR)

Após o `PendingApplicationBanner` (linha ~1064), adicionar:
```tsx
{user && <DailySessionBanner userId={user.id} />}
```

### 3. `src/components/chat/ChatSidebar.tsx` (ALTERAR)

No footer, entre "Diário Espiritual" e `InstallAppButton` (linhas 500-509):
- Importar `useFeatureFlag`
- Adicionar query para verificar se sessão de hoje está completa
- Renderizar item condicional:
  - Ícone: `Sun` (lucide)
  - Label: "Sessão Diária"
  - `onClick={() => navigate("/session")`
  - Badge: dot verde `•` se sessão não feita hoje
  - Visível apenas quando `io_daily_session_enabled = true`

## O que NÃO muda

- Nenhum edge function
- Comportamento do chat
- Profile / Session page

