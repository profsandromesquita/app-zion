

# Plano: Auto-criar io_user_phase no signup + backfill

## Alteração única: Migration SQL

### 1. Atualizar `handle_new_user()` trigger

Adicionar 3 INSERTs dentro de um bloco `BEGIN/EXCEPTION` para não quebrar o signup:

```sql
-- Dentro do trigger, após o INSERT em user_roles:
BEGIN
  INSERT INTO public.io_user_phase (
    user_id, current_phase, phase_entered_at,
    igi_current, streak_current, streak_best,
    total_sessions, last_session_date, igi_history
  ) VALUES (NEW.id, 1, now(), 0, 0, 0, 0, null, '[]'::jsonb);

  INSERT INTO public.io_phase_transitions (
    user_id, from_phase, to_phase, transition_type, triggered_by, notes
  ) VALUES (NEW.id, 0, 1, 'initial_placement', 'system', 'Auto-placement on signup');

  INSERT INTO public.user_cohorts (user_id, cohort_name)
  VALUES (NEW.id, 'io_active')
  ON CONFLICT (user_id) DO NOTHING;
EXCEPTION WHEN OTHERS THEN
  RAISE WARNING 'io_user_phase init failed for %: %', NEW.id, SQLERRM;
END;
```

### 2. Backfill na mesma migration

Inserir `io_user_phase`, `io_phase_transitions` e `user_cohorts` para todos os usuários existentes que não os têm.

### Arquivo alterado
- Nenhum arquivo de código — apenas uma migration SQL

### Segurança
- O bloco `EXCEPTION WHEN OTHERS` garante que falha na inicialização IO nunca bloqueia o signup
- `ON CONFLICT` no user_cohorts previne duplicatas
- `NOT EXISTS` no backfill previne duplicatas

