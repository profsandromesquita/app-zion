

# Plano: Fase 5 — Sessão Diária Estruturada (Página /session)

## Resumo

Criar a página `/session` com 7 steps em stepper, protegida por auth e feature flag `io_daily_session_enabled`. Usa tabelas existentes (`io_daily_sessions`, `io_missions`, `io_scale_entries`, `io_user_phase`). Nenhum edge function existente é alterado. O Step 5 (Feedback) usará fallback genérico até o edge function `io-session-feedback` ser criado no Bloco 2.

## Arquivos a criar/alterar

### 1. `src/pages/Session.tsx` (NOVO — ~600 linhas)

Página principal com state machine de 7 steps:

```text
┌─────────────────────────────────────┐
│  Stepper: ① ② ③ ④ ⑤ ⑥ ⑦          │
├─────────────────────────────────────┤
│                                     │
│         [Step Content]              │
│                                     │
├─────────────────────────────────────┤
│              [Botão]                │
└─────────────────────────────────────┘
```

**Lógica de inicialização:**
- `useAuth()` — redireciona para `/auth` se não logado
- RPC `get_feature_flag({ p_flag_name: 'io_daily_session_enabled', p_user_id })` — se false, redireciona `/chat` com toast
- Query `io_daily_sessions` para hoje (`session_date = today`)
  - Se existe + `completed = true` → tela de resumo
  - Se existe + incompleta → retomar (inferir step pelos campos preenchidos)
  - Se não existe → step 1
- Query `io_user_phase` para fase atual
- Guardar `startTime = Date.now()` para calcular duração

**Step 1 — Check-in:**
- Grid 3x2 de mood cards (emoji + label), seleção visual
- Ao avançar: upsert `io_daily_sessions` com `check_in_mood`, `check_in_completed = true`, `phase_at_session`

**Step 2 — Missão:**
- Calcular `week_range` baseado em `phase_entered_at`
- Query `io_missions` filtrado por `phase`, `week_range`, `is_active`
- Excluir últimas 3 `mission_id` de sessões anteriores
- Seleção aleatória, salvar `mission_id` no registro
- Card com título, descrição, badges de tipo e dificuldade

**Step 3 — Registro:**
- Textarea livre, mínimo 10 chars
- Salvar em `registro_text`, marcar `mission_completed = true`

**Step 4 — Escalas:**
- Dimensões dinâmicas por fase (3 em fase 1-2, 4 em fase 3, 7 em fase 4+)
- Slider 0-10 por dimensão com label e descrição
- Salvar nas colunas `escala_*` da sessão + insert em `io_scale_entries`

**Step 5 — Feedback:**
- Tentar invocar `io-session-feedback` (se existir)
- Fallback genérico: frase motivacional fixa
- Salvar em `feedback_generated`

**Step 6 — Reforço Identitário:**
- Card destacado com frase fixa por fase (1-7)
- Salvar em `reforco_identitario`

**Step 7 — Conclusão:**
- RPC `calculate_igi` com as escalas
- Calcular streak (comparar `last_session_date` com ontem)
- Atualizar `io_user_phase`: `igi_current`, append `igi_history`, streak, `total_sessions`
- Marcar sessão `completed = true`, `igi_at_session`, `duration_seconds`
- Invocar `io-phase-manager` com `action: 'evaluate'`
- Exibir resultado: celebração se avançou, resumo se manteve
- Botões: "Voltar ao chat", "Ver minha jornada"

### 2. `src/components/session/SessionStepper.tsx` (NOVO)

Componente de stepper horizontal com 7 dots/números. Step atual destacado com cor primária, completados com check, futuros em cinza. Responsivo.

### 3. `src/components/session/SessionComplete.tsx` (NOVO)

Tela de "Sessão já concluída" com resumo: mood, missão, IGI, streak. Botões para chat/profile.

### 4. `src/App.tsx` (ALTERAR)

Adicionar import e rota:
```typescript
import Session from "./pages/Session";
// Na Routes:
<Route path="/session" element={<Session />} />
```

## Detalhes técnicos

- **RLS**: Tabelas `io_daily_sessions` e `io_scale_entries` já têm RLS para service_role insert. Precisaremos verificar se `authenticated` pode inserir. Se não, usaremos as policies existentes ou adicionaremos via migration.
- **Feature flag**: Usa `supabase.rpc('get_feature_flag', { p_flag_name: 'io_daily_session_enabled', p_user_id: user.id })` — mesma pattern do zyon-chat
- **IGI**: RPC `calculate_igi` já existe com params `p_clareza`, `p_regulacao`, etc.
- **Phase Manager**: Invoke via `supabase.functions.invoke('io-phase-manager', { body: { action: 'evaluate', user_id } })`
- **Animações**: `transition-all` com opacity/translate entre steps
- **Mobile-first**: Cards full-width em mobile, max-w-lg centralizado em desktop

## Migration necessária

Verificar RLS de `io_daily_sessions` e `io_scale_entries` para permitir insert/update por `authenticated` users (próprios registros). Se não existirem, criar policies:
- Users can insert own daily sessions (`user_id = auth.uid()`)
- Users can update own daily sessions (`user_id = auth.uid()`)
- Users can view own daily sessions
- Users can insert own scale entries
- Users can view own scale entries

## O que NÃO muda

- Nenhum edge function existente
- Chat, Profile, Diary — intocados
- Tabelas existentes — apenas RLS se necessário

