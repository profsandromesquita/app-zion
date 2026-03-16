INSERT INTO public.feature_flags (flag_name, flag_value, scope, description)
VALUES ('io_pm_observer_signals_enabled', false, 'global', 'Habilita sinais do observer (turn_insights) como apoio auxiliar na avaliação de progressão de fase. Quando ativo, hasSevereBlock pode bloquear avanço.')
ON CONFLICT DO NOTHING;