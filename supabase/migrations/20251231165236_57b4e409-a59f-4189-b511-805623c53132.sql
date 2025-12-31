-- Tabela para base de conhecimento (arquivos .md)
CREATE TABLE public.knowledge_base (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  content TEXT NOT NULL,
  file_name TEXT,
  category TEXT DEFAULT 'general',
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL
);

-- Tabela para instruções do sistema
CREATE TABLE public.system_instructions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  content TEXT NOT NULL,
  is_active BOOLEAN DEFAULT true,
  priority INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Habilitar RLS
ALTER TABLE public.knowledge_base ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.system_instructions ENABLE ROW LEVEL SECURITY;

-- Políticas RLS para knowledge_base (apenas admins)
CREATE POLICY "Admins can view knowledge base"
ON public.knowledge_base FOR SELECT
TO authenticated
USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can insert knowledge base"
ON public.knowledge_base FOR INSERT
TO authenticated
WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can update knowledge base"
ON public.knowledge_base FOR UPDATE
TO authenticated
USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can delete knowledge base"
ON public.knowledge_base FOR DELETE
TO authenticated
USING (public.has_role(auth.uid(), 'admin'));

-- Políticas RLS para system_instructions (apenas admins)
CREATE POLICY "Admins can view system instructions"
ON public.system_instructions FOR SELECT
TO authenticated
USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can insert system instructions"
ON public.system_instructions FOR INSERT
TO authenticated
WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can update system instructions"
ON public.system_instructions FOR UPDATE
TO authenticated
USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can delete system instructions"
ON public.system_instructions FOR DELETE
TO authenticated
USING (public.has_role(auth.uid(), 'admin'));

-- Triggers para updated_at
CREATE TRIGGER update_knowledge_base_updated_at
BEFORE UPDATE ON public.knowledge_base
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_system_instructions_updated_at
BEFORE UPDATE ON public.system_instructions
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();