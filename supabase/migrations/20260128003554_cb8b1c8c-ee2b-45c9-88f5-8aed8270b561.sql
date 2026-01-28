-- =====================================================
-- FASE 1B: RLS POLICIES E FUNÇÕES COM NOVOS ROLES
-- =====================================================

-- 1. Função can_view_journey - verifica se pode ver jornada de outro usuário
CREATE OR REPLACE FUNCTION public.can_view_journey(_viewer_id uuid, _target_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT 
    -- Próprio usuário
    _viewer_id = _target_id
    -- Admin vê tudo
    OR has_role(_viewer_id, 'admin')
    -- Desenvolvedor vê tudo
    OR has_role(_viewer_id, 'desenvolvedor')
    -- Profissional vê tudo
    OR has_role(_viewer_id, 'profissional')
    -- Auditor vê tudo (dados serão anonimizados na aplicação)
    OR has_role(_viewer_id, 'auditor')
    -- Soldado vê seus acompanhados
    OR (has_role(_viewer_id, 'soldado') AND is_soldado_of(_viewer_id, _target_id))
    -- Pastor vê membros da sua igreja
    OR (has_role(_viewer_id, 'pastor') AND is_church_member_of(_viewer_id, _target_id))
$$;

-- 2. Função can_manage_church_members - verifica se pode gerenciar membros da igreja
CREATE OR REPLACE FUNCTION public.can_manage_church_members(_user_id uuid, _church_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT 
    has_role(_user_id, 'admin')
    OR has_role(_user_id, 'desenvolvedor')
    OR is_pastor_of_church(_user_id, _church_id)
    OR EXISTS (
      SELECT 1 FROM church_members cm
      JOIN user_roles ur ON ur.user_id = cm.user_id
      WHERE cm.church_id = _church_id
        AND cm.user_id = _user_id
        AND cm.status = 'active'
        AND ur.role = 'igreja'
    )
$$;

-- =====================================================
-- RLS POLICIES PARA NOVAS TABELAS
-- =====================================================

-- 3. Políticas para churches
CREATE POLICY "Admins can manage all churches" ON public.churches
FOR ALL USING (
  has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'desenvolvedor')
);

CREATE POLICY "Users can view churches they belong to" ON public.churches
FOR SELECT USING (
  EXISTS (
    SELECT 1 FROM church_members 
    WHERE church_id = churches.id 
    AND user_id = auth.uid()
    AND status = 'active'
  )
  OR pastor_id = auth.uid()
);

CREATE POLICY "Igreja role can update own church" ON public.churches
FOR UPDATE USING (
  can_manage_church_members(auth.uid(), id)
);

-- 4. Políticas para church_members
CREATE POLICY "Admins can manage all church members" ON public.church_members
FOR ALL USING (
  has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'desenvolvedor')
);

CREATE POLICY "Church managers can manage members" ON public.church_members
FOR ALL USING (
  can_manage_church_members(auth.uid(), church_id)
);

CREATE POLICY "Users can view own membership" ON public.church_members
FOR SELECT USING (
  user_id = auth.uid()
);

CREATE POLICY "Pastors can view church members" ON public.church_members
FOR SELECT USING (
  is_pastor_of_church(auth.uid(), church_id)
);

-- 5. Políticas para soldado_assignments
CREATE POLICY "Admins can manage all assignments" ON public.soldado_assignments
FOR ALL USING (
  has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'desenvolvedor')
);

CREATE POLICY "Soldados can view own assignments" ON public.soldado_assignments
FOR SELECT USING (
  soldado_id = auth.uid()
);

CREATE POLICY "Buscadores can view own assignment" ON public.soldado_assignments
FOR SELECT USING (
  buscador_id = auth.uid()
);

CREATE POLICY "Pastors can view church assignments" ON public.soldado_assignments
FOR SELECT USING (
  church_id IS NOT NULL AND is_pastor_of_church(auth.uid(), church_id)
);

CREATE POLICY "Igreja can manage church assignments" ON public.soldado_assignments
FOR ALL USING (
  church_id IS NOT NULL AND can_manage_church_members(auth.uid(), church_id)
);

-- 6. Políticas para professional_credentials
CREATE POLICY "Admins can manage all credentials" ON public.professional_credentials
FOR ALL USING (
  has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'desenvolvedor')
);

CREATE POLICY "Users can view own credentials" ON public.professional_credentials
FOR SELECT USING (
  user_id = auth.uid()
);

CREATE POLICY "Users can insert own credentials" ON public.professional_credentials
FOR INSERT WITH CHECK (
  user_id = auth.uid()
);

CREATE POLICY "Users can update own unverified credentials" ON public.professional_credentials
FOR UPDATE USING (
  user_id = auth.uid() AND verified = false
);

-- =====================================================
-- ATUALIZAR RLS POLICIES EXISTENTES
-- =====================================================

-- 7. Atualizar política de user_themes para usar can_view_journey
DROP POLICY IF EXISTS "Users can view own themes" ON public.user_themes;

CREATE POLICY "Users can view accessible themes" ON public.user_themes
FOR SELECT USING (
  can_view_journey(auth.uid(), user_id)
);

-- 8. Atualizar políticas de user_profiles para permitir acesso hierárquico
DROP POLICY IF EXISTS "Users can view their own profile" ON public.user_profiles;

CREATE POLICY "Users can view accessible profiles" ON public.user_profiles
FOR SELECT USING (
  can_view_journey(auth.uid(), id)
);

-- 9. Política para admins gerenciarem user_roles
CREATE POLICY "Admins can manage user roles" ON public.user_roles
FOR ALL USING (
  has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'desenvolvedor')
);