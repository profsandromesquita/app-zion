-- Create curated_corrections table for structured curation data
CREATE TABLE public.curated_corrections (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  feedback_item_id uuid NOT NULL REFERENCES feedback_dataset_items(id) ON DELETE CASCADE,
  
  -- Structured data from curation
  status text NOT NULL CHECK (status IN ('approved', 'rejected', 'needs_review')) DEFAULT 'needs_review',
  adherence_score integer CHECK (adherence_score >= 0 AND adherence_score <= 100),
  
  -- Violations detected by curator
  violations jsonb DEFAULT '[]'::jsonb,
  
  -- Corrected response (ZION PERFECT TONE)
  corrected_response text,
  
  -- Diagnosis
  diagnosis jsonb DEFAULT '{}'::jsonb,
  
  -- Additional notes
  notes text,
  
  -- Metadata
  curator_id uuid REFERENCES profiles(id),
  curated_at timestamptz DEFAULT now(),
  include_in_training boolean DEFAULT true,
  
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  
  UNIQUE(feedback_item_id)
);

-- Enable RLS
ALTER TABLE public.curated_corrections ENABLE ROW LEVEL SECURITY;

-- Admins can do everything
CREATE POLICY "Admins can view curated_corrections"
ON public.curated_corrections FOR SELECT
USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins can insert curated_corrections"
ON public.curated_corrections FOR INSERT
WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins can update curated_corrections"
ON public.curated_corrections FOR UPDATE
USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins can delete curated_corrections"
ON public.curated_corrections FOR DELETE
USING (has_role(auth.uid(), 'admin'::app_role));

-- Trigger for updated_at
CREATE TRIGGER update_curated_corrections_updated_at
BEFORE UPDATE ON public.curated_corrections
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Create index for faster lookups
CREATE INDEX idx_curated_corrections_feedback_item_id ON public.curated_corrections(feedback_item_id);
CREATE INDEX idx_curated_corrections_status ON public.curated_corrections(status);

-- Add comment
COMMENT ON TABLE public.curated_corrections IS 'Stores structured curation data for feedback items, including corrected responses for fine-tuning';