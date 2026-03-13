

# Plano: Pagina Admin IO Overview (/admin/io-overview)

## Arquitetura

Uma unica pagina nova `src/pages/admin/IOOverview.tsx` seguindo o padrao exato de Cohorts/FeatureFlags:
- `RoleRoute` com `allowedRoles={["admin", "desenvolvedor"]}`
- `AdminLayout` wrapper
- Queries via `@tanstack/react-query` + supabase client

## Implementacao

### 1. Pagina `src/pages/admin/IOOverview.tsx`

**Visao geral (topo):**
- 3 cards: Total usuarios IO, IGI medio geral, Streak medio
- 7 mini-cards/barras mostrando distribuicao por fase (contagem por current_phase 1-7)

**Lista de usuarios:**
- Query `io_user_phase` com join manual para `profiles` (nome, email) e `user_cohorts` (cohort_name)
- Tabela com colunas: Nome, Email, Fase (ex: "1 — Consciencia"), IGI, Streak, Total Sessoes, Ultima Sessao, Cohort
- Clique em linha abre dialog de detalhe

**Dialog de detalhe do usuario:**
- Query `io_phase_transitions` filtrado por user_id, ordem cronologica
- Query `io_daily_sessions` ultimas 10, com escalas
- Grafico simples de IGI ao longo do tempo usando barras CSS (sem lib externa), baseado no campo `igi_history` jsonb do `io_user_phase`

### 2. Rota em `src/App.tsx`
- Adicionar `<Route path="/admin/io-overview" element={<IOOverview />} />`

### 3. Sidebar em `src/components/admin/AdminLayout.tsx`
- Adicionar item `{ to: "/admin/io-overview", icon: Activity, label: "IO Overview" }` no navItems

### 4. Nenhuma alteracao em tabelas, edge functions ou comportamento existente

## Componentes utilizados
- Card, Badge, Table (shadcn existentes)
- Dialog para detalhe do usuario
- Loader2 para loading states
- Activity icon (lucide) para sidebar

