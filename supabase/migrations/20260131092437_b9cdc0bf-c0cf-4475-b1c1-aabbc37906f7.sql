-- ============================================
-- MIGRATION: Igreja nunca tem onboarding
-- ============================================

-- 1. Atualizar handle_new_user para detectar account_type e atribuir role correta
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _account_type text;
  _role app_role;
BEGIN
  -- Ler account_type do metadata (se existir)
  _account_type := NEW.raw_user_meta_data ->> 'account_type';
  
  -- Determinar role baseado no account_type
  IF _account_type = 'igreja' THEN
    _role := 'igreja';
  ELSE
    _role := 'buscador';
  END IF;

  -- Criar perfil básico
  INSERT INTO public.profiles (id, email, nome)
  VALUES (NEW.id, NEW.email, NEW.raw_user_meta_data ->> 'nome');
  
  -- Criar perfil de jornada espiritual
  -- Se for igreja, já marcar onboarding como completo
  IF _account_type = 'igreja' THEN
    INSERT INTO public.user_profiles (id, onboarding_completed_at)
    VALUES (NEW.id, now());
  ELSE
    INSERT INTO public.user_profiles (id)
    VALUES (NEW.id);
  END IF;
  
  -- Atribuir role apropriada
  INSERT INTO public.user_roles (user_id, role)
  VALUES (NEW.id, _role);
  
  RETURN NEW;
END;
$$;

-- 2. Backfill: Adicionar role 'igreja' para todos os pastores existentes
INSERT INTO public.user_roles (user_id, role)
SELECT DISTINCT c.pastor_id, 'igreja'::app_role
FROM public.churches c
WHERE c.pastor_id IS NOT NULL
ON CONFLICT (user_id, role) DO NOTHING;

-- 3. Backfill: Marcar onboarding como completo para igrejas existentes
UPDATE public.user_profiles
SET onboarding_completed_at = now()
WHERE id IN (
  SELECT DISTINCT pastor_id 
  FROM public.churches 
  WHERE pastor_id IS NOT NULL
)
AND onboarding_completed_at IS NULL;