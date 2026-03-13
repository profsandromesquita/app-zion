

# Plano: Tabela io_scale_entries + Funções IGI (Fase 1)

## Migration SQL unica

### 1. Tabela `io_scale_entries`
- Schema conforme especificado: user_id, session_id (FK → io_daily_sessions), dimension, value (0-10)
- UNIQUE(session_id, dimension)
- Validation trigger para dimension (7 valores) e value (0-10)
- RLS: usuarios SELECT/INSERT proprio; admin/dev SELECT; service_role full
- Indices: user_id, session_id, dimension

### 2. Funcao `calculate_igi`
- IMMUTABLE, aceita 7 parametros nullable
- Grupo 1 (clareza, regulacao, identidade) = 50%
- Grupo 2 (constancia, vitalidade, agencia, autonomia) = 50%
- Trata NULLs e divisao por zero

### 3. Funcao `calculate_session_igi`
- STABLE, recebe session_id, busca escalas de io_daily_sessions, chama calculate_igi

## Nao sera alterado
- Nenhuma tabela existente
- Nenhum edge function

