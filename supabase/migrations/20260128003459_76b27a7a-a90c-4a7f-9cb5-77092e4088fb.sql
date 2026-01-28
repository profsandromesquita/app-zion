-- =====================================================
-- FASE 1A: EXPANDIR ENUM E CRIAR ESTRUTURA BASE
-- =====================================================

-- 1. Expandir enum app_role com novos valores
ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'pastor';
ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'igreja';
ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'profissional';
ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'auditor';
ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'desenvolvedor';

-- 2. Adicionar campos extras na tabela profiles
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS phone text;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS avatar_url text;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS bio text;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS is_public_profile boolean DEFAULT false;

-- 3. Criar tabela churches (Igrejas)
CREATE TABLE IF NOT EXISTS public.churches (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  address text,
  city text,
  state text,
  phone text,
  email text,
  website text,
  pastor_id uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  is_active boolean DEFAULT true,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- 4. Criar tabela church_members (Vinculação igreja-membro)
CREATE TABLE IF NOT EXISTS public.church_members (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  church_id uuid NOT NULL REFERENCES public.churches(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  member_role text NOT NULL DEFAULT 'buscador',
  joined_at timestamptz DEFAULT now(),
  status text DEFAULT 'active' CHECK (status IN ('active', 'inactive', 'pending')),
  added_by uuid REFERENCES public.profiles(id),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE(church_id, user_id)
);

-- 5. Criar tabela soldado_assignments (Acompanhamento soldado-buscador)
CREATE TABLE IF NOT EXISTS public.soldado_assignments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  soldado_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  buscador_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  church_id uuid REFERENCES public.churches(id) ON DELETE SET NULL,
  status text DEFAULT 'active' CHECK (status IN ('active', 'paused', 'completed')),
  assigned_at timestamptz DEFAULT now(),
  assigned_by uuid REFERENCES public.profiles(id),
  notes text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE(soldado_id, buscador_id)
);

-- 6. Criar tabela professional_credentials (Credenciais de profissionais)
CREATE TABLE IF NOT EXISTS public.professional_credentials (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE UNIQUE,
  profession text NOT NULL CHECK (profession IN ('psicologo', 'psiquiatra', 'terapeuta', 'outro')),
  license_number text NOT NULL,
  license_state text NOT NULL,
  verified boolean DEFAULT false,
  verified_at timestamptz,
  verified_by uuid REFERENCES public.profiles(id),
  documents_url text[],
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- 7. Criar índices para performance
CREATE INDEX IF NOT EXISTS idx_church_members_church_id ON public.church_members(church_id);
CREATE INDEX IF NOT EXISTS idx_church_members_user_id ON public.church_members(user_id);
CREATE INDEX IF NOT EXISTS idx_soldado_assignments_soldado_id ON public.soldado_assignments(soldado_id);
CREATE INDEX IF NOT EXISTS idx_soldado_assignments_buscador_id ON public.soldado_assignments(buscador_id);
CREATE INDEX IF NOT EXISTS idx_soldado_assignments_status ON public.soldado_assignments(status);
CREATE INDEX IF NOT EXISTS idx_professional_credentials_user_id ON public.professional_credentials(user_id);

-- 8. Função para contar assignments ativos de um soldado
CREATE OR REPLACE FUNCTION public.count_active_assignments(_soldado_id uuid)
RETURNS integer
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COUNT(*)::integer
  FROM soldado_assignments
  WHERE soldado_id = _soldado_id
    AND status = 'active'
$$;

-- 9. Função para verificar se soldado pode aceitar mais assignments (max 10)
CREATE OR REPLACE FUNCTION public.can_accept_assignment(_soldado_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT count_active_assignments(_soldado_id) < 10
$$;

-- 10. Função is_soldado_of - verifica se soldado acompanha buscador
CREATE OR REPLACE FUNCTION public.is_soldado_of(_soldado_id uuid, _buscador_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM soldado_assignments
    WHERE soldado_id = _soldado_id
      AND buscador_id = _buscador_id
      AND status = 'active'
  )
$$;

-- 11. Função is_pastor_of_church - verifica se é pastor da igreja
CREATE OR REPLACE FUNCTION public.is_pastor_of_church(_user_id uuid, _church_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM churches
    WHERE id = _church_id
      AND pastor_id = _user_id
      AND is_active = true
  )
$$;

-- 12. Função is_church_member_of - verifica se usuários são da mesma igreja
CREATE OR REPLACE FUNCTION public.is_church_member_of(_user_id uuid, _member_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM church_members cm1
    JOIN church_members cm2 ON cm1.church_id = cm2.church_id
    WHERE cm1.user_id = _user_id
      AND cm2.user_id = _member_id
      AND cm1.status = 'active'
      AND cm2.status = 'active'
  )
$$;

-- 13. Atualizar trigger handle_new_user para criar user_profiles
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Criar perfil básico
  INSERT INTO public.profiles (id, email, nome)
  VALUES (NEW.id, NEW.email, NEW.raw_user_meta_data ->> 'nome');
  
  -- Criar perfil de jornada espiritual
  INSERT INTO public.user_profiles (id)
  VALUES (NEW.id);
  
  -- Atribuir role padrão (buscador)
  INSERT INTO public.user_roles (user_id, role)
  VALUES (NEW.id, 'buscador');
  
  RETURN NEW;
END;
$$;

-- 14. Triggers para updated_at
CREATE OR REPLACE FUNCTION public.trigger_set_updated_at()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS set_churches_updated_at ON public.churches;
CREATE TRIGGER set_churches_updated_at
  BEFORE UPDATE ON public.churches
  FOR EACH ROW
  EXECUTE FUNCTION trigger_set_updated_at();

DROP TRIGGER IF EXISTS set_church_members_updated_at ON public.church_members;
CREATE TRIGGER set_church_members_updated_at
  BEFORE UPDATE ON public.church_members
  FOR EACH ROW
  EXECUTE FUNCTION trigger_set_updated_at();

DROP TRIGGER IF EXISTS set_soldado_assignments_updated_at ON public.soldado_assignments;
CREATE TRIGGER set_soldado_assignments_updated_at
  BEFORE UPDATE ON public.soldado_assignments
  FOR EACH ROW
  EXECUTE FUNCTION trigger_set_updated_at();

DROP TRIGGER IF EXISTS set_professional_credentials_updated_at ON public.professional_credentials;
CREATE TRIGGER set_professional_credentials_updated_at
  BEFORE UPDATE ON public.professional_credentials
  FOR EACH ROW
  EXECUTE FUNCTION trigger_set_updated_at();

-- 15. Habilitar RLS nas novas tabelas
ALTER TABLE public.churches ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.church_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.soldado_assignments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.professional_credentials ENABLE ROW LEVEL SECURITY;