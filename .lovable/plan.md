

# Plano: Edge Function io-phase-manager

## Resumo

Criar `supabase/functions/io-phase-manager/index.ts` — componente novo e independente que avalia criterios de progressao de fase IO com base em dados acumulados de sessoes.

## Implementacao

### 1. Edge Function `supabase/functions/io-phase-manager/index.ts`

Arquivo unico com ~500 linhas, seguindo o padrao exato do `turn-insight-observer` (imports, CORS, service_role client).

**Estrutura interna:**

```text
CORS handler
├─ Parse input (user_id, action, override_phase, override_notes)
├─ STEP 0: Feature flag check (get_feature_flag RPC)
│   └─ Se false → log observability + return { skipped: true }
├─ Router por action:
│   ├─ 'get_status' → busca io_user_phase e retorna
│   ├─ 'manual_override' → valida admin via auth, atualiza fase, registra transicao
│   └─ 'evaluate' → fluxo principal:
│       ├─ Buscar io_user_phase (ou criar com phase=1)
│       ├─ Buscar sessoes da fase atual (io_daily_sessions)
│       ├─ Aplicar hard rule da fase atual (funcoes dedicadas)
│       ├─ Avaliar regressao (IGI recente vs media geral, threshold 70%)
│       ├─ Calcular IGI via RPC calculate_igi
│       ├─ Atualizar streak
│       ├─ Gravar decisao (io_user_phase + io_phase_transitions)
│       ├─ Log observability
│       └─ Retornar resposta completa
```

**Hard rules — 7 funcoes puras:**
- `evaluatePhase1(sessions)` → clareza >= 6 por 3 dias consecutivos
- `evaluatePhase2(sessions, phase1Sessions)` → regulacao +30% vs fase 1 (ou >= 6 x3 se sem historico)
- `evaluatePhase3(sessions, phaseCriteriaMet)` → campos identidade preenchidos + clareza >= 7
- `evaluatePhase4(streakCurrent)` → streak >= 5
- `evaluatePhase5(sessions)` → vitalidade >= 6 por 5 dias
- `evaluatePhase6(phaseCriteriaMet)` → 3 areas com plano + 1 acao executada
- `evaluatePhase7(sessions)` → autonomia >= 7 (manutencao)

Cada funcao retorna `{ met: boolean, details: string }`.

**Regressao:** Funcao `evaluateRegression(recentSessions, allPhaseSessions)` — compara IGI medio das ultimas 5 vs media geral. Se queda > 30%, sugere regressao. No shadow mode, apenas registra.

**Manual override:** Valida JWT via `getClaims()`, verifica role admin/desenvolvedor via `has_role` RPC.

### 2. Config `supabase/config.toml`

Adicionar:
```toml
[functions.io-phase-manager]
verify_jwt = false
```

### 3. Nenhuma outra alteracao

- Zero alteracoes em edge functions existentes
- Zero alteracoes em tabelas
- Zero alteracoes em frontend

