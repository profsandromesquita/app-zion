
-- 1. Drop existing feature_flags table
DROP TABLE IF EXISTS public.feature_flags CASCADE;

-- 2. Create new feature_flags table
CREATE TABLE public.feature_flags (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  flag_name text UNIQUE NOT NULL,
  flag_value boolean NOT NULL DEFAULT false,
  scope text NOT NULL DEFAULT 'global',
  scope_id text,
  description text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- 3. Validation trigger for scope
CREATE OR REPLACE FUNCTION public.validate_feature_flag_scope()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO 'public'
AS $$
BEGIN
  IF NEW.scope NOT IN ('global', 'cohort', 'user', 'environment') THEN
    RAISE EXCEPTION 'Invalid scope: %. Must be one of: global, cohort, user, environment', NEW.scope;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_validate_feature_flag_scope
  BEFORE INSERT OR UPDATE ON public.feature_flags
  FOR EACH ROW
  EXECUTE FUNCTION public.validate_feature_flag_scope();

-- 4. Updated_at trigger
CREATE TRIGGER trg_feature_flags_updated_at
  BEFORE UPDATE ON public.feature_flags
  FOR EACH ROW
  EXECUTE FUNCTION public.trigger_set_updated_at();

-- 5. Indices
CREATE INDEX idx_feature_flags_flag_name ON public.feature_flags (flag_name);
CREATE INDEX idx_feature_flags_scope ON public.feature_flags (scope);

-- 6. RLS
ALTER TABLE public.feature_flags ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins and devs can manage flags"
  ON public.feature_flags
  FOR ALL
  TO authenticated
  USING (
    has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'desenvolvedor'::app_role)
  )
  WITH CHECK (
    has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'desenvolvedor'::app_role)
  );

-- 7. Helper function with cascade: user > cohort > global
CREATE OR REPLACE FUNCTION public.get_feature_flag(
  p_flag_name text,
  p_user_id uuid DEFAULT NULL,
  p_cohort_id text DEFAULT NULL
) RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_result boolean := false;
BEGIN
  -- First check user-specific flag
  IF p_user_id IS NOT NULL THEN
    SELECT flag_value INTO v_result
    FROM feature_flags
    WHERE flag_name = p_flag_name
      AND scope = 'user'
      AND scope_id = p_user_id::text;
    IF FOUND THEN RETURN v_result; END IF;
  END IF;

  -- Then check cohort flag
  IF p_cohort_id IS NOT NULL THEN
    SELECT flag_value INTO v_result
    FROM feature_flags
    WHERE flag_name = p_flag_name
      AND scope = 'cohort'
      AND scope_id = p_cohort_id;
    IF FOUND THEN RETURN v_result; END IF;
  END IF;

  -- Finally check global flag
  SELECT flag_value INTO v_result
  FROM feature_flags
  WHERE flag_name = p_flag_name
    AND scope = 'global';
  IF FOUND THEN RETURN v_result; END IF;

  RETURN false;
END;
$$;

-- 8. Insert initial flags
INSERT INTO public.feature_flags (flag_name, flag_value, scope, description) VALUES
  ('io_enabled', false, 'global', 'Habilita o modelo IO para o usuário'),
  ('io_phase_manager_enabled', false, 'global', 'Ativa o Phase Manager com hard rules do Método IO'),
  ('io_prompt_adapter_enabled', false, 'global', 'Ativa o Prompt Adapter com contrato IO'),
  ('io_daily_session_enabled', false, 'global', 'Ativa a sessão diária estruturada'),
  ('io_igi_enabled', false, 'global', 'Ativa o cálculo e exibição do IGI'),
  ('io_safety_expanded_enabled', false, 'global', 'Ativa a safety layer expandida para cenários IO'),
  ('io_rag_domains_enabled', false, 'global', 'Ativa retrieval por domínio com embedding semântico'),
  ('io_rag_foundation_required', false, 'global', 'Ativa exigência de fundamentação RAG para respostas substantivas');
