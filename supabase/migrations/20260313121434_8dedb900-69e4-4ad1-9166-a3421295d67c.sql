
-- Create feature_flags table
CREATE TABLE public.feature_flags (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  key text UNIQUE NOT NULL,
  description text,
  enabled boolean NOT NULL DEFAULT false,
  environment text NOT NULL DEFAULT 'all',
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.feature_flags ENABLE ROW LEVEL SECURITY;

-- Any authenticated user can read flags
CREATE POLICY "Anyone can read flags" ON public.feature_flags
  FOR SELECT TO authenticated USING (true);

-- Only admin/dev can manage flags
CREATE POLICY "Admins can manage flags" ON public.feature_flags
  FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'desenvolvedor'))
  WITH CHECK (has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'desenvolvedor'));

-- Trigger for updated_at
CREATE TRIGGER set_feature_flags_updated_at 
  BEFORE UPDATE ON public.feature_flags
  FOR EACH ROW EXECUTE FUNCTION trigger_set_updated_at();
