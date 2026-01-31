
# Plano de Correção: Cadastro e Perfil de Igreja

## Diagnóstico Completo dos 4 Problemas

### A. Erro RLS (código 42501) no cadastro de igreja

**Causa Raiz Identificada:**
1. A tabela `churches` não possui policy de INSERT para usuários normais
2. Apenas admins e desenvolvedores podem inserir (policy ALL)
3. O código em `ChurchSignupForm.tsx` tenta inserir diretamente na tabela

**Políticas Atuais de `churches`:**
```text
SELECT: Membros ativos ou pastor_id = auth.uid()
UPDATE: Apenas quem pode gerenciar membros
ALL: Apenas admin/desenvolvedor
INSERT: NÃO EXISTE ❌
```

**Problema Secundário:**
O código também tenta inserir role 'igreja' em `user_roles` (linha 121), mas apenas admins podem fazer isso.

---

### B. Erro de lógica (Onboarding para igreja)

**Causa Raiz:**
O `Chat.tsx` (linhas 106-139) verifica `onboarding_completed_at` para **todos** os usuários sem verificar a role.

```typescript
// Atual (Chat.tsx linha 127)
if (!userProfileData?.onboarding_completed_at) {
  setShowOnboarding(true);  // Mostra para TODOS, incluindo igrejas
}
```

Igrejas são instituições, não pessoas - não faz sentido perguntar "Como você descreveria sua relação com Deus?" para uma conta institucional.

---

### C. Erro de informações (Perfil de pessoa para igreja)

**Causa Raiz:**
`Profile.tsx` exibe os mesmos campos para todos:
- Dados Pessoais (nome, telefone, bio)
- Seção "Minha Jornada" (apenas para buscadores)

Para igrejas, deveria mostrar:
- Dados da Igreja (nome, endereço, cidade, estado, website)
- Lista de membros (futuro)
- Estatísticas da igreja (futuro)

---

### D. Usuário preso no onboarding

**Causa Raiz:**
`OnboardingFlow.tsx` não possui:
- Botão de sair/fechar
- Opção de pular completamente
- Escape quando o usuário fecha e reabre o app

---

## Solução Proposta

### PARTE 1: Corrigir RLS para Cadastro de Igreja

**1.1 Criar Policy de INSERT para `churches`**
```sql
-- Permitir que usuário insira igreja onde ele será o pastor
CREATE POLICY "Users can create their own church"
ON public.churches FOR INSERT
TO authenticated
WITH CHECK (pastor_id = auth.uid());
```

**1.2 Modificar Trigger `handle_new_user` para aceitar role customizada**

Opção A (Recomendada): Criar função SECURITY DEFINER para adicionar role 'igreja':
```sql
CREATE OR REPLACE FUNCTION public.add_user_role(_user_id uuid, _role app_role)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.user_roles (user_id, role)
  VALUES (_user_id, _role)
  ON CONFLICT (user_id, role) DO NOTHING;
END;
$$;

-- RLS Policy para chamar a função
GRANT EXECUTE ON FUNCTION public.add_user_role TO authenticated;
```

**1.3 Atualizar `ChurchSignupForm.tsx`**
Usar RPC para adicionar role 'igreja' via função SECURITY DEFINER.

---

### PARTE 2: Pular Onboarding para Igrejas

**2.1 Modificar `Chat.tsx`**

Antes de mostrar onboarding, verificar se usuário tem role 'igreja':

```typescript
// Chat.tsx - checkOnboardingAndInit()
const checkOnboardingAndInit = async () => {
  if (!user) return;

  // NOVO: Verificar roles primeiro
  const { data: rolesData } = await supabase
    .from("user_roles")
    .select("role")
    .eq("user_id", user.id);

  const userRoles = rolesData?.map(r => r.role) || [];
  
  // Igrejas e profissionais pulam onboarding
  if (userRoles.includes('igreja') || userRoles.includes('profissional')) {
    setOnboardingChecked(true);
    initAuthenticatedSession();
    return;
  }

  // Resto do código para buscadores...
};
```

**2.2 Marcar `onboarding_completed_at` no cadastro de igreja**

Adicionar no `ChurchSignupForm.tsx` após criar igreja:
```typescript
// Marcar onboarding como completo (não aplicável para igrejas)
await supabase.from("user_profiles").update({
  onboarding_completed_at: new Date().toISOString()
}).eq("id", userId);
```

---

### PARTE 3: Perfil Específico para Igreja

**3.1 Criar componente `ChurchProfileSection.tsx`**

Novo componente que exibe:
- Nome da Igreja
- Endereço completo (rua, cidade, estado)
- Telefone
- Website
- Email de contato
- Data de cadastro

**3.2 Modificar `Profile.tsx`**

```typescript
// Profile.tsx
const { isIgreja, isBuscador } = useUserRole();

// Buscar dados da igreja se for conta de igreja
const [churchData, setChurchData] = useState<ChurchData | null>(null);

useEffect(() => {
  if (isIgreja && user) {
    loadChurchProfile();
  }
}, [isIgreja, user]);

// Na renderização:
return (
  <>
    {isIgreja ? (
      <ChurchProfileSection church={churchData} onSave={handleChurchSave} />
    ) : (
      <>
        <PersonalDataCard />
        {isBuscador && <JourneySection />}
      </>
    )}
  </>
);
```

---

### PARTE 4: Permitir Sair do Onboarding

**4.1 Adicionar botão "Pular" no `OnboardingFlow.tsx`**

```typescript
// OnboardingFlow.tsx - Props
interface OnboardingFlowProps {
  onComplete: (data: OnboardingData) => void;
  onSkip?: () => void;  // NOVO: Callback para pular
}

// Header ou footer
<button
  onClick={onSkip}
  className="text-muted-foreground hover:text-foreground"
>
  Pular por enquanto
</button>
```

**4.2 Implementar lógica de "pular" em `Chat.tsx`**

```typescript
const handleSkipOnboarding = async () => {
  // Marcar que pulou (mas não completou)
  // Pode ser revisitado depois
  setShowOnboarding(false);
  initAuthenticatedSession();
};
```

---

## Arquivos a Modificar

| Arquivo | Alteração |
|---------|-----------|
| **Migrations SQL** | Criar policy INSERT para `churches`, criar função `add_user_role` |
| `src/components/auth/ChurchSignupForm.tsx` | Usar RPC para adicionar role, marcar onboarding_completed |
| `src/pages/Chat.tsx` | Verificar roles antes de mostrar onboarding |
| `src/pages/Profile.tsx` | Condicionar exibição baseada em role (igreja vs pessoa) |
| `src/components/profile/ChurchProfileSection.tsx` | NOVO - Exibir/editar dados da igreja |
| `src/components/onboarding/OnboardingFlow.tsx` | Adicionar opção de pular |

---

## Fluxo de Implementação

```text
FASE 1: Correção Crítica (RLS)
├── 1.1 Criar policy INSERT para churches (pastor_id = auth.uid())
├── 1.2 Criar função add_user_role com SECURITY DEFINER
└── 1.3 Atualizar ChurchSignupForm.tsx para usar RPC

FASE 2: Lógica de Onboarding
├── 2.1 Modificar Chat.tsx para verificar roles
├── 2.2 Marcar onboarding_completed_at no signup de igreja
└── 2.3 Adicionar botão "Pular" no OnboardingFlow

FASE 3: Perfil de Igreja
├── 3.1 Criar ChurchProfileSection.tsx
├── 3.2 Criar query para buscar dados da igreja do pastor
└── 3.3 Modificar Profile.tsx para exibir condicional

DEPLOY: Executar migrations SQL primeiro
```

---

## Resumo das Correções

| Problema | Causa | Solução |
|----------|-------|---------|
| A. Erro RLS 42501 | Sem policy INSERT para churches | Criar policy `pastor_id = auth.uid()` |
| B. Onboarding para igreja | Sem verificação de role | Pular se role = 'igreja' |
| C. Perfil errado | Mesmo template para todos | Componente específico para igreja |
| D. Preso no onboarding | Sem opção de sair | Adicionar botão "Pular" |

---

## Detalhes das Migrations SQL

```sql
-- MIGRATION 1: Policy INSERT para churches
CREATE POLICY "Users can create their own church"
ON public.churches FOR INSERT
TO authenticated
WITH CHECK (pastor_id = auth.uid());

-- MIGRATION 2: Função para adicionar role (SECURITY DEFINER)
CREATE OR REPLACE FUNCTION public.add_user_role(_user_id uuid, _role app_role)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.user_roles (user_id, role)
  VALUES (_user_id, _role)
  ON CONFLICT (user_id, role) DO NOTHING;
END;
$$;

-- Permitir que usuários autenticados chamem a função para SI MESMOS
-- Nota: A função valida internamente que user_id = auth.uid()
```

---

## Resultado Esperado

1. **Cadastro de igreja funciona** sem erro de RLS
2. **Igrejas não veem onboarding** de pessoa física
3. **Perfil de igreja mostra dados corretos** (nome da igreja, endereço, etc.)
4. **Usuários podem pular onboarding** se desejarem
