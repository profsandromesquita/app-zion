-- ===========================================
-- ETAPA 6: Perfil e Disponibilidade do Soldado
-- ===========================================

-- Tabela de perfis públicos dos Soldados
CREATE TABLE public.soldado_profiles (
  id UUID PRIMARY KEY REFERENCES public.profiles(id) ON DELETE CASCADE,
  display_name TEXT,
  bio TEXT,
  testimony_id UUID REFERENCES public.testimonies(id),
  specialties TEXT[] DEFAULT '{}',
  is_available BOOLEAN DEFAULT true,
  max_weekly_sessions INTEGER DEFAULT 5 CHECK (max_weekly_sessions >= 1 AND max_weekly_sessions <= 20),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Índices para busca
CREATE INDEX idx_soldado_profiles_available ON public.soldado_profiles(is_available) WHERE is_available = true;
CREATE INDEX idx_soldado_profiles_specialties ON public.soldado_profiles USING GIN(specialties);

-- Tabela de disponibilidade semanal
CREATE TABLE public.soldado_availability (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  soldado_id UUID NOT NULL REFERENCES public.soldado_profiles(id) ON DELETE CASCADE,
  day_of_week INTEGER NOT NULL CHECK (day_of_week >= 0 AND day_of_week <= 6),
  start_time TIME NOT NULL,
  end_time TIME NOT NULL,
  timezone TEXT DEFAULT 'America/Sao_Paulo',
  is_recurring BOOLEAN DEFAULT true,
  specific_date DATE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  -- Constraint para garantir que end_time > start_time
  CONSTRAINT valid_time_range CHECK (end_time > start_time)
);

-- Índices para busca de disponibilidade
CREATE INDEX idx_soldado_availability_soldado ON public.soldado_availability(soldado_id);
CREATE INDEX idx_soldado_availability_day ON public.soldado_availability(day_of_week);
CREATE INDEX idx_soldado_availability_specific ON public.soldado_availability(specific_date) WHERE specific_date IS NOT NULL;

-- Triggers para updated_at
CREATE TRIGGER set_soldado_profiles_updated_at
  BEFORE UPDATE ON public.soldado_profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.trigger_set_updated_at();

CREATE TRIGGER set_soldado_availability_updated_at
  BEFORE UPDATE ON public.soldado_availability
  FOR EACH ROW
  EXECUTE FUNCTION public.trigger_set_updated_at();

-- ===========================================
-- RLS Policies para soldado_profiles
-- ===========================================
ALTER TABLE public.soldado_profiles ENABLE ROW LEVEL SECURITY;

-- Soldados podem ver e editar seu próprio perfil
CREATE POLICY "Soldados can manage own profile"
  ON public.soldado_profiles
  FOR ALL
  USING (id = auth.uid() AND has_role(auth.uid(), 'soldado'))
  WITH CHECK (id = auth.uid() AND has_role(auth.uid(), 'soldado'));

-- Buscadores podem ver perfis disponíveis (para matchmaking)
CREATE POLICY "Buscadores can view available profiles"
  ON public.soldado_profiles
  FOR SELECT
  USING (
    is_available = true 
    AND has_role(auth.uid(), 'buscador')
  );

-- Admins e desenvolvedores podem ver todos os perfis
CREATE POLICY "Admins can view all soldado profiles"
  ON public.soldado_profiles
  FOR SELECT
  USING (
    has_role(auth.uid(), 'admin') 
    OR has_role(auth.uid(), 'desenvolvedor')
  );

-- Admins podem gerenciar todos os perfis
CREATE POLICY "Admins can manage all soldado profiles"
  ON public.soldado_profiles
  FOR ALL
  USING (
    has_role(auth.uid(), 'admin') 
    OR has_role(auth.uid(), 'desenvolvedor')
  );

-- ===========================================
-- RLS Policies para soldado_availability
-- ===========================================
ALTER TABLE public.soldado_availability ENABLE ROW LEVEL SECURITY;

-- Soldados podem gerenciar sua própria disponibilidade
CREATE POLICY "Soldados can manage own availability"
  ON public.soldado_availability
  FOR ALL
  USING (soldado_id = auth.uid() AND has_role(auth.uid(), 'soldado'))
  WITH CHECK (soldado_id = auth.uid() AND has_role(auth.uid(), 'soldado'));

-- Buscadores podem ver disponibilidade de soldados disponíveis
CREATE POLICY "Buscadores can view available soldados availability"
  ON public.soldado_availability
  FOR SELECT
  USING (
    has_role(auth.uid(), 'buscador')
    AND EXISTS (
      SELECT 1 FROM public.soldado_profiles sp
      WHERE sp.id = soldado_availability.soldado_id
      AND sp.is_available = true
    )
  );

-- Admins podem ver toda disponibilidade
CREATE POLICY "Admins can view all availability"
  ON public.soldado_availability
  FOR SELECT
  USING (
    has_role(auth.uid(), 'admin') 
    OR has_role(auth.uid(), 'desenvolvedor')
  );

-- ===========================================
-- Função para criar perfil do soldado automaticamente
-- ===========================================
CREATE OR REPLACE FUNCTION public.create_soldado_profile_on_approval()
RETURNS TRIGGER AS $$
DECLARE
  _user_id UUID;
  _testimony_id UUID;
  _user_name TEXT;
BEGIN
  -- Só executar quando status muda para 'approved'
  IF NEW.status = 'approved' AND (OLD.status IS NULL OR OLD.status != 'approved') THEN
    _user_id := NEW.user_id;
    _testimony_id := NEW.testimony_id;
    
    -- Buscar nome do usuário
    SELECT nome INTO _user_name
    FROM public.profiles
    WHERE id = _user_id;
    
    -- Criar perfil do soldado se não existir
    INSERT INTO public.soldado_profiles (id, display_name, testimony_id)
    VALUES (_user_id, _user_name, _testimony_id)
    ON CONFLICT (id) DO UPDATE
    SET testimony_id = EXCLUDED.testimony_id,
        updated_at = now();
    
    RAISE NOTICE 'Soldado profile created for user_id = %', _user_id;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Trigger para criar perfil quando candidatura é aprovada
CREATE TRIGGER trigger_create_soldado_profile
  AFTER UPDATE ON public.soldado_applications
  FOR EACH ROW
  EXECUTE FUNCTION public.create_soldado_profile_on_approval();

-- ===========================================
-- Função para contar sessões da semana atual
-- ===========================================
CREATE OR REPLACE FUNCTION public.get_soldado_weekly_sessions(_soldado_id UUID)
RETURNS INTEGER AS $$
  SELECT COUNT(*)::INTEGER
  FROM public.soldado_assignments
  WHERE soldado_id = _soldado_id
    AND status = 'active'
    AND assigned_at >= date_trunc('week', CURRENT_TIMESTAMP)
$$ LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public;