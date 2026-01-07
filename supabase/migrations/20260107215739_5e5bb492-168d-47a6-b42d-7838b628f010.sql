-- Enum para fase da jornada
CREATE TYPE journey_phase AS ENUM (
  'ACOLHIMENTO',
  'CLARIFICACAO', 
  'PADROES',
  'RAIZ',
  'TROCA',
  'CONSOLIDACAO'
);

-- Enum para tipo de próxima pergunta
CREATE TYPE next_question_type AS ENUM (
  'EVIDENCE',
  'ALTERNATIVE',
  'SENSATION',
  'VALUE',
  'TRUTH',
  'PRACTICE'
);

-- Tabela principal de insights por turno
CREATE TABLE turn_insights (
  -- IDENTIFICAÇÃO
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  
  -- VÍNCULO (não exportado por default)
  chat_session_id UUID NOT NULL REFERENCES chat_sessions(id) ON DELETE CASCADE,
  message_user_id UUID NOT NULL,
  message_assistant_id UUID NOT NULL,
  turn_number INTEGER NOT NULL DEFAULT 1,
  
  -- VERSÃO DO EXTRATOR
  extractor_version TEXT NOT NULL DEFAULT 'v1.0',
  mentor_model_id TEXT,
  observer_model_id TEXT DEFAULT 'openai/gpt-5-nano',
  
  -- USER JOURNEY SNAPSHOT
  phase journey_phase,
  phase_confidence REAL DEFAULT 0,
  
  -- Emoção
  primary_emotions TEXT[] DEFAULT '{}',
  emotion_intensity INTEGER CHECK (emotion_intensity BETWEEN 0 AND 3),
  emotion_stability TEXT CHECK (emotion_stability IN ('calm', 'unstable')),
  
  -- Ciclo ZION (JSONB para flexibilidade)
  zion_cycle JSONB DEFAULT '{}',
  
  -- Mentira e Verdade
  lie_active JSONB DEFAULT '{}',
  truth_target JSONB DEFAULT '{}',
  
  -- Shift (mudança detectada)
  shift_detected BOOLEAN DEFAULT false,
  shift_description TEXT,
  shift_evidence TEXT[] DEFAULT '{}',
  
  -- Virtude primária
  primary_virtue JSONB DEFAULT '{}',
  
  -- Próxima melhor pergunta
  next_best_question_type next_question_type,
  
  -- ASSISTANT QUALITY (RUBRICA)
  quality_metrics JSONB DEFAULT '{}',
  rubric_scores JSONB DEFAULT '{}',
  overall_score REAL CHECK (overall_score BETWEEN 0 AND 5),
  issues_detected TEXT[] DEFAULT '{}',
  quality_rationale TEXT,
  
  -- CURADORIA (admin)
  admin_confirmed BOOLEAN DEFAULT false,
  admin_notes TEXT,
  include_in_training BOOLEAN,
  exclude_from_training BOOLEAN DEFAULT false,
  curated_at TIMESTAMPTZ,
  curated_by UUID,
  
  -- Status de extração
  extraction_status TEXT DEFAULT 'pending' 
    CHECK (extraction_status IN ('pending', 'processing', 'completed', 'failed')),
  extraction_error TEXT,
  
  -- Unique constraint
  UNIQUE(message_assistant_id)
);

-- Índices para performance
CREATE INDEX idx_turn_insights_session ON turn_insights(chat_session_id);
CREATE INDEX idx_turn_insights_phase ON turn_insights(phase);
CREATE INDEX idx_turn_insights_score ON turn_insights(overall_score);
CREATE INDEX idx_turn_insights_shift ON turn_insights(shift_detected);
CREATE INDEX idx_turn_insights_status ON turn_insights(extraction_status);
CREATE INDEX idx_turn_insights_training ON turn_insights(include_in_training) WHERE include_in_training = true;

-- Trigger para updated_at
CREATE TRIGGER update_turn_insights_updated_at
  BEFORE UPDATE ON turn_insights
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Enable RLS
ALTER TABLE turn_insights ENABLE ROW LEVEL SECURITY;

-- RLS Policies
-- Admins podem ver todos os insights
CREATE POLICY "Admins can view turn insights"
  ON turn_insights FOR SELECT
  TO authenticated
  USING (has_role(auth.uid(), 'admin'));

-- Admins podem atualizar (curadoria)
CREATE POLICY "Admins can update turn insights"
  ON turn_insights FOR UPDATE
  TO authenticated
  USING (has_role(auth.uid(), 'admin'));

-- Service role pode inserir (Edge Functions)
CREATE POLICY "Service role can insert turn insights"
  ON turn_insights FOR INSERT
  TO service_role
  WITH CHECK (true);

-- Service role pode atualizar (Edge Functions)
CREATE POLICY "Service role can update turn insights"
  ON turn_insights FOR UPDATE
  TO service_role
  USING (true);