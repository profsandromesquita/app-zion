-- =============================================
-- ONBOARDING ZION: Database Migration
-- =============================================

-- 1. Add grammar_gender to profiles table
ALTER TABLE public.profiles 
ADD COLUMN IF NOT EXISTS grammar_gender TEXT;

-- Add comment for documentation
COMMENT ON COLUMN public.profiles.grammar_gender IS 'Gênero gramatical para concordância (M=masculino, F=feminino, N=neutro)';

-- 2. Add onboarding fields to user_profiles table
ALTER TABLE public.user_profiles 
ADD COLUMN IF NOT EXISTS spiritual_maturity TEXT,
ADD COLUMN IF NOT EXISTS initial_pain_focus TEXT[],
ADD COLUMN IF NOT EXISTS onboarding_completed_at TIMESTAMPTZ;

-- Add comments for documentation
COMMENT ON COLUMN public.user_profiles.spiritual_maturity IS 'Maturidade espiritual: CONSOLIDATED, DISTANT, CRISIS, SEEKER, SKEPTIC';
COMMENT ON COLUMN public.user_profiles.initial_pain_focus IS 'Tags de foco de dor iniciais do onboarding';
COMMENT ON COLUMN public.user_profiles.onboarding_completed_at IS 'Timestamp de conclusão do onboarding';

-- 3. Add check constraint for valid spiritual_maturity values
ALTER TABLE public.user_profiles 
ADD CONSTRAINT valid_spiritual_maturity 
CHECK (spiritual_maturity IS NULL OR spiritual_maturity IN ('CONSOLIDATED', 'DISTANT', 'CRISIS', 'SEEKER', 'SKEPTIC'));

-- 4. Add check constraint for valid grammar_gender values  
ALTER TABLE public.profiles 
ADD CONSTRAINT valid_grammar_gender 
CHECK (grammar_gender IS NULL OR grammar_gender IN ('M', 'F', 'N'));