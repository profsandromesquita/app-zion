

# Plano: Tabelas de Sessão Diária e Missões IO (Fase 1)

## Migration SQL unica

### 1. Tabela `io_missions` (criada primeiro por ser referenciada)
- Schema conforme especificado: phase (1-7), week_range, title, description, type, difficulty, is_active
- Validation triggers para type e difficulty
- Validation trigger para phase (1-7)
- RLS: autenticados podem SELECT (is_active = true); admin/desenvolvedor CRUD completo
- Indices: phase, is_active, (phase + week_range)
- Trigger updated_at

### 2. Tabela `io_daily_sessions`
- Schema completo: check-in, missao (FK → io_missions), registro, 7 escalas IGI (0-10), feedback, reforco, meta
- UNIQUE(user_id, session_date)
- Validation trigger para escalas (0-10) e phase_at_session (1-7) — em vez de CHECK constraints
- RLS:
  - Usuarios podem SELECT, INSERT, UPDATE suas proprias sessoes
  - Admin/desenvolvedor podem SELECT todas
  - Service role full access
- Indices: user_id, session_date, phase_at_session
- Trigger updated_at

### 3. Seed de missoes
- 16 missoes iniciais conforme especificado (2-3 por fase, cobrindo as 7 fases)
- INSERT direto na migration (roda como superuser)

## Nao sera alterado
- Nenhuma tabela existente
- Nenhum edge function
- Nenhum comportamento do sistema

