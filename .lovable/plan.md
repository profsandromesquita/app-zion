

# Plano: IOJourneySection + Toggle no Profile

## Resumo

Criar `IOJourneySection` que exibe progresso IO com 7 fases, IGI, streak, gráfico mini e botão de sessão. No `Profile.tsx`, alternar entre `JourneySection` (flag off) e `IOJourneySection` (flag on).

## Arquivos

### 1. `src/components/profile/IOJourneySection.tsx` (NOVO)

Componente que recebe `userId: string` e:

- Query `io_user_phase` para dados da fase atual
- Query `io_daily_sessions` (últimas 5 + check se hoje já completou)
- Extrai `igi_history` (JSON array) para mini gráfico

**Seções renderizadas:**

a) **Barra de fases** — 7 dots horizontais com labels. Fase atual destacada (ring animado), completadas em verde, futuras esmaecidas. Nomes: Consciência, Limites, Identidade, Ritmo, Vitalidade, Governo, Plenitude.

b) **Cards de dados** — Grid 2x2:
- IGI atual (com tendência ↑↓→ comparando último vs penúltimo do `igi_history`)
- Streak (com 🔥)
- Total sessões
- Última sessão (formatada)

c) **Mini gráfico IGI** — SVG inline simples (polyline) com últimos 7-14 pontos do `igi_history`. Sem lib externa.

d) **Botão de sessão** — "Iniciar Sessão do Dia" → `/session` se hoje não completou; "Sessão de hoje ✅" desabilitado se completou.

e) **Descrição da fase** — Card com texto fixo por fase (1-7), conforme especificação.

**Design:** Mesmo padrão visual do `JourneySection` — Card com header gradient emerald, cores Zion, responsivo.

### 2. `src/pages/Profile.tsx` (ALTERAR)

Na seção `{isBuscador && journey && ...}` (linhas 447-450):

- Adicionar state `ioEnabled` com query à RPC `get_feature_flag` para `io_daily_session_enabled`
- Se `ioEnabled === true`: renderizar `<IOJourneySection userId={user.id} />`
- Se `ioEnabled === false`: renderizar `<JourneySection journey={journey} />` (atual)

### 3. `src/components/profile/JourneySection.tsx` — NÃO ALTERADO

## O que NÃO muda

- JourneySection.tsx
- Nenhum edge function
- Nenhuma tabela ou RLS

