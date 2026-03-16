

# Plano: Criar página /admin/io-audit — Auditoria IO

## Resumo
Nova página admin com duas tabs: auditoria de transições de fase e monitor de sessões diárias. Tudo read-only, joins com `profiles` e `io_missions` para contexto.

## Arquivos

### 1. Criar `src/pages/admin/IOAudit.tsx`
Página com `Tabs` (duas tabs):

**Tab 1 — Auditoria de Transições**:
- Query `io_phase_transitions` ordenado por `created_at desc`
- Join client-side com `profiles` (nome, email) via user_ids
- Filtros: tipo de transição (dropdown), busca por usuário, período
- Badges coloridos: advance=verde, regression=vermelho, manual_override=amarelo, initial_placement=cinza
- Card de alerta no topo: regressões nos últimos 7 dias
- Dialog de detalhe: criteria_snapshot formatado como JSON legível, IGI/streak do snapshot, notas

**Tab 2 — Monitor de Sessões**:
- Query `io_daily_sessions` ordenado por `session_date desc, created_at desc`
- Join client-side com `profiles` e `io_missions` (título da missão)
- Filtros: usuário, fase, status (completa/incompleta), período
- Métricas no topo: sessões hoje, total no período, taxa completude, duração média
- Tabela: Data, Usuário, Fase, Mood, Missão, Escalas (resumo), IGI, Duração, Status
- Dialog de detalhe: 7 escalas, registro_text, feedback_generated, reforco_identitario, missão (título+descrição), duração

**Padrão**: RoleRoute + AdminLayout, Skeleton loading, mesmo visual das outras páginas admin.

### 2. Alterar `src/components/admin/AdminLayout.tsx`
Adicionar após "Missões IO":
```typescript
{ to: "/admin/io-audit", icon: ClipboardList, label: "Auditoria IO" },
```

### 3. Alterar `src/App.tsx`
Adicionar rota e import para `/admin/io-audit`.

## Escopo restrito
- Apenas leitura
- Nenhum edge function alterado
- Nenhuma tabela/migration

