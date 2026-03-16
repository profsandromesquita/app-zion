

# Plano: Criar página /admin/io-dashboard

## Resumo
Nova página admin com métricas agregadas do Método IO: cards de KPIs, gráficos de sessões/dia e distribuição por fase, alertas operacionais e top missões. Tudo read-only, usando tabelas existentes com RLS admin já configurado.

## Arquivos a criar/alterar

### 1. Criar `src/pages/admin/IODashboard.tsx`
Página completa com:

**Estado**: `periodDays` (7 | 30 | 90 | null para "todo período"), controla todas as queries.

**Queries (useQuery)**:
- `io_user_phase` → todas as linhas (IGI médio, streak médio, distribuição por fase, IGI por fase)
- `io_daily_sessions` → filtrado por `session_date >= cutoff` (sessões completadas, taxa completude, sessões/dia)
- `io_phase_transitions` → filtrado por `created_at >= cutoff` (avanços/regressões/overrides)
- `io_missions` → join manual com sessions para top missões

**Variação vs período anterior**: Para cards com ↑↓, consultar o período anterior equivalente (ex: 7 dias anteriores) e comparar.

**Seções UI**:
1. Header com título + seletor de período (4 botões toggle)
2. Grid 3×2 de cards: Usuários ativos, Sessões completadas, Taxa completude, IGI médio, Streak médio, Transições
3. Gráfico de barras CSS (sessões/dia) — barras `div` com altura proporcional, sem lib externa
4. Distribuição por fase — 7 barras horizontais com label e percentual
5. IGI médio por fase — 7 mini-cards com valor
6. Alertas operacionais — card com lista de alertas (streak=0, regressões, incompletas hoje, taxa<60%)
7. Top missões — tabela com título, fase, tipo, atribuídas, completadas
8. Links rápidos para IO Overview, Cohorts, Feature Flags

**Padrão visual**: `RoleRoute` + `AdminLayout`, Skeleton loading, mesmo estilo de cards/tables do IOOverview e AdminDashboard.

### 2. Alterar `src/components/admin/AdminLayout.tsx`
Adicionar nav item ANTES de "IO Overview":
```typescript
{ to: "/admin/io-dashboard", icon: BarChart3, label: "IO Dashboard" },
```
Importar `BarChart3` de lucide-react.

### 3. Alterar `src/App.tsx`
Adicionar rota:
```typescript
import IODashboard from "./pages/admin/IODashboard";
// ...
<Route path="/admin/io-dashboard" element={<IODashboard />} />
```

## Dados e queries

Todas as queries usam o cliente Supabase com RLS admin já existente. Nenhuma tabela ou função será criada/alterada.

```text
io_user_phase ──→ fase atual, IGI, streak (todos os usuários)
io_daily_sessions ──→ sessões no período (filtro por session_date)
io_phase_transitions ──→ avanços/regressões (filtro por created_at)
io_missions ──→ catálogo (join client-side com sessions.mission_id)
```

## Escopo restrito
- Apenas leitura
- Nenhum edge function alterado
- Nenhuma tabela alterada
- Nenhuma migration

