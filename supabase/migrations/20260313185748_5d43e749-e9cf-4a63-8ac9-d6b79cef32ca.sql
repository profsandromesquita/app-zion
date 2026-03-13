
-- ============================================================
-- 1. Tabela io_scale_entries
-- ============================================================
CREATE TABLE public.io_scale_entries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  session_id uuid NOT NULL REFERENCES public.io_daily_sessions(id) ON DELETE CASCADE,
  dimension text NOT NULL,
  value integer NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT uq_scale_session_dimension UNIQUE (session_id, dimension)
);

-- Indices
CREATE INDEX idx_io_scale_entries_user_id ON public.io_scale_entries(user_id);
CREATE INDEX idx_io_scale_entries_session_id ON public.io_scale_entries(session_id);
CREATE INDEX idx_io_scale_entries_dimension ON public.io_scale_entries(dimension);

-- Validation trigger
CREATE OR REPLACE FUNCTION public.validate_io_scale_entry()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO 'public'
AS $$
BEGIN
  IF NEW.dimension NOT IN ('clareza', 'regulacao', 'identidade', 'constancia', 'vitalidade', 'agencia', 'autonomia') THEN
    RAISE EXCEPTION 'Invalid dimension: %. Must be one of: clareza, regulacao, identidade, constancia, vitalidade, agencia, autonomia', NEW.dimension;
  END IF;
  IF NEW.value < 0 OR NEW.value > 10 THEN
    RAISE EXCEPTION 'value must be between 0 and 10, got %', NEW.value;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_validate_io_scale_entry
  BEFORE INSERT OR UPDATE ON public.io_scale_entries
  FOR EACH ROW EXECUTE FUNCTION public.validate_io_scale_entry();

-- RLS
ALTER TABLE public.io_scale_entries ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can select own scale entries"
  ON public.io_scale_entries FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "Users can insert own scale entries"
  ON public.io_scale_entries FOR INSERT
  TO authenticated
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "Admins and devs can select all scale entries"
  ON public.io_scale_entries FOR SELECT
  TO authenticated
  USING (has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'desenvolvedor'));

CREATE POLICY "Service role full access io_scale_entries"
  ON public.io_scale_entries FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- ============================================================
-- 2. Função calculate_igi
-- ============================================================
CREATE OR REPLACE FUNCTION public.calculate_igi(
  p_clareza integer DEFAULT NULL,
  p_regulacao integer DEFAULT NULL,
  p_identidade integer DEFAULT NULL,
  p_constancia integer DEFAULT NULL,
  p_vitalidade integer DEFAULT NULL,
  p_agencia integer DEFAULT NULL,
  p_autonomia integer DEFAULT NULL
) RETURNS decimal
LANGUAGE plpgsql
IMMUTABLE
AS $$
DECLARE
  v_group1_count integer := 0;
  v_group1_sum decimal := 0;
  v_group2_count integer := 0;
  v_group2_sum decimal := 0;
  v_group1_avg decimal := 0;
  v_group2_avg decimal := 0;
BEGIN
  -- Grupo 1: Fases 1-3 (50% do peso)
  IF p_clareza IS NOT NULL THEN
    v_group1_sum := v_group1_sum + p_clareza;
    v_group1_count := v_group1_count + 1;
  END IF;
  IF p_regulacao IS NOT NULL THEN
    v_group1_sum := v_group1_sum + p_regulacao;
    v_group1_count := v_group1_count + 1;
  END IF;
  IF p_identidade IS NOT NULL THEN
    v_group1_sum := v_group1_sum + p_identidade;
    v_group1_count := v_group1_count + 1;
  END IF;

  -- Grupo 2: Fases 4-7 (50% do peso)
  IF p_constancia IS NOT NULL THEN
    v_group2_sum := v_group2_sum + p_constancia;
    v_group2_count := v_group2_count + 1;
  END IF;
  IF p_vitalidade IS NOT NULL THEN
    v_group2_sum := v_group2_sum + p_vitalidade;
    v_group2_count := v_group2_count + 1;
  END IF;
  IF p_agencia IS NOT NULL THEN
    v_group2_sum := v_group2_sum + p_agencia;
    v_group2_count := v_group2_count + 1;
  END IF;
  IF p_autonomia IS NOT NULL THEN
    v_group2_sum := v_group2_sum + p_autonomia;
    v_group2_count := v_group2_count + 1;
  END IF;

  -- Calcular médias
  IF v_group1_count > 0 THEN
    v_group1_avg := v_group1_sum / v_group1_count;
  END IF;
  IF v_group2_count > 0 THEN
    v_group2_avg := v_group2_sum / v_group2_count;
  END IF;

  -- Nenhuma escala preenchida
  IF v_group1_count = 0 AND v_group2_count = 0 THEN
    RETURN 0.0;
  END IF;

  -- Se um grupo não tem dados, o outro assume peso total
  IF v_group1_count = 0 THEN RETURN ROUND(v_group2_avg, 2); END IF;
  IF v_group2_count = 0 THEN RETURN ROUND(v_group1_avg, 2); END IF;

  RETURN ROUND((0.50 * v_group1_avg) + (0.50 * v_group2_avg), 2);
END;
$$;

-- ============================================================
-- 3. Função calculate_session_igi
-- ============================================================
CREATE OR REPLACE FUNCTION public.calculate_session_igi(p_session_id uuid)
RETURNS decimal
LANGUAGE plpgsql
STABLE
AS $$
DECLARE
  v_session record;
BEGIN
  SELECT escala_clareza, escala_regulacao, escala_identidade,
         escala_constancia, escala_vitalidade, escala_agencia, escala_autonomia
  INTO v_session
  FROM public.io_daily_sessions
  WHERE id = p_session_id;

  IF NOT FOUND THEN RETURN 0.0; END IF;

  RETURN public.calculate_igi(
    v_session.escala_clareza, v_session.escala_regulacao, v_session.escala_identidade,
    v_session.escala_constancia, v_session.escala_vitalidade,
    v_session.escala_agencia, v_session.escala_autonomia
  );
END;
$$;
