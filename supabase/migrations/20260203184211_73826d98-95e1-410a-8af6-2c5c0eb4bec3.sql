-- Enum para status do testemunho
CREATE TYPE testimony_status AS ENUM (
  'uploading',
  'processing',
  'analyzed',
  'curated',
  'published',
  'rejected'
);

-- Tabela principal de testemunhos
CREATE TABLE public.testimonies (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  application_id uuid REFERENCES soldado_applications(id) ON DELETE SET NULL,
  
  -- Arquivo de audio
  audio_url text NOT NULL,
  duration_seconds integer NOT NULL DEFAULT 0,
  file_size_bytes integer,
  mime_type text DEFAULT 'audio/webm',
  
  -- Status e processamento
  status testimony_status NOT NULL DEFAULT 'uploading',
  
  -- Dados preenchidos pela IA (Etapa 4)
  transcript text,
  analysis jsonb DEFAULT '{}',
  
  -- Curadoria humana (Etapa 5)
  curator_notes text,
  curated_by uuid REFERENCES profiles(id),
  curated_at timestamptz,
  
  -- Embedding para matchmaking (Etapa 7)
  embedding vector(1536),
  
  -- Timestamps
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  
  -- Apenas um testemunho ativo por usuario/application
  CONSTRAINT unique_active_testimony UNIQUE (user_id, application_id)
);

-- Index para buscas
CREATE INDEX idx_testimonies_user_id ON testimonies(user_id);
CREATE INDEX idx_testimonies_application_id ON testimonies(application_id);
CREATE INDEX idx_testimonies_status ON testimonies(status);

-- Trigger para updated_at
CREATE TRIGGER set_testimonies_updated_at
  BEFORE UPDATE ON testimonies
  FOR EACH ROW
  EXECUTE FUNCTION trigger_set_updated_at();

-- Habilitar RLS
ALTER TABLE testimonies ENABLE ROW LEVEL SECURITY;

-- Usuarios podem ver seus proprios testemunhos
CREATE POLICY "Users can view own testimonies"
  ON testimonies FOR SELECT
  USING (auth.uid() = user_id);

-- Usuarios podem inserir seus proprios testemunhos
CREATE POLICY "Users can insert own testimonies"
  ON testimonies FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Usuarios podem atualizar seus proprios testemunhos (status uploading apenas)
CREATE POLICY "Users can update own uploading testimonies"
  ON testimonies FOR UPDATE
  USING (auth.uid() = user_id AND status = 'uploading');

-- Admin/Dev/Profissional/Pastor podem ver todos para curadoria
CREATE POLICY "Authorized roles can view all testimonies"
  ON testimonies FOR SELECT
  USING (
    has_role(auth.uid(), 'admin') OR
    has_role(auth.uid(), 'desenvolvedor') OR
    has_role(auth.uid(), 'profissional') OR
    has_role(auth.uid(), 'pastor')
  );

-- Admin/Profissional/Pastor podem atualizar para curadoria
CREATE POLICY "Authorized roles can update testimonies"
  ON testimonies FOR UPDATE
  USING (
    has_role(auth.uid(), 'admin') OR
    has_role(auth.uid(), 'desenvolvedor') OR
    has_role(auth.uid(), 'profissional') OR
    has_role(auth.uid(), 'pastor')
  );

-- Service role pode inserir (para edge functions)
CREATE POLICY "Service role can insert testimonies"
  ON testimonies FOR INSERT
  WITH CHECK (true);

-- Service role pode atualizar (para edge functions)
CREATE POLICY "Service role can update testimonies"
  ON testimonies FOR UPDATE
  USING (true);

-- Criar bucket privado para testemunhos
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'testimonies',
  'testimonies',
  false,
  104857600,
  ARRAY['audio/webm', 'audio/ogg', 'audio/mp4', 'audio/mpeg', 'audio/wav']
);

-- RLS para storage - usuarios podem fazer upload de seus proprios testemunhos
CREATE POLICY "Users can upload own testimonies"
  ON storage.objects FOR INSERT
  WITH CHECK (
    bucket_id = 'testimonies' AND
    auth.uid()::text = (storage.foldername(name))[1]
  );

-- RLS para storage - usuarios podem ver seus proprios testemunhos
CREATE POLICY "Users can view own testimony files"
  ON storage.objects FOR SELECT
  USING (
    bucket_id = 'testimonies' AND
    auth.uid()::text = (storage.foldername(name))[1]
  );

-- RLS para storage - roles autorizadas podem ver todos os testemunhos
CREATE POLICY "Authorized roles can access all testimony files"
  ON storage.objects FOR SELECT
  USING (
    bucket_id = 'testimonies' AND
    (
      has_role(auth.uid(), 'admin') OR
      has_role(auth.uid(), 'desenvolvedor') OR
      has_role(auth.uid(), 'profissional') OR
      has_role(auth.uid(), 'pastor')
    )
  );

-- Funcao para atualizar status da candidatura quando testemunho e criado
CREATE OR REPLACE FUNCTION update_application_on_testimony()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Quando testemunho e criado, atualizar candidatura
  IF TG_OP = 'INSERT' AND NEW.application_id IS NOT NULL THEN
    -- Linkar testemunho na candidatura e mudar status para under_review
    UPDATE soldado_applications
    SET testimony_id = NEW.id,
        status = 'under_review',
        updated_at = now()
    WHERE id = NEW.application_id
      AND status = 'testimony_required';
  END IF;
  
  RETURN NEW;
END;
$$;

-- Trigger que dispara apos insercao de testemunho
CREATE TRIGGER on_testimony_created
  AFTER INSERT ON testimonies
  FOR EACH ROW
  EXECUTE FUNCTION update_application_on_testimony();