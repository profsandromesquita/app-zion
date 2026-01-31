-- Criar tabela para armazenar subscrições push
CREATE TABLE public.push_subscriptions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  endpoint text NOT NULL,
  p256dh text NOT NULL,
  auth text NOT NULL,
  device_info jsonb DEFAULT '{}',
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  is_active boolean DEFAULT true,
  UNIQUE(user_id, endpoint)
);

-- Adicionar campo last_active_at na tabela profiles
ALTER TABLE public.profiles 
ADD COLUMN IF NOT EXISTS last_active_at timestamptz DEFAULT now();

-- Índice para busca de usuários inativos
CREATE INDEX idx_profiles_last_active 
ON public.profiles(last_active_at) 
WHERE last_active_at IS NOT NULL;

-- Índice para buscar subscrições ativas
CREATE INDEX idx_push_subscriptions_active 
ON public.push_subscriptions(user_id, is_active) 
WHERE is_active = true;

-- RLS para push_subscriptions
ALTER TABLE public.push_subscriptions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage own subscriptions"
ON public.push_subscriptions FOR ALL
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Service can read all subscriptions"
ON public.push_subscriptions FOR SELECT
USING (true);

-- Trigger para atualizar updated_at
CREATE TRIGGER update_push_subscriptions_updated_at
BEFORE UPDATE ON public.push_subscriptions
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();