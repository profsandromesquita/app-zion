

# Plano: Adicionar controles de teste do Phase Manager no IO Overview

## Alteracoes

### 1. `src/pages/admin/IOOverview.tsx`

**Na tabela de usuarios**, adicionar coluna "PM Status" que mostra um badge verde/cinza baseado na flag `io_phase_manager_enabled` para cada usuario. Buscar flags via query adicional na `feature_flags` table (global + user scope).

**No dialog de detalhe**, adicionar secao "Phase Manager" apos as sessoes com:

- Botao "Verificar Status" → `supabase.functions.invoke('io-phase-manager', { body: { user_id, action: 'get_status' } })`
- Botao "Avaliar Fase" → `supabase.functions.invoke('io-phase-manager', { body: { user_id, action: 'evaluate' } })`
- Select de fase 1-7 + botao "Override Manual" → `action: 'manual_override'`
- Area `<pre>` com JSON do resultado formatado
- Se resultado contem `skipped: true`, mostrar alerta amarelo "Phase Manager desabilitado para este usuario (flag off)"

**Detalhes tecnicos:**
- Usar `useState` para `pmResult`, `pmLoading`
- 3 funcoes: `handleEvaluate`, `handleGetStatus`, `handleManualOverride`
- Select usa componente HTML nativo para simplicidade
- PM Status na tabela: query global flag + user-specific flags, resolve cascata no client

### 2. Nenhuma outra alteracao
- Zero alteracoes em edge functions
- Zero alteracoes em tabelas
- Apenas UI no admin

