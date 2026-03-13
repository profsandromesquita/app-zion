
-- =============================================
-- TAREFA 1: Tabela observability_logs
-- =============================================

CREATE TABLE public.observability_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id text,
  user_id uuid,
  event_type text NOT NULL,
  event_data jsonb NOT NULL DEFAULT '{}'::jsonb,
  flags_active jsonb,
  latency_ms integer,
  created_at timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.observability_logs IS 'Logs estruturados do pipeline IO. Logs com mais de 90 dias podem ser arquivados. Política de archival a implementar futuramente.';

-- Validation trigger for event_type
CREATE OR REPLACE FUNCTION public.validate_observability_event_type()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO 'public'
AS $$
BEGIN
  IF NEW.event_type NOT IN (
    'chat_response', 'phase_transition', 'igi_update',
    'session_daily', 'rag_retrieval', 'validation_result',
    'rewrite', 'crisis_event', 'flag_check'
  ) THEN
    RAISE EXCEPTION 'Invalid event_type: %. Must be one of: chat_response, phase_transition, igi_update, session_daily, rag_retrieval, validation_result, rewrite, crisis_event, flag_check', NEW.event_type;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_validate_observability_event_type
  BEFORE INSERT OR UPDATE ON public.observability_logs
  FOR EACH ROW
  EXECUTE FUNCTION public.validate_observability_event_type();

-- Indices
CREATE INDEX idx_observability_logs_created_at ON public.observability_logs (created_at);
CREATE INDEX idx_observability_logs_event_type ON public.observability_logs (event_type);
CREATE INDEX idx_observability_logs_user_id ON public.observability_logs (user_id);
CREATE INDEX idx_observability_logs_session_id ON public.observability_logs (session_id);

-- RLS
ALTER TABLE public.observability_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins and devs can select observability logs"
  ON public.observability_logs
  FOR SELECT
  TO authenticated
  USING (
    has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'desenvolvedor'::app_role)
  );

CREATE POLICY "Admins and devs can insert observability logs"
  ON public.observability_logs
  FOR INSERT
  TO authenticated
  WITH CHECK (
    has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'desenvolvedor'::app_role)
  );

CREATE POLICY "Service role can insert observability logs"
  ON public.observability_logs
  FOR INSERT
  TO service_role
  WITH CHECK (true);

-- =============================================
-- TAREFA 2: Tabela user_cohorts
-- =============================================

CREATE TABLE public.user_cohorts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL UNIQUE,
  cohort_name text NOT NULL DEFAULT 'control',
  assigned_at timestamptz NOT NULL DEFAULT now(),
  assigned_by text NOT NULL DEFAULT 'system',
  notes text
);

-- Validation trigger for cohort_name
CREATE OR REPLACE FUNCTION public.validate_cohort_name()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO 'public'
AS $$
BEGIN
  IF NEW.cohort_name NOT IN ('control', 'io_shadow', 'io_active') THEN
    RAISE EXCEPTION 'Invalid cohort_name: %. Must be one of: control, io_shadow, io_active', NEW.cohort_name;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_validate_cohort_name
  BEFORE INSERT OR UPDATE ON public.user_cohorts
  FOR EACH ROW
  EXECUTE FUNCTION public.validate_cohort_name();

-- RLS
ALTER TABLE public.user_cohorts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins and devs can manage cohorts"
  ON public.user_cohorts
  FOR ALL
  TO authenticated
  USING (
    has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'desenvolvedor'::app_role)
  )
  WITH CHECK (
    has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'desenvolvedor'::app_role)
  );

CREATE POLICY "Service role can select cohorts"
  ON public.user_cohorts
  FOR SELECT
  TO service_role
  USING (true);

-- Seed all existing users into 'control' cohort
INSERT INTO public.user_cohorts (user_id, cohort_name, assigned_by)
SELECT id, 'control', 'system'
FROM auth.users
ON CONFLICT (user_id) DO NOTHING;
