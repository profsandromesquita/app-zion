-- ETAPA 7: Matchmaking Semantico

-- 1. Adicionar coluna matchmaking_state em chat_sessions
ALTER TABLE public.chat_sessions 
ADD COLUMN IF NOT EXISTS matchmaking_state jsonb DEFAULT '{}'::jsonb;

COMMENT ON COLUMN public.chat_sessions.matchmaking_state IS 
  'Estado do matchmaking: { attempts, excluded_soldados, last_suggestion, mode }';

-- 2. Adicionar flag is_generalist em soldado_profiles
ALTER TABLE public.soldado_profiles 
ADD COLUMN IF NOT EXISTS is_generalist boolean DEFAULT false;

COMMENT ON COLUMN public.soldado_profiles.is_generalist IS 
  'Soldado generalista pode atender qualquer cenario como fallback';

-- 3. Funcao RPC para buscar testemunhos por similaridade semantica
CREATE OR REPLACE FUNCTION public.search_testimonies_by_embedding(
  query_embedding vector(1536),
  match_threshold double precision DEFAULT 0.03,
  match_count integer DEFAULT 10,
  exclude_soldados uuid[] DEFAULT '{}'::uuid[]
)
RETURNS TABLE (
  id uuid,
  user_id uuid,
  transcript text,
  analysis jsonb,
  similarity double precision
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    t.id,
    t.user_id,
    t.transcript,
    t.analysis,
    1 - (t.embedding <=> query_embedding) AS similarity
  FROM public.testimonies t
  INNER JOIN public.soldado_profiles sp ON t.user_id = sp.id
  WHERE 
    t.status = 'published'
    AND t.embedding IS NOT NULL
    AND sp.is_available = true
    AND NOT (t.user_id = ANY(exclude_soldados))
    AND 1 - (t.embedding <=> query_embedding) > match_threshold
  ORDER BY similarity DESC
  LIMIT match_count;
END;
$$;

-- 4. Indices para performance

-- Indice para busca por embedding (HNSW) - testemunhos publicados
CREATE INDEX IF NOT EXISTS testimonies_embedding_idx 
ON public.testimonies 
USING hnsw (embedding vector_cosine_ops)
WHERE status = 'published' AND embedding IS NOT NULL;

-- Indice para soldados disponiveis
CREATE INDEX IF NOT EXISTS soldado_profiles_available_idx 
ON public.soldado_profiles (is_available)
WHERE is_available = true;

-- Indice para temas ativos do usuario
CREATE INDEX IF NOT EXISTS user_themes_active_idx 
ON public.user_themes (user_id, status)
WHERE status IN ('active', 'in_progress');