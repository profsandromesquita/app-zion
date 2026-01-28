
# Relatório Completo: Arquitetura de Usuários da Plataforma ZION

## Sumário Executivo

Este relatório documenta o estado atual do sistema de roles/perfis da plataforma ZION e propõe uma nova arquitetura para implementar os 8 tipos de usuários solicitados.

---

## PARTE 1: DIAGNÓSTICO DO ESTADO ATUAL

### 1.1 Estrutura de Roles Atual

#### Enum `app_role` existente no banco:
```sql
CREATE TYPE public.app_role AS ENUM ('admin', 'soldado', 'buscador');
```

#### Tabela `user_roles` (funcional):
| Coluna | Tipo | Descrição |
|--------|------|-----------|
| id | uuid | PK |
| user_id | uuid | FK para auth.users |
| role | app_role | Enum de roles |
| created_at | timestamp | Data de criação |

#### RLS Policies atuais em `user_roles`:
- `Users can view their own roles` - SELECT apenas para o próprio usuário

#### Distribuição atual de roles:
| Role | Quantidade |
|------|------------|
| buscador | 7 |
| admin | 2 |
| soldado | 0 (definido mas sem uso) |

---

### 1.2 Tabelas de Perfil Existentes

#### Tabela `profiles` (dados básicos):
```text
├── id (uuid, PK, FK auth.users)
├── email (text)
├── nome (text)
├── grammar_gender (text) - M/F/N
├── created_at (timestamp)
└── updated_at (timestamp)
```

#### Tabela `user_profiles` (dados de jornada espiritual):
```text
├── id (uuid, PK, FK auth.users)
├── perfil_disc (text)
├── eneagrama (text)
├── centros (jsonb)
├── dom_original (text)
├── virtude_hiperdesenvolvida (text)
├── seguranca_quebrada_primaria (text)
├── medo_raiz_dominante (text)
├── mecanismo_defesa_padrao (text)
├── fase_jornada (text) - 'inicio'
├── primary_center (text)
├── primary_security_matrix (text)
├── active_themes_count (integer)
├── total_shifts (integer)
├── global_avg_score (real)
├── spiritual_maturity (text)
├── initial_pain_focus (text[])
├── onboarding_completed_at (timestamp)
├── created_at (timestamp)
└── updated_at (timestamp)
```

---

### 1.3 Funcionalidades de Controle de Acesso Atuais

#### Hook `useUserRole.ts`:
```typescript
// Retorna flags para 3 roles
return { isAdmin, isSoldado, isBuscador, loading };
```

#### Componente `AdminRoute.tsx`:
- Verifica apenas `isAdmin`
- Redireciona não-admins para `/`
- **Problema**: Não há rotas intermediárias (ex: Soldado que vê apenas seus usuários)

#### Trigger `handle_new_user`:
```sql
-- Ao criar novo usuário:
INSERT INTO profiles (id, email, nome) VALUES ...
INSERT INTO user_roles (user_id, role) VALUES (NEW.id, 'buscador');
-- TODO: Falta criar user_profiles!
```

---

### 1.4 Funcionalidades Mortas ou Incompletas Identificadas

| Funcionalidade | Status | Problema |
|---------------|--------|----------|
| Role `soldado` | DEFINIDO MAS SEM USO | Enum existe, nenhum usuário tem, nenhuma rota usa |
| Intent SOLDADO | MORTO | `intent-router` define intents SOLDADO mas nunca são acessíveis |
| MATCHMAKING | MORTO | Intent para conectar buscadores a soldados, sem implementação |
| Trigger handle_new_user | INCOMPLETO | Cria `profiles` mas não cria `user_profiles` |
| Relação soldado-buscador | INEXISTENTE | Não há tabela de acompanhamento |

---

### 1.5 Fluxo de Dados de Jornada Atual

```text
┌─────────────────────────────────────────────────────────────────┐
│                    FLUXO ATUAL DE DADOS                         │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  chat_sessions ──► chat_messages ──► turn_insights              │
│       │                                    │                    │
│       └────────────────────────────────────┘                    │
│                         │                                       │
│                         ▼                                       │
│                   user_themes                                   │
│                         │                                       │
│                         ▼                                       │
│               user_profiles (agregados)                         │
│                                                                 │
│  ACESSO ATUAL:                                                  │
│  - Admin vê TUDO                                                │
│  - Buscador vê apenas PRÓPRIOS dados                            │
│  - Soldado não tem acesso diferenciado (não implementado)       │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

---

## PARTE 2: ARQUITETURA PROPOSTA PARA NOVOS PERFIS

### 2.1 Matriz de Perfis e Permissões

| Perfil | Chat IA | Mapa Jornada | Dataset Feedback | Admin Panel | Gerenciar Membros |
|--------|---------|--------------|------------------|-------------|-------------------|
| **Buscador** | ✅ Próprio | ❌ | ❌ | ❌ | ❌ |
| **Soldado** | ✅ Próprio | ✅ Seus acompanhados (max 10) | ❌ | ❌ | ❌ |
| **Pastor** | ✅ Próprio | ✅ Membros da igreja | ❌ | ❌ | ❌ |
| **Igreja** | ❌ | ❌ | ❌ | ❌ | ✅ Próprios membros |
| **Profissional** | ✅ Próprio | ✅ Todos | ✅ | ❌ | ❌ |
| **Auditor** | ❌ | ✅ Todos (anonimizado) | ✅ Todos | ✅ (sem PII) | ❌ |
| **Desenvolvedor** | ✅ | ✅ Todos | ✅ Todos | ✅ Total | ✅ Total |
| **Admin** | ✅ | ✅ Todos | ✅ Todos | ✅ Total | ✅ Total |

---

### 2.2 Novo Enum de Roles Proposto

```sql
CREATE TYPE public.app_role AS ENUM (
  'buscador',       -- Usuário padrão buscando metanoia
  'soldado',        -- Intercessor que acompanha buscadores
  'pastor',         -- Líder espiritual de uma igreja
  'igreja',         -- Entidade institucional (ponto de apoio)
  'profissional',   -- Psicólogo/Psiquiatra
  'auditor',        -- Auditor do modelo (sem PII)
  'desenvolvedor',  -- Acesso total técnico
  'admin'           -- Acesso total administrativo
);
```

---

### 2.3 Novas Tabelas Necessárias

#### 2.3.1 Tabela `churches` (Igrejas)
```sql
CREATE TABLE public.churches (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  address text,
  city text,
  state text,
  phone text,
  email text,
  website text,
  pastor_id uuid REFERENCES profiles(id), -- Pastor responsável
  is_active boolean DEFAULT true,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);
```

#### 2.3.2 Tabela `church_members` (Vinculação igreja-membro)
```sql
CREATE TABLE public.church_members (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  church_id uuid NOT NULL REFERENCES churches(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  role app_role NOT NULL, -- buscador, soldado, pastor
  joined_at timestamptz DEFAULT now(),
  status text DEFAULT 'active', -- active, inactive, pending
  added_by uuid REFERENCES profiles(id),
  UNIQUE(church_id, user_id)
);
```

#### 2.3.3 Tabela `soldado_assignments` (Acompanhamento soldado-buscador)
```sql
CREATE TABLE public.soldado_assignments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  soldado_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  buscador_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  church_id uuid REFERENCES churches(id), -- Opcional, se for da mesma igreja
  status text DEFAULT 'active', -- active, paused, completed
  assigned_at timestamptz DEFAULT now(),
  assigned_by uuid REFERENCES profiles(id),
  notes text,
  UNIQUE(soldado_id, buscador_id),
  -- Constraint: soldado pode ter max 10 ativos
  CONSTRAINT max_assignments CHECK (
    (SELECT COUNT(*) FROM soldado_assignments sa 
     WHERE sa.soldado_id = soldado_id AND sa.status = 'active') <= 10
  )
);
```

#### 2.3.4 Tabela `professional_credentials` (Credenciais de profissionais)
```sql
CREATE TABLE public.professional_credentials (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE UNIQUE,
  profession text NOT NULL, -- 'psicologo', 'psiquiatra', 'terapeuta'
  license_number text NOT NULL,
  license_state text NOT NULL,
  verified boolean DEFAULT false,
  verified_at timestamptz,
  verified_by uuid REFERENCES profiles(id),
  documents_url text[], -- URLs de documentos comprobatórios
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);
```

---

### 2.4 Alterações nas Tabelas Existentes

#### 2.4.1 Tabela `profiles` (adicionar campos)
```sql
ALTER TABLE profiles ADD COLUMN phone text;
ALTER TABLE profiles ADD COLUMN avatar_url text;
ALTER TABLE profiles ADD COLUMN bio text;
ALTER TABLE profiles ADD COLUMN is_public_profile boolean DEFAULT false;
```

#### 2.4.2 Trigger `handle_new_user` (corrigir)
```sql
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
  
  -- Criar perfil de jornada (NOVO)
  INSERT INTO public.user_profiles (id)
  VALUES (NEW.id);
  
  -- Atribuir role padrão
  INSERT INTO public.user_roles (user_id, role)
  VALUES (NEW.id, 'buscador');
  
  RETURN NEW;
END;
$$;
```

---

### 2.5 Funções de Verificação de Acesso (Security Definer)

#### 2.5.1 Função `has_role` (já existe, manter)
```sql
-- Já implementada corretamente
```

#### 2.5.2 Nova função `is_soldado_of`
```sql
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
```

#### 2.5.3 Nova função `is_pastor_of_church`
```sql
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
  )
$$;
```

#### 2.5.4 Nova função `is_church_member_of`
```sql
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
```

#### 2.5.5 Nova função `can_view_journey`
```sql
CREATE OR REPLACE FUNCTION public.can_view_journey(_viewer_id uuid, _target_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT 
    -- Próprio usuário
    _viewer_id = _target_id
    -- Admin/Dev vê tudo
    OR has_role(_viewer_id, 'admin')
    OR has_role(_viewer_id, 'desenvolvedor')
    -- Profissional vê tudo
    OR has_role(_viewer_id, 'profissional')
    -- Auditor vê tudo (dados serão anonimizados na camada de aplicação)
    OR has_role(_viewer_id, 'auditor')
    -- Soldado vê seus acompanhados
    OR (has_role(_viewer_id, 'soldado') AND is_soldado_of(_viewer_id, _target_id))
    -- Pastor vê membros da sua igreja
    OR (has_role(_viewer_id, 'pastor') AND is_church_member_of(_viewer_id, _target_id))
$$;
```

---

### 2.6 Políticas RLS Atualizadas

#### 2.6.1 Tabela `user_themes`
```sql
-- Remover política antiga
DROP POLICY IF EXISTS "Users can view own themes" ON user_themes;

-- Nova política com hierarquia
CREATE POLICY "Users can view accessible themes" ON user_themes
FOR SELECT USING (
  can_view_journey(auth.uid(), user_id)
);
```

#### 2.6.2 Tabela `turn_insights`
```sql
-- Adicionar política para visualização por soldados/pastores
CREATE POLICY "Role-based access to insights" ON turn_insights
FOR SELECT USING (
  has_role(auth.uid(), 'admin')
  OR has_role(auth.uid(), 'desenvolvedor')
  OR has_role(auth.uid(), 'profissional')
  OR has_role(auth.uid(), 'auditor')
  -- Soldados/Pastores precisam de join com sessions
);
```

#### 2.6.3 Tabela `churches`
```sql
ALTER TABLE churches ENABLE ROW LEVEL SECURITY;

-- Igrejas podem ver próprios dados
CREATE POLICY "Churches can view own data" ON churches
FOR SELECT USING (
  has_role(auth.uid(), 'admin')
  OR has_role(auth.uid(), 'desenvolvedor')
  OR EXISTS (
    SELECT 1 FROM church_members 
    WHERE church_id = churches.id 
    AND user_id = auth.uid()
  )
  OR pastor_id = auth.uid()
);

-- Apenas admin/igreja pode editar
CREATE POLICY "Churches can update own data" ON churches
FOR UPDATE USING (
  has_role(auth.uid(), 'admin')
  OR has_role(auth.uid(), 'desenvolvedor')
  OR EXISTS (
    SELECT 1 FROM user_roles ur
    JOIN church_members cm ON cm.user_id = auth.uid()
    WHERE cm.church_id = churches.id
    AND ur.user_id = auth.uid()
    AND ur.role = 'igreja'
  )
);
```

---

### 2.7 Alterações no Frontend

#### 2.7.1 Hook `useUserRole.ts` (expandido)
```typescript
export const useUserRole = () => {
  // ... código existente ...
  
  const [isPastor, setIsPastor] = useState(false);
  const [isIgreja, setIsIgreja] = useState(false);
  const [isProfissional, setIsProfissional] = useState(false);
  const [isAuditor, setIsAuditor] = useState(false);
  const [isDesenvolvedor, setIsDesenvolvedor] = useState(false);

  // Na função checkRoles:
  setIsAdmin(roleList.includes("admin"));
  setIsSoldado(roleList.includes("soldado"));
  setIsBuscador(roleList.includes("buscador"));
  setIsPastor(roleList.includes("pastor"));
  setIsIgreja(roleList.includes("igreja"));
  setIsProfissional(roleList.includes("profissional"));
  setIsAuditor(roleList.includes("auditor"));
  setIsDesenvolvedor(roleList.includes("desenvolvedor"));

  // Helpers
  const canAccessChat = isAdmin || isDesenvolvedor || isSoldado || isPastor || 
                        isBuscador || isProfissional;
  const canViewJourneyMap = isAdmin || isDesenvolvedor || isSoldado || isPastor || 
                           isProfissional || isAuditor;
  const canViewFeedbackDataset = isAdmin || isDesenvolvedor || isProfissional || isAuditor;
  const canManageMembers = isAdmin || isDesenvolvedor || isIgreja;
  const canAccessFullAdmin = isAdmin || isDesenvolvedor;

  return {
    isAdmin, isSoldado, isBuscador, isPastor, isIgreja,
    isProfissional, isAuditor, isDesenvolvedor,
    canAccessChat, canViewJourneyMap, canViewFeedbackDataset,
    canManageMembers, canAccessFullAdmin,
    loading
  };
};
```

#### 2.7.2 Novos Componentes de Rota
```typescript
// RoleRoute.tsx - Genérico
interface RoleRouteProps {
  children: React.ReactNode;
  allowedRoles: string[];
  redirectTo?: string;
}

// SoldadoRoute.tsx - Específico para soldados
// PastorRoute.tsx - Específico para pastores
// ProfissionalRoute.tsx - Específico para profissionais
// AuditorRoute.tsx - Específico para auditores (dados anonimizados)
```

#### 2.7.3 Novas Páginas Necessárias
```text
src/pages/
├── soldado/
│   ├── Dashboard.tsx        -- Lista de buscadores acompanhados
│   └── BuscadorJourney.tsx  -- Mapa de jornada do buscador
├── pastor/
│   ├── Dashboard.tsx        -- Visão geral da igreja
│   └── MembersList.tsx      -- Lista de membros
├── igreja/
│   ├── Dashboard.tsx        -- Gestão da igreja
│   ├── Members.tsx          -- CRUD de membros
│   └── Events.tsx           -- Eventos e resgates
├── profissional/
│   ├── Dashboard.tsx        -- Visão geral
│   └── JourneyAnalysis.tsx  -- Análise de jornadas
└── auditor/
    ├── Dashboard.tsx        -- Métricas do modelo
    └── AnonymizedData.tsx   -- Dados anonimizados
```

---

### 2.8 Fluxo de Cadastro por Tipo de Usuário

```text
┌──────────────────────────────────────────────────────────────────────────┐
│                    FLUXOS DE CADASTRO                                    │
├──────────────────────────────────────────────────────────────────────────┤
│                                                                          │
│  BUSCADOR (Auto-cadastro):                                               │
│  ┌────────────────────────────────────────────────────────────────────┐  │
│  │ 1. Signup normal (/auth)                                           │  │
│  │ 2. Trigger handle_new_user → role='buscador'                       │  │
│  │ 3. Onboarding Flow                                                 │  │
│  │ 4. Acesso ao Chat                                                  │  │
│  └────────────────────────────────────────────────────────────────────┘  │
│                                                                          │
│  SOLDADO (Convite por igreja ou promoção):                               │
│  ┌────────────────────────────────────────────────────────────────────┐  │
│  │ 1. Buscador existente                                              │  │
│  │ 2. Igreja/Pastor adiciona role 'soldado'                           │  │
│  │ 3. Treinamento (fase futura)                                       │  │
│  │ 4. Atribuição de buscadores (max 10)                               │  │
│  └────────────────────────────────────────────────────────────────────┘  │
│                                                                          │
│  PASTOR (Vinculação a igreja):                                           │
│  ┌────────────────────────────────────────────────────────────────────┐  │
│  │ 1. Cadastro de Igreja primeiro                                     │  │
│  │ 2. Admin cria usuário pastor                                       │  │
│  │ 3. Vincula pastor à igreja (churches.pastor_id)                    │  │
│  │ 4. Role 'pastor' atribuída                                         │  │
│  └────────────────────────────────────────────────────────────────────┘  │
│                                                                          │
│  IGREJA (Cadastro institucional):                                        │
│  ┌────────────────────────────────────────────────────────────────────┐  │
│  │ 1. Admin cria registro em 'churches'                               │  │
│  │ 2. Cria usuário com role 'igreja'                                  │  │
│  │ 3. Vincula usuário à igreja                                        │  │
│  │ 4. Acesso ao painel de gestão de membros                           │  │
│  └────────────────────────────────────────────────────────────────────┘  │
│                                                                          │
│  PROFISSIONAL (Verificação de credenciais):                              │
│  ┌────────────────────────────────────────────────────────────────────┐  │
│  │ 1. Cadastro normal                                                 │  │
│  │ 2. Submete credenciais (CRP/CRM)                                   │  │
│  │ 3. Admin verifica documentos                                       │  │
│  │ 4. Role 'profissional' atribuída após verificação                  │  │
│  └────────────────────────────────────────────────────────────────────┘  │
│                                                                          │
│  AUDITOR / DESENVOLVEDOR (Apenas Admin):                                 │
│  ┌────────────────────────────────────────────────────────────────────┐  │
│  │ 1. Admin cria usuário                                              │  │
│  │ 2. Atribui role específica                                         │  │
│  │ 3. Acesso imediato às funcionalidades                              │  │
│  └────────────────────────────────────────────────────────────────────┘  │
│                                                                          │
└──────────────────────────────────────────────────────────────────────────┘
```

---

## PARTE 3: PLANO DE IMPLEMENTAÇÃO

### Fase 1: Migração de Banco de Dados
1. Expandir enum `app_role` com novos valores
2. Criar tabela `churches`
3. Criar tabela `church_members`
4. Criar tabela `soldado_assignments`
5. Criar tabela `professional_credentials`
6. Atualizar trigger `handle_new_user`
7. Criar novas funções security definer
8. Atualizar RLS policies

### Fase 2: Backend (Edge Functions)
1. Atualizar `intent-router` para usar roles corretamente
2. Criar endpoint para gestão de membros de igreja
3. Criar endpoint para atribuição soldado-buscador
4. Criar endpoint para verificação de credenciais

### Fase 3: Frontend
1. Expandir hook `useUserRole`
2. Criar componentes de rota por role
3. Criar páginas específicas por perfil
4. Implementar anonimização de dados para auditores
5. Implementar gestão de membros para igrejas

### Fase 4: Testes e Validação
1. Testar fluxos de cadastro para cada tipo
2. Validar isolamento de dados por role
3. Testar limites (ex: max 10 para soldados)
4. Auditoria de segurança das RLS policies

---

## PARTE 4: RISCOS E CONSIDERAÇÕES

### Riscos de Segurança
- **Escalação de privilégios**: Garantir que roles só podem ser atribuídas por admins
- **Vazamento de PII para auditores**: Implementar anonimização na camada de aplicação
- **Limite de soldados**: Constraint SQL pode ter race conditions

### Decisões de Design
- **Igreja como entidade**: Decidir se igreja é um usuário ou apenas uma entidade
- **Multi-igreja**: Usuário pode pertencer a múltiplas igrejas?
- **Promoção de roles**: Como um buscador vira soldado? Aprovação manual?

---

## PARTE 5: ARQUIVOS A CRIAR/MODIFICAR

### Banco de Dados (Migrações)
| Operação | Descrição |
|----------|-----------|
| CREATE TYPE | Expandir app_role |
| CREATE TABLE | churches |
| CREATE TABLE | church_members |
| CREATE TABLE | soldado_assignments |
| CREATE TABLE | professional_credentials |
| CREATE FUNCTION | is_soldado_of |
| CREATE FUNCTION | is_pastor_of_church |
| CREATE FUNCTION | is_church_member_of |
| CREATE FUNCTION | can_view_journey |
| ALTER FUNCTION | handle_new_user |
| CREATE POLICY | Múltiplas para novas tabelas |

### Frontend
| Arquivo | Operação |
|---------|----------|
| src/hooks/useUserRole.ts | MODIFICAR |
| src/components/admin/RoleRoute.tsx | CRIAR |
| src/pages/soldado/* | CRIAR |
| src/pages/pastor/* | CRIAR |
| src/pages/igreja/* | CRIAR |
| src/pages/profissional/* | CRIAR |
| src/pages/auditor/* | CRIAR |
| src/App.tsx | MODIFICAR (novas rotas) |

### Edge Functions
| Arquivo | Operação |
|---------|----------|
| supabase/functions/intent-router/index.ts | MODIFICAR |
| supabase/functions/manage-church/index.ts | CRIAR |
| supabase/functions/assign-soldado/index.ts | CRIAR |
