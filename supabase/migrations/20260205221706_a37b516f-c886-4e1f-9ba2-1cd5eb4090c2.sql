-- Update testimonies bucket to accept video/webm and video/mp4 MIME types
-- These are needed because browsers often report .webm and .m4a files as video/* 
-- even when they contain only audio

UPDATE storage.buckets
SET allowed_mime_types = ARRAY[
  'audio/webm', 'audio/ogg', 'audio/mp4', 'audio/mpeg', 
  'audio/wav', 'audio/aac', 'audio/x-m4a', 'audio/x-wav',
  'video/webm', 'video/mp4'
]
WHERE id = 'testimonies';