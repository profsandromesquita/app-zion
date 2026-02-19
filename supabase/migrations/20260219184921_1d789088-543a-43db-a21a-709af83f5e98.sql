
-- ============================================
-- SECURITY FIX: ai_prompt_blocks
-- 1) Remove permissive SELECT policy (USING true)
-- 2) Remove FK to auth.users to avoid coupling to reserved schema
-- ============================================

-- Drop permissive policy (if exists)
DROP POLICY IF EXISTS "Service role can read ai_prompt_blocks" ON public.ai_prompt_blocks;

-- Drop FK to auth.users if it exists
DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'ai_prompt_blocks_updated_by_fkey'
  ) THEN
    ALTER TABLE public.ai_prompt_blocks
      DROP CONSTRAINT ai_prompt_blocks_updated_by_fkey;
  END IF;
END $$;
