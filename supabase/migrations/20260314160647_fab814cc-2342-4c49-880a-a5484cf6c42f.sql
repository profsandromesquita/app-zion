CREATE OR REPLACE FUNCTION public.validate_observability_event_type()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO 'public'
AS $$
BEGIN
  IF NEW.event_type NOT IN (
    'chat_response', 'phase_transition', 'igi_update',
    'session_daily', 'rag_retrieval', 'validation_result',
    'rewrite', 'crisis_event', 'flag_check',
    'prompt_assembly'
  ) THEN
    RAISE EXCEPTION 'Invalid event_type: %. Must be one of: chat_response, phase_transition, igi_update, session_daily, rag_retrieval, validation_result, rewrite, crisis_event, flag_check, prompt_assembly', NEW.event_type;
  END IF;
  RETURN NEW;
END;
$$;