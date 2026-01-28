
# Plano de Correção: Funcionalidades de UI para Arquitetura de Roles

## Diagnóstico Confirmado

### O que foi implementado corretamente (Backend)
- Banco de dados com 8 roles no enum `app_role`
- Tabelas: `churches`, `church_members`, `soldado_assignments`, `professional_credentials`
- Funções de segurança: `can_view_journey`, `is_soldado_of`, `is_pastor_of_church`, `can_manage_church_members`
- Hook `useUserRole` com todas as 8 roles e permissões derivadas
- Componentes de rota protegida (`RoleRoute`, `AdminRoute`, etc.)

### O que NÃO foi implementado (Frontend - Problemas Reportados)

| Problema | Arquivo | Status |
|----------|---------|--------|
| Usuários não clicáveis no Dashboard | `AdminDashboard.tsx` | Tabela estática sem ações |
| Cadastro igual para todos | `Auth.tsx` | Formulário único sem seleção de tipo |
| Avatar não clicável | `ChatSidebar.tsx` | Sem dropdown/menu de perfil |
| Página de perfil inexistente | - | Não existe `/profile` |

---

## Implementação Fase 1: Avatar com Menu e Página de Perfil

### 1.1 Criar Menu Dropdown no Avatar (ChatSidebar.tsx)

**Alteração**: Substituir o Avatar estático por um `DropdownMenu` clicável

```text
ANTES (linhas 365-384):
┌─────────────────────────────────────────┐
│  [Avatar] email@example.com    [Logout] │
│  (não clicável)                         │
└─────────────────────────────────────────┘

DEPOIS:
┌─────────────────────────────────────────┐
│  [Avatar] email@example.com       [▼]   │  <- Clicável
│     ┌─────────────────────────┐         │
│     │ 👤 Meu Perfil           │         │
│     │ ⚙️ Configurações        │         │
│     │ ─────────────────────── │         │
│     │ 🛡️ Painel Admin (admin) │         │
│     │ ─────────────────────── │         │
│     │ 🚪 Sair                 │         │
│     └─────────────────────────┘         │
└─────────────────────────────────────────┘
```

**Componentes a adicionar**:
- `DropdownMenu`, `DropdownMenuTrigger`, `DropdownMenuContent`, `DropdownMenuItem`
- Link para `/profile`
- Botão de logout dentro do menu

### 1.2 Criar Página de Perfil do Usuário

**Novo arquivo**: `src/pages/Profile.tsx`

```text
┌────────────────────────────────────────────────────────────┐
│                      MEU PERFIL                            │
├────────────────────────────────────────────────────────────┤
│                                                            │
│  ┌──────────┐   Nome: Sandro Mesquita                     │
│  │  Avatar  │   Email: sandro.mesquita@itia.org.br        │
│  │   (A)    │   Membro desde: 30/12/2025                  │
│  └──────────┘                                              │
│                                                            │
│  ┌─ Suas Roles ─────────────────────────────────────────┐ │
│  │  [Admin] [Buscador]                                  │ │
│  └──────────────────────────────────────────────────────┘ │
│                                                            │
│  ┌─ Dados Pessoais ─────────────────────────────────────┐ │
│  │  Nome: [___________________] [Salvar]                │ │
│  │  Telefone: [_______________]                         │ │
│  │  Bio: [_________________________________]            │ │
│  └──────────────────────────────────────────────────────┘ │
│                                                            │
│  ┌─ Minha Jornada (apenas buscadores) ─────────────────┐  │
│  │  Fase: Início | Temas ativos: 3 | Score médio: 3.5  │  │
│  └──────────────────────────────────────────────────────┘ │
│                                                            │
└────────────────────────────────────────────────────────────┘
```

### 1.3 Adicionar Rota no App.tsx

```typescript
<Route path="/profile" element={<Profile />} />
```

---

## Implementação Fase 2: Dashboard Admin Interativo

### 2.1 Tabela de Usuários Clicável (AdminDashboard.tsx)

**Alteração**: Adicionar coluna de "Roles" e botões de ação

```text
ANTES:
┌────────────────────────────────────────────────────────────┐
│  Nome          │ Email                    │ Cadastrado em  │
├────────────────────────────────────────────────────────────┤
│  Sandro        │ sandro@itia.org.br       │ 30/12/2025     │
│  Priscilla     │ priscilla@hotmail.com    │ 25/01/2026     │
└────────────────────────────────────────────────────────────┘

DEPOIS:
┌───────────────────────────────────────────────────────────────────────────────┐
│  Nome          │ Email                    │ Roles            │ Cadastrado │ ⚙️│
├───────────────────────────────────────────────────────────────────────────────┤
│  Sandro        │ sandro@itia.org.br       │ [Admin][Buscador]│ 30/12/2025 │[👁]│
│  Priscilla     │ priscilla@hotmail.com    │ [Buscador]       │ 25/01/2026 │[👁]│
│  CN Maraponga  │ contat@cnmaraponga.com   │ [Buscador]       │ 28/01/2026 │[👁]│
└───────────────────────────────────────────────────────────────────────────────┘
```

### 2.2 Modal de Detalhes do Usuário

**Ao clicar no [👁]**:

```text
┌─────────────────────────────────────────────────────────────┐
│                  DETALHES DO USUÁRIO                        │
│  ────────────────────────────────────────────────────────── │
│  Nome: Sandro Mesquita                                      │
│  Email: sandro.mesquita@itia.org.br                         │
│  Telefone: (não informado)                                  │
│  Cadastrado: 30/12/2025                                     │
│                                                             │
│  ─── ROLES ───                                              │
│  [Admin ✓] [Buscador ✓] [Soldado ○] [Pastor ○]             │
│  [Igreja ○] [Profissional ○] [Auditor ○] [Desenvolvedor ○] │
│                                                             │
│  ─── JORNADA ESPIRITUAL ───                                 │
│  Fase: Início                                               │
│  Maturidade: Consolidado                                    │
│  Temas ativos: 2                                            │
│  Score médio: 3.8                                           │
│                                                             │
│  [Ver Mapa de Jornada]  [Salvar Alterações]  [Fechar]       │
└─────────────────────────────────────────────────────────────┘
```

### 2.3 Query para buscar roles dos usuários

```sql
SELECT 
  p.id, p.nome, p.email, p.created_at, p.phone,
  ARRAY_AGG(ur.role) as roles,
  up.fase_jornada, up.active_themes_count, up.global_avg_score
FROM profiles p
LEFT JOIN user_roles ur ON ur.user_id = p.id
LEFT JOIN user_profiles up ON up.id = p.id
GROUP BY p.id, up.id
ORDER BY p.created_at DESC
```

---

## Implementação Fase 3: Cadastro Diferenciado por Tipo

### 3.1 Tela de Seleção de Tipo de Conta (Auth.tsx)

**Antes do formulário de cadastro, adicionar**:

```text
┌──────────────────────────────────────────────────────────────────┐
│                     ESCOLHA SEU PERFIL                           │
├──────────────────────────────────────────────────────────────────┤
│                                                                  │
│  ┌─────────────────┐  ┌─────────────────┐  ┌─────────────────┐   │
│  │     [👤]        │  │     [⛪]        │  │     [🧠]        │   │
│  │   BUSCADOR      │  │    IGREJA       │  │  PROFISSIONAL   │   │
│  │ Estou em busca  │  │ Sou uma igreja  │  │ Sou psicólogo   │   │
│  │ de acolhimento  │  │ e ponto de apoio│  │ ou psiquiatra   │   │
│  └─────────────────┘  └─────────────────┘  └─────────────────┘   │
│                                                                  │
│  ┌──────────────────────────────────────────────────────────┐    │
│  │ Soldados e Pastores são cadastrados pela Igreja          │    │
│  └──────────────────────────────────────────────────────────┘    │
│                                                                  │
└──────────────────────────────────────────────────────────────────┘
```

### 3.2 Formulários Específicos por Tipo

**Buscador (fluxo atual)**:
- Nome, Email, Senha
- Trigger atribui `role='buscador'` automaticamente
- Vai para onboarding

**Igreja (novo)**:
- Nome da Igreja
- CNPJ (opcional)
- Endereço, Cidade, Estado
- Email, Telefone
- Nome do responsável
- Após cadastro: cria entrada em `churches` e atribui `role='igreja'`

**Profissional (novo)**:
- Nome completo
- Email, Senha
- Profissão (Psicólogo/Psiquiatra/Terapeuta)
- Número do registro (CRP/CRM)
- Estado do registro
- Após cadastro: cria entrada em `professional_credentials` com `verified=false`
- Admin precisa verificar para liberar acesso completo

### 3.3 Fluxo de Verificação de Profissionais

```text
┌────────────────────────────────────────────────────────────────┐
│ ADMIN: CREDENCIAIS PENDENTES DE VERIFICAÇÃO                   │
├────────────────────────────────────────────────────────────────┤
│                                                                │
│ ┌────────────────────────────────────────────────────────────┐ │
│ │ Dr. João Silva                                             │ │
│ │ Profissão: Psicólogo                                       │ │
│ │ CRP: 06/123456 (SP)                                        │ │
│ │ Cadastrado: 28/01/2026                                     │ │
│ │                                                            │ │
│ │ [✓ Aprovar]  [✗ Rejeitar]                                  │ │
│ └────────────────────────────────────────────────────────────┘ │
│                                                                │
└────────────────────────────────────────────────────────────────┘
```

---

## Arquivos a Criar/Modificar

### Novos Arquivos
| Arquivo | Descrição |
|---------|-----------|
| `src/pages/Profile.tsx` | Página de perfil do usuário |
| `src/pages/admin/UserManagement.tsx` | Página de gestão de usuários (alternativa ao modal) |
| `src/components/auth/AccountTypeSelector.tsx` | Componente de seleção de tipo de conta |
| `src/components/auth/ChurchSignupForm.tsx` | Formulário de cadastro de igreja |
| `src/components/auth/ProfessionalSignupForm.tsx` | Formulário de cadastro de profissional |

### Arquivos a Modificar
| Arquivo | Alteração |
|---------|-----------|
| `src/components/chat/ChatSidebar.tsx` | Adicionar DropdownMenu no avatar |
| `src/pages/admin/AdminDashboard.tsx` | Adicionar coluna de roles, botões de ação, modal de detalhes |
| `src/pages/Auth.tsx` | Adicionar seleção de tipo de conta e formulários diferenciados |
| `src/App.tsx` | Adicionar rota `/profile` |

---

## Ordem de Execução

```text
FASE 1 (Avatar e Perfil) ─────────────────────────────────────────
├── 1. Modificar ChatSidebar.tsx (dropdown menu)
├── 2. Criar Profile.tsx
└── 3. Adicionar rota em App.tsx

FASE 2 (Dashboard Interativo) ────────────────────────────────────
├── 4. Modificar AdminDashboard.tsx (roles, ações)
└── 5. Adicionar modal de detalhes/edição de usuário

FASE 3 (Cadastro Diferenciado) ───────────────────────────────────
├── 6. Criar AccountTypeSelector.tsx
├── 7. Criar ChurchSignupForm.tsx
├── 8. Criar ProfessionalSignupForm.tsx
└── 9. Modificar Auth.tsx (integrar fluxos)

FASE 4 (Verificação de Profissionais) ────────────────────────────
└── 10. Criar página admin para verificar credenciais
```

---

## Resultado Esperado

Após implementação:

1. **Avatar clicável** → Menu com opções de Perfil, Configurações, Admin (se aplicável), Sair
2. **Página /profile** → Usuário visualiza e edita seus dados, vê suas roles
3. **Dashboard interativo** → Admin vê roles de cada usuário, pode clicar para ver detalhes e editar
4. **Cadastro diferenciado** → Três fluxos: Buscador (simples), Igreja (dados institucionais), Profissional (com credenciais)
5. **Verificação** → Admin pode aprovar/rejeitar profissionais pendentes
