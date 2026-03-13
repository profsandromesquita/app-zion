

# Tarefa 2: Reestruturar Feature Flags

## Contexto

A tabela `feature_flags` atual tem schema simples (`key`, `enabled`, `environment`) com 5 registros. O novo design exige colunas diferentes (`flag_name`, `flag_value`, `scope`, `scope_id`) e uma funcao cascata. A tabela sera dropada e recriada.

## Migration SQL

Uma unica migration que:

1. **DROP** da tabela `feature_flags` existente (5 flags de teste, sem dependencias em producao)
2. **CREATE TABLE** `feature_flags` com:
   - `id` uuid PK
   - `flag_name` text UNIQUE NOT NULL
   - `flag_value` boolean NOT NULL DEFAULT false
   - `scope` text NOT NULL DEFAULT 'global'
   - `scope_id` text (nullable)
   - `description` text
   - `created_at`, `updated_at` timestamptz
3. **Validation trigger** para `scope` (aceita apenas 'global', 'cohort', 'user', 'environment')
4. **Trigger** `updated_at`
5. **Indices** em `flag_name` e `scope`
6. **RLS**: admin/desenvolvedor = ALL; sem acesso para buscadores; service_role bypassa RLS nativamente
7. **Funcao** `get_feature_flag(p_flag_name, p_user_id, p_cohort_id)` SECURITY DEFINER com cascata user > cohort > global
8. **INSERT** 8 flags iniciais (todas false, scope global):
   - `io_enabled`, `io_phase_manager_enabled`, `io_prompt_adapter_enabled`, `io_daily_session_enabled`, `io_igi_enabled`, `io_safety_expanded_enabled`, `io_rag_domains_enabled`, `io_rag_foundation_required`

## Frontend

### `src/hooks/useFeatureFlag.ts`
- Atualizar queries: `key` → `flag_name`, `enabled` → `flag_value`
- `useAllFeatureFlags` ordena por `flag_name`

### `src/pages/admin/FeatureFlags.tsx`
- Atualizar referencias de coluna para `flag_name`, `flag_value`
- Exibir badge de `scope` nos cards
- Toggle atualiza `flag_value`

## Nao sera alterado
- Nenhum edge function
- Nenhuma outra tabela
- Nenhum comportamento do sistema

