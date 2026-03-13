-- =============================================
-- IO Missions & Daily Sessions (Fase 1)
-- =============================================

-- 1. io_missions table
CREATE TABLE public.io_missions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  phase integer NOT NULL,
  week_range text NOT NULL,
  title text NOT NULL,
  description text NOT NULL,
  type text NOT NULL,
  difficulty text NOT NULL DEFAULT 'simples',
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Validation trigger for io_missions
CREATE OR REPLACE FUNCTION public.validate_io_mission()
RETURNS trigger LANGUAGE plpgsql SET search_path TO 'public' AS $$
BEGIN
  IF NEW.phase < 1 OR NEW.phase > 7 THEN
    RAISE EXCEPTION 'phase must be between 1 and 7, got %', NEW.phase;
  END IF;
  IF NEW.type NOT IN ('reflexao', 'pratica', 'observacao', 'registro', 'acao') THEN
    RAISE EXCEPTION 'Invalid type: %', NEW.type;
  END IF;
  IF NEW.difficulty NOT IN ('simples', 'moderada', 'profunda') THEN
    RAISE EXCEPTION 'Invalid difficulty: %', NEW.difficulty;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_validate_io_mission
  BEFORE INSERT OR UPDATE ON public.io_missions
  FOR EACH ROW EXECUTE FUNCTION public.validate_io_mission();

CREATE TRIGGER trg_io_missions_updated_at
  BEFORE UPDATE ON public.io_missions
  FOR EACH ROW EXECUTE FUNCTION public.trigger_set_updated_at();

-- Indices
CREATE INDEX idx_io_missions_phase ON public.io_missions(phase);
CREATE INDEX idx_io_missions_is_active ON public.io_missions(is_active);
CREATE INDEX idx_io_missions_phase_week ON public.io_missions(phase, week_range);

-- RLS
ALTER TABLE public.io_missions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated can view active missions"
  ON public.io_missions FOR SELECT TO authenticated
  USING (is_active = true);

CREATE POLICY "Admins and devs full access io_missions"
  ON public.io_missions FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'desenvolvedor'))
  WITH CHECK (has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'desenvolvedor'));

-- 2. io_daily_sessions table
CREATE TABLE public.io_daily_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  session_date date NOT NULL,
  phase_at_session integer NOT NULL,
  check_in_mood text,
  check_in_completed boolean NOT NULL DEFAULT false,
  mission_id uuid REFERENCES public.io_missions(id),
  mission_completed boolean NOT NULL DEFAULT false,
  registro_text text,
  escala_clareza integer,
  escala_regulacao integer,
  escala_identidade integer,
  escala_constancia integer,
  escala_vitalidade integer,
  escala_agencia integer,
  escala_autonomia integer,
  feedback_generated text,
  reforco_identitario text,
  igi_at_session numeric,
  duration_seconds integer,
  completed boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT uq_user_session_date UNIQUE(user_id, session_date)
);

-- Validation trigger
CREATE OR REPLACE FUNCTION public.validate_io_daily_session()
RETURNS trigger LANGUAGE plpgsql SET search_path TO 'public' AS $$
BEGIN
  IF NEW.phase_at_session < 1 OR NEW.phase_at_session > 7 THEN
    RAISE EXCEPTION 'phase_at_session must be between 1 and 7, got %', NEW.phase_at_session;
  END IF;
  IF NEW.escala_clareza IS NOT NULL AND (NEW.escala_clareza < 0 OR NEW.escala_clareza > 10) THEN
    RAISE EXCEPTION 'escala_clareza must be between 0 and 10';
  END IF;
  IF NEW.escala_regulacao IS NOT NULL AND (NEW.escala_regulacao < 0 OR NEW.escala_regulacao > 10) THEN
    RAISE EXCEPTION 'escala_regulacao must be between 0 and 10';
  END IF;
  IF NEW.escala_identidade IS NOT NULL AND (NEW.escala_identidade < 0 OR NEW.escala_identidade > 10) THEN
    RAISE EXCEPTION 'escala_identidade must be between 0 and 10';
  END IF;
  IF NEW.escala_constancia IS NOT NULL AND (NEW.escala_constancia < 0 OR NEW.escala_constancia > 10) THEN
    RAISE EXCEPTION 'escala_constancia must be between 0 and 10';
  END IF;
  IF NEW.escala_vitalidade IS NOT NULL AND (NEW.escala_vitalidade < 0 OR NEW.escala_vitalidade > 10) THEN
    RAISE EXCEPTION 'escala_vitalidade must be between 0 and 10';
  END IF;
  IF NEW.escala_agencia IS NOT NULL AND (NEW.escala_agencia < 0 OR NEW.escala_agencia > 10) THEN
    RAISE EXCEPTION 'escala_agencia must be between 0 and 10';
  END IF;
  IF NEW.escala_autonomia IS NOT NULL AND (NEW.escala_autonomia < 0 OR NEW.escala_autonomia > 10) THEN
    RAISE EXCEPTION 'escala_autonomia must be between 0 and 10';
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_validate_io_daily_session
  BEFORE INSERT OR UPDATE ON public.io_daily_sessions
  FOR EACH ROW EXECUTE FUNCTION public.validate_io_daily_session();

CREATE TRIGGER trg_io_daily_sessions_updated_at
  BEFORE UPDATE ON public.io_daily_sessions
  FOR EACH ROW EXECUTE FUNCTION public.trigger_set_updated_at();

-- Indices
CREATE INDEX idx_io_daily_sessions_user_id ON public.io_daily_sessions(user_id);
CREATE INDEX idx_io_daily_sessions_session_date ON public.io_daily_sessions(session_date);
CREATE INDEX idx_io_daily_sessions_phase ON public.io_daily_sessions(phase_at_session);

-- RLS
ALTER TABLE public.io_daily_sessions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can select own daily sessions"
  ON public.io_daily_sessions FOR SELECT TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "Users can insert own daily sessions"
  ON public.io_daily_sessions FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can update own daily sessions"
  ON public.io_daily_sessions FOR UPDATE TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "Admins and devs can view all daily sessions"
  ON public.io_daily_sessions FOR SELECT TO authenticated
  USING (has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'desenvolvedor'));

CREATE POLICY "Service role full access io_daily_sessions"
  ON public.io_daily_sessions FOR ALL TO service_role
  USING (true) WITH CHECK (true);

-- 3. Seed missions
INSERT INTO public.io_missions (phase, week_range, title, description, type, difficulty) VALUES
(1, '1-2', 'Nomeie o que sente', 'Pare por 1 minuto. Feche os olhos. O que você está sentindo agora? Dê um nome a isso.', 'reflexao', 'simples'),
(1, '1-2', 'O que se repetiu hoje?', 'Pense no seu dia. Houve alguma situação que te lembrou algo que já aconteceu antes?', 'observacao', 'simples'),
(1, '3-4', 'O peso que não é seu', 'Pense em algo que te preocupa. Pergunte a si mesmo: isso é realmente meu problema ou estou carregando algo de outra pessoa?', 'reflexao', 'moderada'),
(2, '1-2', 'Fato ou interpretação?', 'Escolha uma situação que te incomodou recentemente. Separe: o que realmente aconteceu (fato) do que você concluiu sobre isso (interpretação).', 'reflexao', 'simples'),
(2, '1-2', 'Onde o medo mora no corpo?', 'Quando sentir medo ou ansiedade hoje, pare e observe: onde no corpo você sente isso? Peito? Estômago? Garganta?', 'observacao', 'simples'),
(2, '3-4', 'O que é meu e o que é do outro?', 'Pense em um conflito recente. Identifique: o que é responsabilidade sua e o que é responsabilidade da outra pessoa.', 'reflexao', 'moderada'),
(3, '1-2', 'A frase que você repete', 'Qual frase sobre si mesmo você mais repete internamente? (ex: "não sou bom o suficiente", "preciso provar meu valor"). Escreva-a.', 'registro', 'moderada'),
(3, '3-4', 'De onde veio essa crença?', 'Relembre a frase que identificou. Quando foi a primeira vez que acreditou nisso? Quem estava presente?', 'reflexao', 'profunda'),
(4, '1-2', 'O compromisso de 5 minutos', 'Escolha 1 prática simples (respiração, leitura, caminhada) e faça por 5 minutos. Não mais. O objetivo é começar, não terminar.', 'pratica', 'simples'),
(4, '3-4', 'O gatilho e a escolha', 'Identifique um momento do dia em que você normalmente age no automático. Hoje, quando esse momento chegar, pare 3 segundos antes de reagir.', 'pratica', 'moderada'),
(5, '1-2', 'Uma palavra de honra', 'Pense em alguém que você magoou (mesmo sem querer). O que você diria a essa pessoa se pudesse ser completamente honesto?', 'reflexao', 'moderada'),
(5, '3-4', 'Restaurar um vínculo', 'Escolha uma pessoa com quem você tem tensão. Faça um gesto simples de aproximação hoje (mensagem, ligação, presença).', 'acao', 'moderada'),
(6, '1-2', 'Mapa das áreas', 'Liste as áreas da sua vida: casamento, filhos, trabalho, saúde, finanças, propósito, social. Dê uma nota de 0-10 para cada.', 'registro', 'simples'),
(6, '3-4', 'Uma ação concreta', 'Escolha a área com menor nota. Defina 1 ação concreta que você pode executar esta semana.', 'acao', 'moderada'),
(7, '1-2', 'O que mudou em mim?', 'Olhe para trás no caminho que percorreu. O que você consegue ver hoje que não via antes? O que mudou na forma como se enxerga?', 'reflexao', 'simples'),
(7, '3-4', 'Transmitir o que recebi', 'Pense em algo que aprendeu nessa jornada. Como você poderia compartilhar isso com alguém que está passando pelo que você passou?', 'reflexao', 'moderada');