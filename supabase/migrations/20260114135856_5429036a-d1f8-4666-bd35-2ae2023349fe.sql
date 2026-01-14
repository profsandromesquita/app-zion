-- Adicionar coluna phase em feedback_dataset_items
ALTER TABLE public.feedback_dataset_items 
ADD COLUMN IF NOT EXISTS phase text;

-- Comentário para documentação
COMMENT ON COLUMN public.feedback_dataset_items.phase IS 'Fase da jornada do usuário (CAOS, PADROES, INTEGRACAO, ACOLHIMENTO, CLARIFICACAO) no momento do feedback';

-- Índice composto para busca híbrida eficiente por phase + intent
CREATE INDEX IF NOT EXISTS idx_feedback_dataset_phase_intent 
ON public.feedback_dataset_items(phase, intent);

-- Índice para curated_corrections otimizado para treinamento
CREATE INDEX IF NOT EXISTS idx_curated_corrections_training 
ON public.curated_corrections(status, include_in_training, curated_at DESC)
WHERE corrected_response IS NOT NULL;