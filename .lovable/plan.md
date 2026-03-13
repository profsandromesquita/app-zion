

# Plano: Tabelas Core do Método IO (Fase 1)

## Migration SQL unica

### 1. Funcao helper `get_io_phase_name`
- Funcao IMMUTABLE que mapeia integer 1-7 para nomes das fases

### 2. Tabela `io_user_phase`
- Schema conforme especificado (user_id UNIQUE, current_phase 1-7, igi_current, streak, etc.)
- `phase_name` como coluna GENERATED ALWAYS AS (get_io_phase_name(current_phase)) STORED
- Validation trigger para current_phase (1-7) em vez de CHECK constraint
- Trigger updated_at
- RLS:
  - Usuarios podem SELECT proprio registro
  - Admins/desenvolvedores podem SELECT e UPDATE todos
  - Service role bypassa RLS nativamente
  - Sem INSERT/UPDATE/DELETE para buscadores (exceto leitura)

### 3. Tabela `io_phase_transitions`
- Schema conforme especificado (from_phase, to_phase, transition_type, criteria_snapshot, triggered_by)
- Validation triggers para transition_type e triggered_by
- Validation trigger para from_phase/to_phase (1-7)
- RLS:
  - Usuarios podem SELECT suas transicoes
  - Admins/desenvolvedores podem SELECT e INSERT
  - Service role pode INSERT
  - Sem UPDATE/DELETE para ninguem (imutavel)
- Indices em user_id, created_at, transition_type

### 4. Seed de usuarios existentes
- INSERT INTO io_user_phase SELECT de auth.users (current_phase=1, defaults)
- INSERT INTO io_phase_transitions para cada usuario (initial_placement)

## Nao sera alterado
- Nenhuma tabela existente
- Nenhum edge function
- Nenhum comportamento do sistema
- user_profiles.fase_jornada permanece intocado

## Nota tecnica
Postgres suporta GENERATED ALWAYS AS para colunas computadas, o que permite `phase_name` ser derivado automaticamente de `current_phase` sem funcao separada no app. A funcao `get_io_phase_name` tambem fica disponivel para uso em queries e edge functions.

