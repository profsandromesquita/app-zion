-- Habilitar extensão pgvector
CREATE EXTENSION IF NOT EXISTS vector;

-- Criar ENUMs para layers, status e embedding status
CREATE TYPE doc_layer AS ENUM ('CONSTITUICAO', 'NUCLEO', 'BIBLIOTECA');
CREATE TYPE doc_status AS ENUM ('draft', 'review', 'published');
CREATE TYPE embedding_status AS ENUM ('pending', 'processing', 'ok', 'failed');

-- Tabela principal de documentos
CREATE TABLE public.documents (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  title TEXT NOT NULL,
  layer doc_layer NOT NULL DEFAULT 'BIBLIOTECA',
  domain TEXT NOT NULL DEFAULT 'geral',
  language TEXT NOT NULL DEFAULT 'pt',
  retrievable BOOLEAN NOT NULL DEFAULT true,
  priority INTEGER NOT NULL DEFAULT 50,
  current_version_id UUID,
  status doc_status NOT NULL DEFAULT 'draft',
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Tabela de versões de documentos
CREATE TABLE public.document_versions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  doc_id UUID NOT NULL REFERENCES public.documents(id) ON DELETE CASCADE,
  version TEXT NOT NULL DEFAULT '1.0.0',
  source_file_url TEXT,
  raw_text TEXT,
  normalized_text TEXT,
  content_hash TEXT,
  status doc_status NOT NULL DEFAULT 'draft',
  changelog TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Adicionar FK de current_version_id após criar document_versions
ALTER TABLE public.documents 
ADD CONSTRAINT documents_current_version_fk 
FOREIGN KEY (current_version_id) REFERENCES public.document_versions(id) ON DELETE SET NULL;

-- Tabela de chunks para RAG
CREATE TABLE public.chunks (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  doc_id UUID NOT NULL REFERENCES public.documents(id) ON DELETE CASCADE,
  version_id UUID NOT NULL REFERENCES public.document_versions(id) ON DELETE CASCADE,
  version TEXT NOT NULL,
  layer doc_layer NOT NULL,
  domain TEXT NOT NULL,
  language TEXT NOT NULL DEFAULT 'pt',
  priority INTEGER NOT NULL DEFAULT 50,
  retrievable BOOLEAN NOT NULL DEFAULT true,
  section_path JSONB DEFAULT '[]'::jsonb,
  position INTEGER NOT NULL DEFAULT 0,
  text TEXT NOT NULL,
  char_start INTEGER,
  char_end INTEGER,
  tags_json JSONB DEFAULT '{}'::jsonb,
  embedding vector(1536),
  embedding_model_id TEXT,
  embedding_status embedding_status NOT NULL DEFAULT 'pending',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Criar índice vetorial para busca por similaridade
CREATE INDEX chunks_embedding_idx ON public.chunks 
USING ivfflat (embedding vector_cosine_ops) WITH (lists = 100);

-- Índices adicionais para performance
CREATE INDEX chunks_doc_id_idx ON public.chunks(doc_id);
CREATE INDEX chunks_version_id_idx ON public.chunks(version_id);
CREATE INDEX chunks_layer_idx ON public.chunks(layer);
CREATE INDEX chunks_retrievable_idx ON public.chunks(retrievable) WHERE retrievable = true;
CREATE INDEX chunks_embedding_status_idx ON public.chunks(embedding_status);
CREATE INDEX documents_status_idx ON public.documents(status);
CREATE INDEX documents_layer_idx ON public.documents(layer);
CREATE INDEX document_versions_doc_id_idx ON public.document_versions(doc_id);

-- Habilitar RLS
ALTER TABLE public.documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.document_versions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.chunks ENABLE ROW LEVEL SECURITY;

-- Policies para documents (somente admins)
CREATE POLICY "Admins can view documents" ON public.documents
FOR SELECT USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins can insert documents" ON public.documents
FOR INSERT WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins can update documents" ON public.documents
FOR UPDATE USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins can delete documents" ON public.documents
FOR DELETE USING (has_role(auth.uid(), 'admin'::app_role));

-- Policies para document_versions (somente admins)
CREATE POLICY "Admins can view document_versions" ON public.document_versions
FOR SELECT USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins can insert document_versions" ON public.document_versions
FOR INSERT WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins can update document_versions" ON public.document_versions
FOR UPDATE USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins can delete document_versions" ON public.document_versions
FOR DELETE USING (has_role(auth.uid(), 'admin'::app_role));

-- Policies para chunks (admins podem gerenciar, serviço pode ler para RAG)
CREATE POLICY "Admins can view chunks" ON public.chunks
FOR SELECT USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins can insert chunks" ON public.chunks
FOR INSERT WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins can update chunks" ON public.chunks
FOR UPDATE USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins can delete chunks" ON public.chunks
FOR DELETE USING (has_role(auth.uid(), 'admin'::app_role));

-- Trigger para atualizar updated_at em documents
CREATE TRIGGER update_documents_updated_at
BEFORE UPDATE ON public.documents
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Função para calcular hash do conteúdo
CREATE OR REPLACE FUNCTION public.calculate_content_hash(content TEXT)
RETURNS TEXT
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT encode(sha256(content::bytea), 'hex')
$$;

-- Função para busca vetorial de chunks
CREATE OR REPLACE FUNCTION public.search_chunks(
  query_embedding vector(1536),
  match_threshold FLOAT DEFAULT 0.7,
  match_count INT DEFAULT 10,
  filter_layer doc_layer DEFAULT NULL,
  filter_domain TEXT DEFAULT NULL
)
RETURNS TABLE (
  id UUID,
  doc_id UUID,
  text TEXT,
  section_path JSONB,
  tags_json JSONB,
  layer doc_layer,
  domain TEXT,
  priority INTEGER,
  similarity FLOAT
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    c.id,
    c.doc_id,
    c.text,
    c.section_path,
    c.tags_json,
    c.layer,
    c.domain,
    c.priority,
    1 - (c.embedding <=> query_embedding) AS similarity
  FROM public.chunks c
  INNER JOIN public.documents d ON c.doc_id = d.id
  INNER JOIN public.document_versions dv ON c.version_id = dv.id
  WHERE 
    c.retrievable = true
    AND c.embedding_status = 'ok'
    AND d.status = 'published'
    AND dv.status = 'published'
    AND c.version_id = d.current_version_id
    AND (filter_layer IS NULL OR c.layer = filter_layer)
    AND (filter_domain IS NULL OR c.domain = filter_domain)
    AND 1 - (c.embedding <=> query_embedding) > match_threshold
  ORDER BY c.priority DESC, similarity DESC
  LIMIT match_count;
END;
$$;