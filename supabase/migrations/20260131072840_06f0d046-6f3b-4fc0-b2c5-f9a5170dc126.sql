-- PARTE 1: Policy INSERT para churches (permitir criação de igreja pelo próprio pastor)
CREATE POLICY "Users can create their own church"
ON public.churches FOR INSERT
TO authenticated
WITH CHECK (pastor_id = auth.uid());

-- PARTE 2: Função SECURITY DEFINER para adicionar role de forma segura
-- Valida que o usuário só pode adicionar roles para si mesmo
CREATE OR REPLACE FUNCTION public.add_user_role(_user_id uuid, _role app_role)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Validar que o usuário só pode adicionar role para si mesmo
  IF _user_id != auth.uid() THEN
    RAISE EXCEPTION 'Cannot add role for another user';
  END IF;
  
  -- Inserir role (ignorar se já existe)
  INSERT INTO public.user_roles (user_id, role)
  VALUES (_user_id, _role)
  ON CONFLICT (user_id, role) DO NOTHING;
END;
$$;

-- Conceder permissão para usuários autenticados chamarem a função
GRANT EXECUTE ON FUNCTION public.add_user_role(uuid, app_role) TO authenticated;