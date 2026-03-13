
-- 1. Helper function for phase name mapping
CREATE OR REPLACE FUNCTION public.get_io_phase_name(p_phase integer)
RETURNS text
LANGUAGE plpgsql
IMMUTABLE
AS $$
BEGIN
  RETURN CASE p_phase
    WHEN 1 THEN 'Consciência'
    WHEN 2 THEN 'Limites'
    WHEN 3 THEN 'Identidade'
    WHEN 4 THEN 'Ritmo'
    WHEN 5 THEN 'Vitalidade'
    WHEN 6 THEN 'Governo'
    WHEN 7 THEN 'Plenitude'
    ELSE 'Desconhecida'
  END;
END;
$$;

-- 2. Table io_user_phase
CREATE TABLE public.io_user_phase (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  current_phase integer NOT NULL DEFAULT 1,
  phase_name text GENERATED ALWAYS AS (public.get_io_phase_name(current_phase)) STORED,
  phase_entered_at timestamptz NOT NULL DEFAULT now(),
  phase_criteria_met jsonb NOT NULL DEFAULT '{}'::jsonb,
  igi_current decimal NOT NULL DEFAULT 0.0,
  igi_history jsonb NOT NULL DEFAULT '[]'::jsonb,
  streak_current integer NOT NULL DEFAULT 0,
  streak_best integer NOT NULL DEFAULT 0,
  last_session_date date,
  total_sessions integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Validation trigger for current_phase (1-7)
CREATE OR REPLACE FUNCTION public.validate_io_phase_range()
RETURNS trigger LANGUAGE plpgsql SET search_path TO 'public' AS $$
BEGIN
  IF NEW.current_phase < 1 OR NEW.current_phase > 7 THEN
    RAISE EXCEPTION 'current_phase must be between 1 and 7, got %', NEW.current_phase;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_validate_io_user_phase
  BEFORE INSERT OR UPDATE ON public.io_user_phase
  FOR EACH ROW EXECUTE FUNCTION public.validate_io_phase_range();

-- updated_at trigger
CREATE TRIGGER trg_io_user_phase_updated_at
  BEFORE UPDATE ON public.io_user_phase
  FOR EACH ROW EXECUTE FUNCTION public.trigger_set_updated_at();

-- RLS
ALTER TABLE public.io_user_phase ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own phase"
  ON public.io_user_phase FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "Admins and devs can view all phases"
  ON public.io_user_phase FOR SELECT
  TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'desenvolvedor'::app_role));

CREATE POLICY "Admins and devs can update all phases"
  ON public.io_user_phase FOR UPDATE
  TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'desenvolvedor'::app_role));

CREATE POLICY "Service role full access io_user_phase"
  ON public.io_user_phase FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- 3. Table io_phase_transitions (immutable audit log)
CREATE TABLE public.io_phase_transitions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  from_phase integer NOT NULL,
  to_phase integer NOT NULL,
  transition_type text NOT NULL,
  criteria_snapshot jsonb NOT NULL,
  triggered_by text NOT NULL,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Validation trigger for phases and enum values
CREATE OR REPLACE FUNCTION public.validate_io_phase_transition()
RETURNS trigger LANGUAGE plpgsql SET search_path TO 'public' AS $$
BEGIN
  IF NEW.from_phase < 1 OR NEW.from_phase > 7 THEN
    RAISE EXCEPTION 'from_phase must be between 1 and 7, got %', NEW.from_phase;
  END IF;
  IF NEW.to_phase < 1 OR NEW.to_phase > 7 THEN
    RAISE EXCEPTION 'to_phase must be between 1 and 7, got %', NEW.to_phase;
  END IF;
  IF NEW.transition_type NOT IN ('advance', 'regression', 'manual_override', 'initial_placement') THEN
    RAISE EXCEPTION 'Invalid transition_type: %', NEW.transition_type;
  END IF;
  IF NEW.triggered_by NOT IN ('phase_manager', 'admin', 'system') THEN
    RAISE EXCEPTION 'Invalid triggered_by: %', NEW.triggered_by;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_validate_io_phase_transition
  BEFORE INSERT OR UPDATE ON public.io_phase_transitions
  FOR EACH ROW EXECUTE FUNCTION public.validate_io_phase_transition();

-- Indices
CREATE INDEX idx_io_phase_transitions_user_id ON public.io_phase_transitions(user_id);
CREATE INDEX idx_io_phase_transitions_created_at ON public.io_phase_transitions(created_at);
CREATE INDEX idx_io_phase_transitions_type ON public.io_phase_transitions(transition_type);

-- RLS
ALTER TABLE public.io_phase_transitions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own transitions"
  ON public.io_phase_transitions FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "Admins and devs can view all transitions"
  ON public.io_phase_transitions FOR SELECT
  TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'desenvolvedor'::app_role));

CREATE POLICY "Admins and devs can insert transitions"
  ON public.io_phase_transitions FOR INSERT
  TO authenticated
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'desenvolvedor'::app_role));

CREATE POLICY "Service role full access io_phase_transitions"
  ON public.io_phase_transitions FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- 4. Seed existing users into io_user_phase
INSERT INTO public.io_user_phase (user_id, current_phase, phase_entered_at)
SELECT id, 1, now()
FROM auth.users
ON CONFLICT (user_id) DO NOTHING;

-- Seed initial_placement transitions
INSERT INTO public.io_phase_transitions (user_id, from_phase, to_phase, transition_type, criteria_snapshot, triggered_by, notes)
SELECT id, 1, 1, 'initial_placement', '{}'::jsonb, 'system', 'Posicionamento inicial na migração IO v2'
FROM auth.users;
