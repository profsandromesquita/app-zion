-- =====================================================
-- ZION RAG PIPELINE - DATABASE SCHEMA
-- =====================================================

-- 1. Criar enum para tipos de feedback
CREATE TYPE public.feedback_type AS ENUM ('helpful', 'not_helpful', 'heresia');

-- 2. Criar enum para níveis de risco
CREATE TYPE public.risk_level AS ENUM ('none', 'low', 'medium', 'high');

-- 3. Criar tabela user_profiles (perfis espirituais/psicológicos)
CREATE TABLE public.user_profiles (
    id uuid PRIMARY KEY REFERENCES public.profiles(id) ON DELETE CASCADE,
    perfil_disc text,
    eneagrama text,
    centros jsonb DEFAULT '{}',
    dom_original text,
    virtude_hiperdesenvolvida text,
    seguranca_quebrada_primaria text,
    medo_raiz_dominante text,
    mecanismo_defesa_padrao text,
    fase_jornada text DEFAULT 'inicio',
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);

-- 4. Criar tabela memory_items (memória leve de sessão)
CREATE TABLE public.memory_items (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    session_id uuid REFERENCES public.chat_sessions(id) ON DELETE CASCADE,
    user_id uuid REFERENCES public.profiles(id) ON DELETE CASCADE,
    key text NOT NULL,
    value jsonb NOT NULL,
    confidence float DEFAULT 0.5,
    ttl timestamp with time zone,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT memory_items_session_or_user CHECK (session_id IS NOT NULL OR user_id IS NOT NULL)
);

-- 5. Criar tabela retrieval_logs (auditoria RAG)
CREATE TABLE public.retrieval_logs (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    message_id uuid REFERENCES public.chat_messages(id) ON DELETE CASCADE,
    session_id uuid REFERENCES public.chat_sessions(id) ON DELETE CASCADE NOT NULL,
    query_text text NOT NULL,
    intent text,
    role text,
    retrieved_chunk_ids uuid[] DEFAULT '{}',
    filters_used jsonb DEFAULT '{}',
    scores_json jsonb DEFAULT '{}',
    rag_plan jsonb DEFAULT '{}',
    latency_ms integer,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);

-- 6. Criar tabela feedback_events
CREATE TABLE public.feedback_events (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    message_id uuid REFERENCES public.chat_messages(id) ON DELETE CASCADE NOT NULL,
    session_id uuid REFERENCES public.chat_sessions(id) ON DELETE CASCADE NOT NULL,
    user_id uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
    type feedback_type NOT NULL,
    reason text,
    reviewed_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
    reviewed_at timestamp with time zone,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);

-- 7. Criar tabela crisis_events (eventos de crise)
CREATE TABLE public.crisis_events (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    session_id uuid REFERENCES public.chat_sessions(id) ON DELETE CASCADE NOT NULL,
    user_id uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
    message_id uuid REFERENCES public.chat_messages(id) ON DELETE CASCADE,
    risk_level risk_level NOT NULL,
    keywords_matched text[] DEFAULT '{}',
    crisis_response_sent text,
    admin_notified boolean DEFAULT false,
    reviewed_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
    reviewed_at timestamp with time zone,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);

-- 8. Alterar tabela chat_sessions para adicionar locale
ALTER TABLE public.chat_sessions 
ADD COLUMN IF NOT EXISTS locale text DEFAULT 'pt-BR';

-- 9. Alterar tabela chat_messages para adicionar metadados
ALTER TABLE public.chat_messages 
ADD COLUMN IF NOT EXISTS risk_level risk_level DEFAULT 'none',
ADD COLUMN IF NOT EXISTS intent text,
ADD COLUMN IF NOT EXISTS role_detected text,
ADD COLUMN IF NOT EXISTS metadata jsonb DEFAULT '{}';

-- 10. Alterar tabela system_instructions para suportar pinned (Constituição)
ALTER TABLE public.system_instructions
ADD COLUMN IF NOT EXISTS is_pinned boolean DEFAULT false,
ADD COLUMN IF NOT EXISTS layer text DEFAULT 'BIBLIOTECA';

-- 11. Criar índices para performance
CREATE INDEX IF NOT EXISTS idx_memory_items_session ON public.memory_items(session_id);
CREATE INDEX IF NOT EXISTS idx_memory_items_user ON public.memory_items(user_id);
CREATE INDEX IF NOT EXISTS idx_memory_items_key ON public.memory_items(key);
CREATE INDEX IF NOT EXISTS idx_retrieval_logs_session ON public.retrieval_logs(session_id);
CREATE INDEX IF NOT EXISTS idx_retrieval_logs_message ON public.retrieval_logs(message_id);
CREATE INDEX IF NOT EXISTS idx_feedback_events_message ON public.feedback_events(message_id);
CREATE INDEX IF NOT EXISTS idx_feedback_events_type ON public.feedback_events(type);
CREATE INDEX IF NOT EXISTS idx_crisis_events_session ON public.crisis_events(session_id);
CREATE INDEX IF NOT EXISTS idx_crisis_events_risk ON public.crisis_events(risk_level);

-- 12. Habilitar RLS nas novas tabelas
ALTER TABLE public.user_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.memory_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.retrieval_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.feedback_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.crisis_events ENABLE ROW LEVEL SECURITY;

-- 13. Políticas RLS para user_profiles
CREATE POLICY "Users can view their own profile" ON public.user_profiles
    FOR SELECT USING (auth.uid() = id);

CREATE POLICY "Users can update their own profile" ON public.user_profiles
    FOR UPDATE USING (auth.uid() = id);

CREATE POLICY "Users can insert their own profile" ON public.user_profiles
    FOR INSERT WITH CHECK (auth.uid() = id);

CREATE POLICY "Admins can view all user_profiles" ON public.user_profiles
    FOR SELECT USING (has_role(auth.uid(), 'admin'));

-- 14. Políticas RLS para memory_items
CREATE POLICY "Users can view their own memory items" ON public.memory_items
    FOR SELECT USING (
        user_id = auth.uid() OR 
        session_id IN (SELECT id FROM public.chat_sessions WHERE user_id = auth.uid())
    );

CREATE POLICY "Anyone can insert memory items" ON public.memory_items
    FOR INSERT WITH CHECK (true);

CREATE POLICY "Users can update their own memory items" ON public.memory_items
    FOR UPDATE USING (
        user_id = auth.uid() OR 
        session_id IN (SELECT id FROM public.chat_sessions WHERE user_id = auth.uid() OR session_token IS NOT NULL)
    );

-- 15. Políticas RLS para retrieval_logs (somente admin)
CREATE POLICY "Admins can view retrieval logs" ON public.retrieval_logs
    FOR SELECT USING (has_role(auth.uid(), 'admin'));

CREATE POLICY "Anyone can insert retrieval logs" ON public.retrieval_logs
    FOR INSERT WITH CHECK (true);

-- 16. Políticas RLS para feedback_events
CREATE POLICY "Users can view their own feedback" ON public.feedback_events
    FOR SELECT USING (
        user_id = auth.uid() OR 
        session_id IN (SELECT id FROM public.chat_sessions WHERE user_id = auth.uid() OR session_token IS NOT NULL)
    );

CREATE POLICY "Anyone can insert feedback" ON public.feedback_events
    FOR INSERT WITH CHECK (true);

CREATE POLICY "Admins can view all feedback" ON public.feedback_events
    FOR SELECT USING (has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can update feedback" ON public.feedback_events
    FOR UPDATE USING (has_role(auth.uid(), 'admin'));

-- 17. Políticas RLS para crisis_events (somente admin pode ver, sistema pode inserir)
CREATE POLICY "Admins can view crisis events" ON public.crisis_events
    FOR SELECT USING (has_role(auth.uid(), 'admin'));

CREATE POLICY "Anyone can insert crisis events" ON public.crisis_events
    FOR INSERT WITH CHECK (true);

CREATE POLICY "Admins can update crisis events" ON public.crisis_events
    FOR UPDATE USING (has_role(auth.uid(), 'admin'));

-- 18. Trigger para updated_at nas novas tabelas
CREATE TRIGGER update_user_profiles_updated_at
    BEFORE UPDATE ON public.user_profiles
    FOR EACH ROW
    EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_memory_items_updated_at
    BEFORE UPDATE ON public.memory_items
    FOR EACH ROW
    EXECUTE FUNCTION public.update_updated_at_column();