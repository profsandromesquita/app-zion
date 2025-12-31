-- Corrigir função calculate_content_hash para ter search_path
CREATE OR REPLACE FUNCTION public.calculate_content_hash(content TEXT)
RETURNS TEXT
LANGUAGE sql
IMMUTABLE
SET search_path = public
AS $$
  SELECT encode(sha256(content::bytea), 'hex')
$$;