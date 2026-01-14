-- Create index for efficient few-shot correction fetching
CREATE INDEX IF NOT EXISTS idx_curated_corrections_fewshot 
ON curated_corrections(status, include_in_training, curated_at DESC)
WHERE status = 'rejected' 
  AND corrected_response IS NOT NULL 
  AND include_in_training = true;