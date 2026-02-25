
-- Etapa 1: Flexibilizar aprovação tripla (pastor condicional)

-- Recriar a função check_soldado_approval_complete com lógica condicional
CREATE OR REPLACE FUNCTION public.check_soldado_approval_complete()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  _application_id UUID;
  _user_id UUID;
  _admin_approved BOOLEAN;
  _profissional_approved BOOLEAN;
  _pastor_approved BOOLEAN;
  _pastor_required BOOLEAN;
  _is_complete BOOLEAN;
BEGIN
  _application_id := NEW.application_id;
  
  -- Verificar se existe pelo menos 1 usuário com role 'pastor' no sistema
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles WHERE role = 'pastor'
  ) INTO _pastor_required;
  
  -- Buscar aprovações existentes
  SELECT 
    COALESCE(bool_or(approved) FILTER (WHERE approver_role = 'admin'), false),
    COALESCE(bool_or(approved) FILTER (WHERE approver_role = 'profissional'), false),
    COALESCE(bool_or(approved) FILTER (WHERE approver_role = 'pastor'), false)
  INTO _admin_approved, _profissional_approved, _pastor_approved
  FROM public.soldado_application_approvals
  WHERE application_id = _application_id;
  
  -- Determinar se aprovação está completa
  IF _pastor_required THEN
    _is_complete := _admin_approved AND _profissional_approved AND _pastor_approved;
  ELSE
    _is_complete := _admin_approved AND _profissional_approved;
  END IF;
  
  -- Se aprovação completa
  IF _is_complete THEN
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
$function$;

-- Atualizar get_application_approval_status para incluir pastor_required
CREATE OR REPLACE FUNCTION public.get_application_approval_status(_application_id uuid)
 RETURNS TABLE(admin_status text, profissional_status text, pastor_status text, total_approved integer, is_complete boolean)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  WITH approvals AS (
    SELECT approver_role, approved
    FROM public.soldado_application_approvals
    WHERE application_id = _application_id
  ),
  pastor_check AS (
    SELECT EXISTS (
      SELECT 1 FROM public.user_roles WHERE role = 'pastor'
    ) AS pastor_required
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
    CASE 
      WHEN NOT (SELECT pastor_required FROM pastor_check) THEN 'not_required'
      ELSE COALESCE(
        (SELECT CASE WHEN approved THEN 'approved' ELSE 'rejected' END FROM approvals WHERE approver_role = 'pastor'),
        'pending'
      )
    END as pastor_status,
    (SELECT COUNT(*)::int FROM approvals WHERE approved = true) as total_approved,
    CASE 
      WHEN NOT (SELECT pastor_required FROM pastor_check) THEN
        (SELECT COUNT(*) >= 2 FROM approvals WHERE approved = true 
         AND approver_role IN ('admin', 'profissional'))
      ELSE
        (SELECT COUNT(*) = 3 FROM approvals WHERE approved = true)
    END as is_complete
$function$;
