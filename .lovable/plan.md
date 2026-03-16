

# Plano: Adicionar seção "Validator Monitor" ao IO Dashboard

## Resumo
Nova seção no IODashboard com 3 componentes: métricas agregadas do validator, tabela de issues mais frequentes, e tabela cruzada fase × issue. Tudo baseado em `observability_logs` where `event_type = 'validation_result'`.

## Alteração: `src/pages/admin/IODashboard.tsx`

**Nova query** `io-dash-validator-monitor`:
- `observability_logs` where `event_type = 'validation_result'`, filtrado por `cutoff`
- Extrair de `event_data` (jsonb): `validator`, `io_phase`, `issues[]`, `needs_rewrite`, `did_rewrite`

**Componente `ValidatorMonitorSection`** (inserido após CohortComparisonSection):

1. **Métricas KPI** (4 cards em grid):
   - Total de validações
   - Validações IO vs Legacy (contagem + %)
   - Taxa de rewrite global, IO, Legacy
   - Alerta se taxa IO >> taxa Legacy (diferença > 20pp)

2. **Issues mais frequentes** (tabela):
   - Colunas: Code | Severidade | Contagem | % do total
   - Extrair issues de cada log, agrupar por code, ordenar desc
   - Severidade extraída do issue object ou mapeada

3. **Issues por fase** (tabela cruzada):
   - Linhas = fases IO (1-7)
   - Colunas = top issue codes
   - Células = contagem
   - Identifica fases problemáticas

Nenhum outro arquivo alterado. Read-only, sem migrations, sem edge functions.

