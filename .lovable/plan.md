

# Plano: Adicionar seção "Comparação de Cohorts" ao IO Dashboard

## Resumo
Adicionar uma nova seção ao final do IODashboard existente com tabela comparativa entre os 3 cohorts (control, io_shadow, io_active), reutilizando o `periodDays` já existente.

## Alteração: `src/pages/admin/IODashboard.tsx`

**Nova query** `io-dash-cohort-comparison`:
- Buscar todos os `user_cohorts` para agrupar user_ids por cohort_name
- Para cada grupo, calcular métricas a partir dos dados já disponíveis (sessions, phases, transitions) ou com queries dedicadas:
  - Usuários (count)
  - Sessões completadas no período (io_daily_sessions where user_id in group, completed=true, session_date >= cutoff)
  - Taxa de completude (completadas/total)
  - IGI médio (io_user_phase where user_id in group)
  - Streak médio (idem)
  - Avanços de fase (io_phase_transitions where user_id in group, transition_type=advance)
  - Regressões (transition_type=regression)
  - Taxa de rewrite (observability_logs where event_type='validation_result', user_id in group — extrair do metadata)

**Nova seção UI** após os alertas operacionais e antes dos links rápidos:
- Card "Comparação de Cohorts"
- Tabela com 3 colunas de dados (Controle, IO Shadow, IO Ativo) + coluna de métrica
- Badges comparativos: se IO Ativo > Controle em métricas positivas → badge verde "↑ melhor"; se menor → badge vermelho "↓ pior"
- Nota informativa: "Dados zerados para cohorts IO são esperados até o rollout (Fase 8)"

**Componente auxiliar** `CohortComparisonSection` definido no mesmo arquivo, recebendo `cutoff` e `periodDays` como props.

Nenhum outro arquivo alterado. Read-only, sem migrations, sem edge functions.

