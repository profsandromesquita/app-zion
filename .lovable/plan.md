

# Plano: Tabelas de Observabilidade e Cohorts (Fase 0)

## Tarefa 1 — Tabela `observability_logs`

Migration SQL:
- CREATE TABLE com id, session_id (text), user_id (uuid), event_type (text), event_data (jsonb), flags_active (jsonb), latency_ms (integer), created_at
- Validation trigger para event_type (aceita apenas os 9 valores especificados)
- Indices em created_at, event_type, user_id, session_id
- RLS: admin/desenvolvedor podem SELECT e INSERT; sem acesso para buscadores
- COMMENT ON TABLE com nota sobre archival de 90 dias

## Tarefa 2 — Tabela `user_cohorts`

Migration SQL:
- CREATE TABLE com id, user_id (uuid, UNIQUE), cohort_name (text), assigned_at, assigned_by (text, default 'system'), notes
- Validation trigger para cohort_name (aceita apenas 'control', 'io_shadow', 'io_active')
- RLS: admin/desenvolvedor podem SELECT, INSERT, UPDATE; sem acesso para buscadores
- INSERT de todos os usuarios existentes em auth.users no cohort 'control' (via INSERT ... SELECT dentro da migration, usando SECURITY DEFINER ou feito na migration que roda como superuser)

## Tarefa 3 — Pagina Admin `/admin/cohorts`

- Nova pagina `src/pages/admin/Cohorts.tsx` seguindo padrao do FeatureFlags
- Lista usuarios com nome/email (join com profiles), cohort atual, dropdown para mudar
- Contadores por cohort no topo
- Rota adicionada em App.tsx
- Link adicionado no AdminLayout sidebar

## Arquivos afetados

1. Nova migration SQL (tabelas + triggers + indices + RLS + seed cohorts)
2. `src/pages/admin/Cohorts.tsx` (novo)
3. `src/App.tsx` (nova rota)
4. `src/components/admin/AdminLayout.tsx` (novo link no sidebar)

## Nao sera alterado

- Nenhum edge function
- Nenhuma tabela existente
- Nenhum comportamento do sistema

