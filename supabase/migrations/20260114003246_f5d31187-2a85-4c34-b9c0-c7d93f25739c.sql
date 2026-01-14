-- Create theme_status enum
CREATE TYPE theme_status AS ENUM ('active', 'in_progress', 'resolved', 'dormant');

-- Create user_themes table for detected themes per user
CREATE TABLE user_themes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  
  -- Theme identification (ZION Taxonomy)
  theme_label text NOT NULL,
  scenario text NOT NULL,
  center text NOT NULL CHECK (center IN ('INSTINTIVO', 'EMOCIONAL', 'MENTAL')),
  security_matrix text NOT NULL CHECK (security_matrix IN ('SOBREVIVENCIA', 'IDENTIDADE', 'CAPACIDADE')),
  
  -- Journey state for THIS THEME
  current_phase text DEFAULT 'ACOLHIMENTO',
  phase_confidence real DEFAULT 0,
  total_shifts integer DEFAULT 0,
  avg_score real DEFAULT 0,
  
  -- Consolidated lies and truths
  primary_lie jsonb DEFAULT '{}',
  target_truth jsonb DEFAULT '{}',
  secondary_lies jsonb[] DEFAULT '{}',
  
  -- Related sessions
  session_ids uuid[] DEFAULT '{}',
  turn_count integer DEFAULT 0,
  
  -- Metadata
  status theme_status DEFAULT 'active',
  first_detected_at timestamptz DEFAULT now(),
  last_activity_at timestamptz DEFAULT now(),
  resolved_at timestamptz,
  
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  
  UNIQUE(user_id, scenario, security_matrix)
);

-- Enable RLS on user_themes
ALTER TABLE user_themes ENABLE ROW LEVEL SECURITY;

-- RLS Policies for user_themes
CREATE POLICY "Users can view own themes" ON user_themes
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Admins can view all themes" ON user_themes
  FOR SELECT USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Service role can insert themes" ON user_themes
  FOR INSERT WITH CHECK (true);

CREATE POLICY "Service role can update themes" ON user_themes
  FOR UPDATE USING (true);

-- Add taxonomy columns to turn_insights
ALTER TABLE turn_insights 
ADD COLUMN IF NOT EXISTS lie_scenario text,
ADD COLUMN IF NOT EXISTS lie_center text CHECK (lie_center IS NULL OR lie_center IN ('INSTINTIVO', 'EMOCIONAL', 'MENTAL')),
ADD COLUMN IF NOT EXISTS lie_security_matrix text CHECK (lie_security_matrix IS NULL OR lie_security_matrix IN ('SOBREVIVENCIA', 'IDENTIDADE', 'CAPACIDADE'));

-- Create index for taxonomy queries
CREATE INDEX IF NOT EXISTS idx_turn_insights_taxonomy ON turn_insights(lie_center, lie_security_matrix);
CREATE INDEX IF NOT EXISTS idx_turn_insights_user_taxonomy ON turn_insights(chat_session_id, lie_security_matrix);

-- Add aggregate columns to user_profiles
ALTER TABLE user_profiles
ADD COLUMN IF NOT EXISTS primary_center text,
ADD COLUMN IF NOT EXISTS primary_security_matrix text,
ADD COLUMN IF NOT EXISTS active_themes_count integer DEFAULT 0,
ADD COLUMN IF NOT EXISTS total_shifts integer DEFAULT 0,
ADD COLUMN IF NOT EXISTS global_avg_score real DEFAULT 0;

-- Create indexes for user_themes
CREATE INDEX IF NOT EXISTS idx_user_themes_user ON user_themes(user_id);
CREATE INDEX IF NOT EXISTS idx_user_themes_status ON user_themes(status);
CREATE INDEX IF NOT EXISTS idx_user_themes_taxonomy ON user_themes(security_matrix, center);
CREATE INDEX IF NOT EXISTS idx_user_themes_activity ON user_themes(last_activity_at DESC);

-- Trigger to update updated_at on user_themes
CREATE TRIGGER update_user_themes_updated_at
  BEFORE UPDATE ON user_themes
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();