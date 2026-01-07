-- FASE 1: Publicar todos os documentos que têm chunks com embedding OK
-- Isso corrige o problema crítico onde search_chunks filtra por status='published'

-- Atualizar documentos para published
UPDATE documents 
SET status = 'published', updated_at = now()
WHERE id IN (
  SELECT DISTINCT c.doc_id 
  FROM chunks c 
  WHERE c.embedding_status = 'ok'
);

-- Atualizar versões correspondentes para published
UPDATE document_versions 
SET status = 'published'
WHERE id IN (
  SELECT current_version_id FROM documents WHERE status = 'published' AND current_version_id IS NOT NULL
);

-- FASE 3: Marcar System Instruction Main como pinned (Constituição)
UPDATE system_instructions 
SET is_pinned = true, updated_at = now()
WHERE name = 'System Instruction Main';