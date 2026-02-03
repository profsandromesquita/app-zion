-- ===========================================
-- ETAPA 1: Schema de Candidatura a Soldado
-- ===========================================

-- 1. Criar enum para status de candidatura
CREATE TYPE soldado_application_status AS ENUM (
  'pending',           -- Aguardando testemunho
  'testimony_required', -- Testemunho pendente
  'under_review',      -- Em análise pelos curadores
  'approved',          -- Aprovado (role atribuída)
  'rejected'           -- Rejeitado
);

-- 2. Tabela de candidaturas a soldado
CREATE TABLE public.soldado_applications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  sponsored_by UUID NOT NULL REFERENCES public.profiles(id),
  sponsor_role app_role NOT NULL,
  status soldado_application_status NOT NULL DEFAULT 'pending',
  testimony_id UUID, -- Será FK para testimonies quando criada
  rejection_reason TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  
  -- Um usuário só pode ter uma candidatura ativa por vez
  CONSTRAINT unique_active_application UNIQUE (user_id)
);

-- 3. Tabela de aprovações (multi-autoridade)
CREATE TABLE public.soldado_application_approvals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  application_id UUID NOT NULL REFERENCES public.soldado_applications(id) ON DELETE CASCADE,
  approver_id UUID NOT NULL REFERENCES public.profiles(id),
  approver_role app_role NOT NULL,
  approved BOOLEAN NOT NULL,
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  
  -- Uma aprovação por role por candidatura
  CONSTRAINT unique_approval_per_role UNIQUE (application_id, approver_role),
  
  -- Apenas admin, profissional ou pastor podem aprovar
  CONSTRAINT valid_approver_role CHECK (approver_role IN ('admin', 'profissional', 'pastor'))
);

-- 4. Índices para performance
CREATE INDEX idx_soldado_applications_status ON public.soldado_applications(status);
CREATE INDEX idx_soldado_applications_user ON public.soldado_applications(user_id);
CREATE INDEX idx_soldado_applications_sponsor ON public.soldado_applications(sponsored_by);
CREATE INDEX idx_soldado_approvals_application ON public.soldado_application_approvals(application_id);

-- 5. Trigger para updated_at
CREATE TRIGGER set_soldado_applications_updated_at
  BEFORE UPDATE ON public.soldado_applications
  FOR EACH ROW
  EXECUTE FUNCTION public.trigger_set_updated_at();

-- 6. Habilitar RLS
ALTER TABLE public.soldado_applications ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.soldado_application_approvals ENABLE ROW LEVEL SECURITY;

-- 7. RLS Policies para soldado_applications

-- Admin e Desenvolvedor podem ver todas as candidaturas
CREATE POLICY "Admins can view all applications"
  ON public.soldado_applications
  FOR SELECT
  USING (has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'desenvolvedor'));

-- Admin e Desenvolvedor podem gerenciar todas as candidaturas
CREATE POLICY "Admins can manage all applications"
  ON public.soldado_applications
  FOR ALL
  USING (has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'desenvolvedor'));

-- Igreja pode criar candidaturas
CREATE POLICY "Igreja can create applications"
  ON public.soldado_applications
  FOR INSERT
  WITH CHECK (
    has_role(auth.uid(), 'igreja') 
    AND sponsored_by = auth.uid()
    AND sponsor_role = 'igreja'
  );

-- Profissional pode criar candidaturas
CREATE POLICY "Profissional can create applications"
  ON public.soldado_applications
  FOR INSERT
  WITH CHECK (
    has_role(auth.uid(), 'profissional')
    AND sponsored_by = auth.uid()
    AND sponsor_role = 'profissional'
  );

-- Usuário pode ver sua própria candidatura
CREATE POLICY "Users can view own application"
  ON public.soldado_applications
  FOR SELECT
  USING (user_id = auth.uid());

-- Pastor pode ver candidaturas para aprovar
CREATE POLICY "Pastor can view applications for approval"
  ON public.soldado_applications
  FOR SELECT
  USING (
    has_role(auth.uid(), 'pastor')
    AND status IN ('under_review', 'testimony_required')
  );

-- Profissional pode ver candidaturas para aprovar
CREATE POLICY "Profissional can view applications for approval"
  ON public.soldado_applications
  FOR SELECT
  USING (
    has_role(auth.uid(), 'profissional')
    AND status IN ('under_review', 'testimony_required')
  );

-- 8. RLS Policies para soldado_application_approvals

-- Admin e Desenvolvedor podem ver todas as aprovações
CREATE POLICY "Admins can view all approvals"
  ON public.soldado_application_approvals
  FOR SELECT
  USING (has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'desenvolvedor'));

-- Admin e Desenvolvedor podem gerenciar aprovações
CREATE POLICY "Admins can manage all approvals"
  ON public.soldado_application_approvals
  FOR ALL
  USING (has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'desenvolvedor'));

-- Admin pode inserir aprovação como admin
CREATE POLICY "Admin can insert admin approval"
  ON public.soldado_application_approvals
  FOR INSERT
  WITH CHECK (
    has_role(auth.uid(), 'admin')
    AND approver_id = auth.uid()
    AND approver_role = 'admin'
  );

-- Profissional pode inserir aprovação como profissional
CREATE POLICY "Profissional can insert profissional approval"
  ON public.soldado_application_approvals
  FOR INSERT
  WITH CHECK (
    has_role(auth.uid(), 'profissional')
    AND approver_id = auth.uid()
    AND approver_role = 'profissional'
  );

-- Pastor pode inserir aprovação como pastor
CREATE POLICY "Pastor can insert pastor approval"
  ON public.soldado_application_approvals
  FOR INSERT
  WITH CHECK (
    has_role(auth.uid(), 'pastor')
    AND approver_id = auth.uid()
    AND approver_role = 'pastor'
  );

-- Usuário pode ver aprovações da sua candidatura
CREATE POLICY "Users can view own application approvals"
  ON public.soldado_application_approvals
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.soldado_applications sa
      WHERE sa.id = application_id
      AND sa.user_id = auth.uid()
    )
  );

-- 9. Função para verificar aprovação completa e atribuir role
CREATE OR REPLACE FUNCTION public.check_soldado_approval_complete()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _application_id UUID;
  _user_id UUID;
  _admin_approved BOOLEAN;
  _profissional_approved BOOLEAN;
  _pastor_approved BOOLEAN;
BEGIN
  _application_id := NEW.application_id;
  
  -- Buscar aprovações existentes
  SELECT 
    COALESCE(bool_or(approved) FILTER (WHERE approver_role = 'admin'), false),
    COALESCE(bool_or(approved) FILTER (WHERE approver_role = 'profissional'), false),
    COALESCE(bool_or(approved) FILTER (WHERE approver_role = 'pastor'), false)
  INTO _admin_approved, _profissional_approved, _pastor_approved
  FROM public.soldado_application_approvals
  WHERE application_id = _application_id;
  
  -- Se todas as 3 autoridades aprovaram
  IF _admin_approved AND _profissional_approved AND _pastor_approved THEN
    -- Buscar user_id da candidatura
    SELECT user_id INTO _user_id
    FROM public.soldado_applications
    WHERE id = _application_id;
    
    -- Atribuir role de soldado (se não existir)
    INSERT INTO public.user_roles (user_id, role)
    VALUES (_user_id, 'soldado')
    ON CONFLICT (user_id, role) DO NOTHING;
    
    -- Atualizar status da candidatura
    UPDATE public.soldado_applications
    SET status = 'approved', updated_at = now()
    WHERE id = _application_id;
    
    RAISE NOTICE 'Soldado aprovado: user_id = %', _user_id;
  END IF;
  
  RETURN NEW;
END;
$$;

-- 10. Trigger para auto-aprovar quando completo
CREATE TRIGGER trigger_check_soldado_approval
  AFTER INSERT ON public.soldado_application_approvals
  FOR EACH ROW
  WHEN (NEW.approved = true)
  EXECUTE FUNCTION public.check_soldado_approval_complete();

-- 11. Função para verificar se pode criar candidatura
CREATE OR REPLACE FUNCTION public.can_sponsor_soldado(_sponsor_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT 
    has_role(_sponsor_id, 'admin')
    OR has_role(_sponsor_id, 'desenvolvedor')
    OR has_role(_sponsor_id, 'igreja')
    OR has_role(_sponsor_id, 'profissional')
$$;

-- 12. Função para contar aprovações pendentes por candidatura
CREATE OR REPLACE FUNCTION public.get_application_approval_status(_application_id UUID)
RETURNS TABLE (
  admin_status TEXT,
  profissional_status TEXT,
  pastor_status TEXT,
  total_approved INT,
  is_complete BOOLEAN
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  WITH approvals AS (
    SELECT approver_role, approved
    FROM public.soldado_application_approvals
    WHERE application_id = _application_id
  )
  SELECT
    COALESCE(
      (SELECT CASE WHEN approved THEN 'approved' ELSE 'rejected' END FROM approvals WHERE approver_role = 'admin'),
      'pending'
    ) as admin_status,
    COALESCE(
      (SELECT CASE WHEN approved THEN 'approved' ELSE 'rejected' END FROM approvals WHERE approver_role = 'profissional'),
      'pending'
    ) as profissional_status,
    COALESCE(
      (SELECT CASE WHEN approved THEN 'approved' ELSE 'rejected' END FROM approvals WHERE approver_role = 'pastor'),
      'pending'
    ) as pastor_status,
    (SELECT COUNT(*)::int FROM approvals WHERE approved = true) as total_approved,
    (SELECT COUNT(*) = 3 FROM approvals WHERE approved = true) as is_complete
$$;