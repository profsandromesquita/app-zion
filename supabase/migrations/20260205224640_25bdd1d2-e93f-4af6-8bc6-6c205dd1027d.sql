-- Permitir que usuários atualizem seus próprios arquivos de testemunho
CREATE POLICY "Users can update own testimonies"
ON storage.objects FOR UPDATE
USING (
  bucket_id = 'testimonies' 
  AND (auth.uid())::text = (storage.foldername(name))[1]
)
WITH CHECK (
  bucket_id = 'testimonies' 
  AND (auth.uid())::text = (storage.foldername(name))[1]
);

-- Permitir que usuários deletem seus próprios arquivos de testemunho
CREATE POLICY "Users can delete own testimonies"
ON storage.objects FOR DELETE
USING (
  bucket_id = 'testimonies' 
  AND (auth.uid())::text = (storage.foldername(name))[1]
);