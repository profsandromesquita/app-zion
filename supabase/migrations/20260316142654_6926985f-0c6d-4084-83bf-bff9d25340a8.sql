
-- 1. Recriar handle_new_user() com inicialização IO
CREATE OR REPLACE FUNCTION public.handle_new_user()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  _account_type text;
  _role app_role;
BEGIN
  _account_type := NEW.raw_user_meta_data ->> 'account_type';
  
  IF _account_type = 'igreja' THEN
    _role := 'igreja';
  ELSE
    _role := 'buscador';
  END IF;

  INSERT INTO public.profiles (id, email, nome)
  VALUES (NEW.id, NEW.email, NEW.raw_user_meta_data ->> 'nome');
  
  IF _account_type = 'igreja' THEN
    INSERT INTO public.user_profiles (id, onboarding_completed_at)
    VALUES (NEW.id, now());
  ELSE
    INSERT INTO public.user_profiles (id)
    VALUES (NEW.id);
  END IF;
  
  INSERT INTO public.user_roles (user_id, role)
  VALUES (NEW.id, _role);

  -- Inicialização IO: fase 1, transição inicial, cohort
  BEGIN
    INSERT INTO public.io_user_phase (
      user_id, current_phase, phase_entered_at,
      igi_current, streak_current, streak_best,
      total_sessions, last_session_date, igi_history
    ) VALUES (NEW.id, 1, now(), 0, 0, 0, 0, null, '[]'::jsonb);

    INSERT INTO public.io_phase_transitions (
      user_id, from_phase, to_phase, transition_type,
      triggered_by, notes, criteria_snapshot
    ) VALUES (NEW.id, 0, 1, 'initial_placement',
      'system', 'Auto-placement on signup', '{}'::jsonb);

    INSERT INTO public.user_cohorts (user_id, cohort_name)
    VALUES (NEW.id, 'io_active')
    ON CONFLICT (user_id) DO NOTHING;
  EXCEPTION WHEN OTHERS THEN
    RAISE WARNING 'io_user_phase init failed for %: %', NEW.id, SQLERRM;
  END;
  
  RETURN NEW;
END;
$function$;

-- 2. Backfill io_user_phase para usuários existentes
INSERT INTO public.io_user_phase (
  user_id, current_phase, phase_entered_at,
  igi_current, streak_current, streak_best,
  total_sessions, last_session_date, igi_history
)
SELECT 
  u.id, 1, now(), 0, 0, 0, 0, null, '[]'::jsonb
FROM auth.users u
WHERE NOT EXISTS (
  SELECT 1 FROM public.io_user_phase p WHERE p.user_id = u.id
);

-- 3. Backfill io_phase_transitions para usuários sem transição inicial
INSERT INTO public.io_phase_transitions (
  user_id, from_phase, to_phase, transition_type,
  triggered_by, notes, criteria_snapshot
)
SELECT 
  u.id, 0, 1, 'initial_placement',
  'system', 'Backfill on migration', '{}'::jsonb
FROM auth.users u
WHERE NOT EXISTS (
  SELECT 1 FROM public.io_phase_transitions t WHERE t.user_id = u.id
);

-- 4. Backfill user_cohorts para usuários sem cohort
INSERT INTO public.user_cohorts (user_id, cohort_name)
SELECT u.id, 'io_active'
FROM auth.users u
WHERE NOT EXISTS (
  SELECT 1 FROM public.user_cohorts c WHERE c.user_id = u.id
)
ON CONFLICT (user_id) DO NOTHING;
