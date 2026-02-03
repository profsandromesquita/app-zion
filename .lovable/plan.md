

# Plano de Implementacao - ETAPA 2: UI de Candidatura a Soldado

## Verificacao de Pre-requisitos (Etapa 1)

A Etapa 1 esta **100% completa**:
- Enum `soldado_application_status` disponivel
- Tabela `soldado_applications` com campos: id, user_id, sponsored_by, sponsor_role, status, testimony_id, created_at, updated_at, rejection_reason
- Tabela `soldado_application_approvals` com constraint UNIQUE por approver_role
- Funcoes SQL: `can_sponsor_soldado()`, `check_soldado_approval_complete()`, `get_application_approval_status()`
- Trigger para auto-aprovacao quando 3 roles aprovarem
- RLS policies configuradas

---

## Estrutura de Arquivos a Criar

```text
src/
├── components/
│   └── soldado/
│       ├── NewApplicationForm.tsx      -- Formulario de nova candidatura
│       ├── ApplicationApprovalCard.tsx -- Card de aprovacao por role
│       └── ApplicationStatusBadge.tsx  -- Badge visual de status
└── pages/
    └── admin/
        └── SoldadoApplications.tsx     -- Pagina principal de listagem
```

---

## PARTE 1: Pagina Principal (SoldadoApplications.tsx)

### Estrutura
```tsx
// Seguindo padrao de PendingCredentials.tsx

<AdminRoute> ou <RoleRoute allowedRoles={['admin', 'desenvolvedor', 'igreja', 'profissional', 'pastor']}>
  <AdminLayout>
    <Header com titulo e botao "Nova Candidatura">
    <Filtros por status (tabs)>
    <Lista de ApplicationApprovalCard>
  </AdminLayout>
</AdminRoute>
```

### Funcionalidades
1. **Listagem de Candidaturas** com dados enriquecidos (profile do candidato + sponsor)
2. **Filtros por Status** (Tabs): Todas | Pendentes | Em Revisao | Aprovadas | Rejeitadas
3. **Botao "Nova Candidatura"** abre Dialog/Sheet com formulario
4. **Contador de aprovacoes** usando `get_application_approval_status()`

### Query de Dados
```typescript
// Buscar applications com join em profiles
const { data } = await supabase
  .from("soldado_applications")
  .select(`
    id, status, created_at, updated_at, rejection_reason,
    user_id, sponsored_by, sponsor_role, testimony_id
  `)
  .order("created_at", { ascending: false });

// Buscar profiles separadamente (evitar join complexo com RLS)
const userIds = [...applications.map(a => a.user_id), ...applications.map(a => a.sponsored_by)];
const { data: profiles } = await supabase
  .from("profiles")
  .select("id, nome, email, avatar_url")
  .in("id", userIds);
```

---

## PARTE 2: Formulario de Nova Candidatura (NewApplicationForm.tsx)

### Props e Estado
```typescript
interface NewApplicationFormProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: () => void;
  sponsorRole: 'admin' | 'desenvolvedor' | 'igreja' | 'profissional';
}
```

### Campos do Formulario
1. **Selecao de Usuario**: Dropdown com busca (usuarios que NAO sao soldados e NAO tem candidatura ativa)
2. **Justificativa da Indicacao** (textarea): Por que esta pessoa deve ser soldado?

### Validacao com Zod
```typescript
const newApplicationSchema = z.object({
  userId: z.string().uuid("Selecione um usuario"),
  justification: z.string().min(20, "Justificativa deve ter no minimo 20 caracteres").max(1000),
});
```

### Logica de Submissao
```typescript
// 1. Verificar se usuario ja tem candidatura
const { data: existing } = await supabase
  .from("soldado_applications")
  .select("id")
  .eq("user_id", userId)
  .in("status", ["pending", "testimony_required", "under_review"])
  .single();

if (existing) throw new Error("Usuario ja possui candidatura em andamento");

// 2. Criar candidatura
const { error } = await supabase.from("soldado_applications").insert({
  user_id: userId,
  sponsored_by: currentUser.id,
  sponsor_role: sponsorRole,
  status: "testimony_required", // Aguardando testemunho
});
```

### Busca de Usuarios Elegiveis
```typescript
// Buscar usuarios que:
// 1. NAO tem role 'soldado'
// 2. NAO tem candidatura pendente/em revisao
const { data: profiles } = await supabase
  .from("profiles")
  .select("id, nome, email, avatar_url")
  .order("nome");

const { data: existingApplications } = await supabase
  .from("soldado_applications")
  .select("user_id")
  .in("status", ["pending", "testimony_required", "under_review"]);

const { data: existingSoldados } = await supabase
  .from("user_roles")
  .select("user_id")
  .eq("role", "soldado");

// Filtrar no frontend
const eligibleUsers = profiles.filter(p => 
  !existingApplications.some(a => a.user_id === p.id) &&
  !existingSoldados.some(s => s.user_id === p.id)
);
```

---

## PARTE 3: Card de Aprovacao (ApplicationApprovalCard.tsx)

### Props
```typescript
interface ApplicationApprovalCardProps {
  application: {
    id: string;
    status: SoldadoApplicationStatus;
    created_at: string;
    candidate: { id: string; nome: string; email: string; avatar_url?: string };
    sponsor: { id: string; nome: string; role: AppRole };
    approvals: { admin: 'pending' | 'approved' | 'rejected'; profissional: 'pending' | 'approved' | 'rejected'; pastor: 'pending' | 'approved' | 'rejected' };
  };
  currentUserRole: AppRole;
  onApprove: (applicationId: string, notes: string) => void;
  onReject: (applicationId: string, notes: string) => void;
  loading?: boolean;
}
```

### Layout Visual (seguindo design existente)
```text
┌─────────────────────────────────────────────────────────────┐
│ [Avatar] Nome do Candidato                                  │
│          email@exemplo.com                                  │
│          Indicado por: [Nome Sponsor] (Igreja)              │
│          Criado em: 03/02/2026                              │
│                                                             │
│ ┌─────────────────────────────────────────────────────────┐ │
│ │ Status: [Badge testimony_required]                       │ │
│ └─────────────────────────────────────────────────────────┘ │
│                                                             │
│ Aprovacoes:                                                 │
│ [✓ Admin] [○ Profissional] [○ Pastor]                      │
│                                                             │
│ [Notas/Justificativa] ───────────────────────               │
│                                                             │
│                        [Rejeitar] [Aprovar]                 │
└─────────────────────────────────────────────────────────────┘
```

### Logica de Visibilidade de Botoes
```typescript
// Usuario so pode aprovar se:
// 1. Tem a role correta (admin, profissional, pastor)
// 2. Ainda nao aprovou essa candidatura
// 3. Status esta em "under_review" ou "testimony_required"

const canApprove = (role: AppRole, approvals: ApprovalStatus, status: string) => {
  if (!['testimony_required', 'under_review'].includes(status)) return false;
  
  if (role === 'admin' || role === 'desenvolvedor') {
    return approvals.admin === 'pending';
  }
  if (role === 'profissional') {
    return approvals.profissional === 'pending';
  }
  if (role === 'pastor') {
    return approvals.pastor === 'pending';
  }
  return false;
};
```

### Submissao de Aprovacao
```typescript
const handleApprove = async (applicationId: string, notes: string) => {
  // Inserir aprovacao (trigger cuida do resto)
  const { error } = await supabase.from("soldado_application_approvals").insert({
    application_id: applicationId,
    approver_id: currentUser.id,
    approver_role: getApproverRole(currentUserRoles), // admin, profissional, ou pastor
    approved: true,
    notes: notes || null,
  });
  
  // Trigger check_soldado_approval_complete() sera executado automaticamente
};

const handleReject = async (applicationId: string, reason: string) => {
  // Inserir rejeicao
  await supabase.from("soldado_application_approvals").insert({
    application_id: applicationId,
    approver_id: currentUser.id,
    approver_role: getApproverRole(currentUserRoles),
    approved: false,
    notes: reason,
  });
  
  // Atualizar status da candidatura para rejected
  await supabase.from("soldado_applications").update({
    status: "rejected",
    rejection_reason: reason,
  }).eq("id", applicationId);
};
```

---

## PARTE 4: Badge de Status (ApplicationStatusBadge.tsx)

### Mapeamento Visual
```typescript
const statusConfig: Record<SoldadoApplicationStatus, { label: string; color: string; icon: LucideIcon }> = {
  pending: { 
    label: "Pendente", 
    color: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-300",
    icon: Clock 
  },
  testimony_required: { 
    label: "Aguardando Testemunho", 
    color: "bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-300",
    icon: Mic 
  },
  under_review: { 
    label: "Em Revisao", 
    color: "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-300",
    icon: Eye 
  },
  approved: { 
    label: "Aprovado", 
    color: "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300",
    icon: CheckCircle 
  },
  rejected: { 
    label: "Rejeitado", 
    color: "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-300",
    icon: XCircle 
  },
};
```

---

## PARTE 5: Integracao com Navegacao

### Atualizar AdminLayout.tsx
```typescript
// Adicionar novo item no menu
const navItems = [
  // ... itens existentes
  { to: "/admin/soldado-applications", icon: Shield, label: "Candidatos Soldado" },
];
```

### Atualizar App.tsx
```typescript
// Adicionar rota
import SoldadoApplications from "./pages/admin/SoldadoApplications";

<Route path="/admin/soldado-applications" element={<SoldadoApplications />} />
```

### Atualizar Dashboard (card clicavel)
```typescript
// Similar ao card de "Credenciais Pendentes"
<Card onClick={() => navigate("/admin/soldado-applications")}>
  <CardHeader>
    <CardTitle>Candidatos a Soldado</CardTitle>
    <Shield className="h-4 w-4" />
  </CardHeader>
  <CardContent>
    <div className="text-2xl font-bold">{stats.pendingSoldadoApplications}</div>
    <p className="text-xs text-muted-foreground">aguardando aprovacao</p>
  </CardContent>
</Card>
```

---

## PARTE 6: Controle de Acesso

### Roles com Acesso a Pagina
- **Admin/Desenvolvedor**: Acesso total (criar, aprovar, rejeitar)
- **Igreja**: Pode criar candidaturas e ver status
- **Profissional**: Pode aprovar/rejeitar e ver status
- **Pastor**: Pode aprovar/rejeitar e ver status

### Implementacao
```typescript
// Usar RoleRoute generico
<RoleRoute allowedRoles={['admin', 'desenvolvedor', 'igreja', 'profissional', 'pastor']}>
  <SoldadoApplications />
</RoleRoute>
```

---

## Ordem de Implementacao

1. **ApplicationStatusBadge.tsx** - Componente simples, sem dependencias
2. **NewApplicationForm.tsx** - Formulario de criacao
3. **ApplicationApprovalCard.tsx** - Card com logica de aprovacao
4. **SoldadoApplications.tsx** - Pagina principal integrando tudo
5. **Atualizacoes de navegacao** - AdminLayout, App.tsx, AdminDashboard

---

## Arquivos a Modificar

| Arquivo | Acao |
|---------|------|
| `src/components/soldado/ApplicationStatusBadge.tsx` | CRIAR |
| `src/components/soldado/NewApplicationForm.tsx` | CRIAR |
| `src/components/soldado/ApplicationApprovalCard.tsx` | CRIAR |
| `src/pages/admin/SoldadoApplications.tsx` | CRIAR |
| `src/components/admin/AdminLayout.tsx` | MODIFICAR (adicionar nav item) |
| `src/pages/admin/AdminDashboard.tsx` | MODIFICAR (adicionar card) |
| `src/App.tsx` | MODIFICAR (adicionar rota) |

---

## Consideracoes Tecnicas

1. **Uso de RLS**: Todas as queries respeitam as policies existentes
2. **Padrao de UI**: Seguindo design do `PendingCredentials.tsx` e `UserDetailsModal.tsx`
3. **Validacao**: Usando Zod para validacao de formularios
4. **Feedback Visual**: Toasts para sucesso/erro, loading states
5. **Responsividade**: Grid responsivo para cards

