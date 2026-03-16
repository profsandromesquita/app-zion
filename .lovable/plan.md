

# Plano: Sinais do Observer no IO Overview

## Resumo

Adicionar visualização dos sinais do observer (turn_insights) no dialog de detalhe do usuário e no resultado do "Avaliar Fase". A flag `io_pm_observer_signals_enabled` já existe no banco (false, global).

## Alterações em `src/pages/admin/IOOverview.tsx`

### 1. Nova query: observer signals do usuário selecionado

Quando `selectedUser` estiver ativo, buscar `turn_insights` das últimas 2 semanas (via chat_sessions do usuário). Agregar no cliente:
- `shiftsDetected`, `avgOverallScore`, `avgEmotionIntensity`, `unstableCount`, `severeIssuesCount`, `hasSevereBlock`, `observerPhase` (mais recente), `recentShiftDescriptions` (últimas 3)

### 2. Seção "Sinais do Observer" no dialog

Após a seção "Phase Manager" (~linha 693), renderizar card com:
- Shifts detectados: X
- Score médio: X.X / 5.0
- Intensidade emocional média: X.X / 3.0
- Turnos instáveis: X
- Bloqueio severo: badge verde/vermelho
- Fase do observer: badge
- Últimos shifts: lista das 3 descrições

### 3. Observer signals no resultado do PM

No bloco `pmResult` (~linha 677), se `pmResult.observer_signals` existir, renderizar seção formatada mostrando:
- Sinais consultados: sim/não
- Bloqueio: sim/não
- Recomendação: positive/neutral/blocked (com badge colorido)

### 4. Flag já existe — nada a criar

A flag `io_pm_observer_signals_enabled` já está no banco com `false` e `scope: global`.

## Arquivo alterado
- `src/pages/admin/IOOverview.tsx`

## Nenhuma alteração em
- Edge functions
- Tabelas do banco

