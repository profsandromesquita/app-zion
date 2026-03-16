
ALTER TABLE public.diary_entries ADD COLUMN io_analysis jsonb DEFAULT NULL;
ALTER TABLE public.diary_entries ADD COLUMN io_phase_at_entry integer DEFAULT NULL;

INSERT INTO public.feature_flags (flag_name, flag_value, scope, description)
VALUES ('io_diary_integration_enabled', false, 'global', 'Habilita análise do diário espiritual e integração com o modelo IO');
