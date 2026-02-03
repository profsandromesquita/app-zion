-- =================================================
-- ETAPA 8: Agendamento e Conexão
-- Tabelas: connection_sessions + soldado_session_feedback
-- =================================================

-- Enum para status de sessão de conexão
CREATE TYPE public.connection_session_status AS ENUM (
  'scheduled',
  'confirmed',
  'in_progress',
  'completed',
  'cancelled',
  'no_show'
);

-- Tabela principal de sessões de conexão
CREATE TABLE public.connection_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  soldado_id uuid NOT NULL,
  buscador_id uuid NOT NULL,
  chat_session_id uuid REFERENCES public.chat_sessions(id) ON DELETE SET NULL,
  scheduled_at timestamptz NOT NULL,
  duration_minutes integer NOT NULL DEFAULT 30,
  status public.connection_session_status NOT NULL DEFAULT 'scheduled',
  meeting_url text,
  soldado_notes text,
  buscador_feedback jsonb DEFAULT '{}'::jsonb,
  cancelled_by uuid,
  cancelled_reason text,
  started_at timestamptz,
  ended_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Índices para connection_sessions
CREATE INDEX idx_connection_sessions_soldado 
ON public.connection_sessions(soldado_id, status);

CREATE INDEX idx_connection_sessions_buscador 
ON public.connection_sessions(buscador_id, status);

CREATE INDEX idx_connection_sessions_scheduled 
ON public.connection_sessions(scheduled_at) 
WHERE status IN ('scheduled', 'confirmed');

-- RLS para connection_sessions
ALTER TABLE public.connection_sessions ENABLE ROW LEVEL SECURITY;

-- Soldados podem ver suas próprias sessões
CREATE POLICY "Soldados can view own sessions"
ON public.connection_sessions FOR SELECT
USING (soldado_id = auth.uid() AND has_role(auth.uid(), 'soldado'));

-- Buscadores podem ver suas próprias sessões
CREATE POLICY "Buscadores can view own sessions"
ON public.connection_sessions FOR SELECT
USING (buscador_id = auth.uid());

-- Inserção via service role (edge functions)
CREATE POLICY "Service role can insert sessions"
ON public.connection_sessions FOR INSERT
WITH CHECK (true);

-- Soldados podem atualizar suas sessões (notas, status)
CREATE POLICY "Soldados can update own sessions"
ON public.connection_sessions FOR UPDATE
USING (soldado_id = auth.uid() AND has_role(auth.uid(), 'soldado'));

-- Buscadores podem atualizar status (cancelar)
CREATE POLICY "Buscadores can update own sessions"
ON public.connection_sessions FOR UPDATE
USING (buscador_id = auth.uid());

-- Service role pode atualizar
CREATE POLICY "Service role can update sessions"
ON public.connection_sessions FOR UPDATE
USING (true);

-- Admins podem gerenciar tudo
CREATE POLICY "Admins can manage all sessions"
ON public.connection_sessions FOR ALL
USING (has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'desenvolvedor'));

-- Trigger para updated_at
CREATE TRIGGER update_connection_sessions_updated_at
BEFORE UPDATE ON public.connection_sessions
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- =================================================
-- Tabela soldado_session_feedback (Mocado para fase futura)
-- =================================================

CREATE TABLE public.soldado_session_feedback (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id uuid NOT NULL REFERENCES public.connection_sessions(id) ON DELETE CASCADE,
  soldado_id uuid NOT NULL,
  buscador_engagement integer CHECK (buscador_engagement >= 1 AND buscador_engagement <= 5),
  progress_observed text,
  concerns text,
  recommend_professional boolean DEFAULT false,
  follow_up_needed boolean DEFAULT false,
  follow_up_notes text,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Índice para buscar feedback por sessão
CREATE INDEX idx_soldado_session_feedback_session 
ON public.soldado_session_feedback(session_id);

-- RLS para soldado_session_feedback
ALTER TABLE public.soldado_session_feedback ENABLE ROW LEVEL SECURITY;

-- Soldados podem gerenciar seu próprio feedback
CREATE POLICY "Soldados can manage own feedback"
ON public.soldado_session_feedback FOR ALL
USING (soldado_id = auth.uid() AND has_role(auth.uid(), 'soldado'))
WITH CHECK (soldado_id = auth.uid() AND has_role(auth.uid(), 'soldado'));

-- Admins e profissionais podem visualizar
CREATE POLICY "Admins can view all feedback"
ON public.soldado_session_feedback FOR SELECT
USING (has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'profissional'));

-- Service role pode inserir/atualizar
CREATE POLICY "Service role can manage feedback"
ON public.soldado_session_feedback FOR ALL
USING (true)
WITH CHECK (true);