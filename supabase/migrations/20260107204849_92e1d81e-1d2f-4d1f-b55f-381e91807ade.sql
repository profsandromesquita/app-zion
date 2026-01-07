-- Criar ENUM para labels do dataset
CREATE TYPE dataset_label AS ENUM ('useful', 'not_useful', 'theology_report');

-- Tabela principal para armazenar pares pergunta/resposta com feedback
CREATE TABLE feedback_dataset_items (
  -- IDENTIFICAÇÃO
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  
  -- VÍNCULO COM A CONVERSA (interno, não exportado por default)
  chat_session_id UUID NOT NULL,
  user_id UUID,
  message_user_id UUID NOT NULL,
  message_assistant_id UUID NOT NULL,
  feedback_event_id UUID REFERENCES feedback_events(id),
  
  -- CONTEÚDO PARA DATASET
  user_prompt_text TEXT NOT NULL,
  assistant_answer_text TEXT NOT NULL,
  feedback_label dataset_label NOT NULL,
  feedback_note TEXT,
  
  -- METADADOS DO MODELO
  model_id TEXT,
  intent TEXT,
  risk_level TEXT,
  was_rewritten BOOLEAN DEFAULT false,
  rag_used BOOLEAN DEFAULT false,
  rag_low_confidence BOOLEAN DEFAULT false,
  retrieved_chunk_ids UUID[] DEFAULT '{}',
  retrieval_stats JSONB DEFAULT '{}',
  
  -- CURADORIA (admin)
  include_in_export BOOLEAN DEFAULT true,
  curation_notes TEXT,
  reviewed_at TIMESTAMPTZ,
  reviewed_by UUID,
  
  -- CONSTRAINT para deduplicação
  UNIQUE(message_assistant_id, feedback_label)
);

-- Trigger para updated_at
CREATE TRIGGER update_feedback_dataset_items_updated_at
  BEFORE UPDATE ON feedback_dataset_items
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Índices para performance
CREATE INDEX idx_feedback_dataset_label ON feedback_dataset_items(feedback_label);
CREATE INDEX idx_feedback_dataset_created ON feedback_dataset_items(created_at DESC);
CREATE INDEX idx_feedback_dataset_intent ON feedback_dataset_items(intent);
CREATE INDEX idx_feedback_dataset_include ON feedback_dataset_items(include_in_export);

-- Tabela de audit logs para exports
CREATE TABLE admin_audit_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  admin_id UUID NOT NULL,
  action TEXT NOT NULL,
  details JSONB DEFAULT '{}',
  ip_address TEXT
);

CREATE INDEX idx_audit_logs_admin ON admin_audit_logs(admin_id);
CREATE INDEX idx_audit_logs_action ON admin_audit_logs(action);
CREATE INDEX idx_audit_logs_created ON admin_audit_logs(created_at DESC);

-- RLS para feedback_dataset_items
ALTER TABLE feedback_dataset_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can view dataset items"
  ON feedback_dataset_items FOR SELECT
  USING (has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can update dataset items"
  ON feedback_dataset_items FOR UPDATE
  USING (has_role(auth.uid(), 'admin'));

CREATE POLICY "Service role can insert dataset items"
  ON feedback_dataset_items FOR INSERT
  WITH CHECK (true);

-- RLS para admin_audit_logs
ALTER TABLE admin_audit_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can view audit logs"
  ON admin_audit_logs FOR SELECT
  USING (has_role(auth.uid(), 'admin'));

CREATE POLICY "Service role can insert audit logs"
  ON admin_audit_logs FOR INSERT
  WITH CHECK (true);