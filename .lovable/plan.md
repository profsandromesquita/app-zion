

# Plano: Criar página /admin/io-missions — CRUD de Missões IO

## Resumo
Nova página admin para gerenciar missões IO com listagem filtrada, criação/edição via modal, toggle ativo/inativo, estatísticas por missão e preview visual.

## Arquivos

### 1. Criar `src/pages/admin/IOMissions.tsx`
Página completa com:

**Listagem**:
- `useQuery` em `io_missions` — select all, ordenado por phase, week_range
- Filtros locais (useState): fase (1-7), tipo, ativa/inativa
- Tabela com colunas: Fase | Semanas | Título | Tipo | Dificuldade | Ativa (Switch) | Ações (Editar, Stats)
- Contagem total e por fase no header

**Criar/Editar (Dialog compartilhado)**:
- Estado `editingMission` (null = criar, objeto = editar)
- Campos com validação: phase (select 1-7), week_range (select), title (max 100), description (textarea max 500), type (select 5 opções), difficulty (select 3 opções), is_active (Switch)
- Insert ou update via supabase client + invalidateQueries

**Toggle ativo/inativo**:
- Switch direto na tabela, update `is_active` inline

**Estatísticas por missão (Dialog)**:
- Ao clicar stats, query `io_daily_sessions` where `mission_id = X`
- Count total atribuídas, count `mission_completed = true`, taxa
- Últimos 5 registros (ordenado por session_date desc, limit 5)

**Preview**:
- Card visual dentro do modal de criação/edição mostrando como a missão aparece (título, descrição, badges de tipo/dificuldade)

**Padrão**: RoleRoute + AdminLayout, Skeleton loading, mesmo visual do IODashboard/IOOverview

### 2. Alterar `src/components/admin/AdminLayout.tsx`
Adicionar após "IO Dashboard":
```typescript
{ to: "/admin/io-missions", icon: Target, label: "Missões IO" },
```
Importar `Target` de lucide-react.

### 3. Alterar `src/App.tsx`
Adicionar rota e import:
```typescript
import IOMissions from "./pages/admin/IOMissions";
<Route path="/admin/io-missions" element={<IOMissions />} />
```

## Escopo restrito
- Read-only nas tabelas externas (io_daily_sessions para stats)
- CRUD apenas em io_missions
- Nenhum edge function alterado
- Nenhuma tabela alterada
- Nenhuma migration

