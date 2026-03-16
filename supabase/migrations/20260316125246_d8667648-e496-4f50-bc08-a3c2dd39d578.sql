DROP FUNCTION IF EXISTS public.search_chunks(vector, double precision, integer, doc_layer, text);

CREATE FUNCTION public.search_chunks(
  query_embedding vector, 
  match_threshold double precision DEFAULT 0.7, 
  match_count integer DEFAULT 10, 
  filter_layer doc_layer DEFAULT NULL::doc_layer, 
  filter_domain text DEFAULT NULL::text
)
RETURNS TABLE(
  id uuid, 
  doc_id uuid, 
  text text, 
  section_path jsonb, 
  tags_json jsonb, 
  layer doc_layer, 
  domain text, 
  priority integer, 
  similarity double precision,
  embedding_model_id text,
  doc_title text,
  doc_status doc_status,
  retrievable boolean
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
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
    1 - (c.embedding <=> query_embedding) AS similarity,
    c.embedding_model_id,
    d.title AS doc_title,
    d.status AS doc_status,
    c.retrievable
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
$function$;