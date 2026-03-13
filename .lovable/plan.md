

# Plano: Shadow Mode — Comparação Observer × Phase Manager

## Alteracoes em `src/pages/admin/IOOverview.tsx`

### 1. Nova query: buscar fase do observer por usuario

Query `turn_insights` para cada usuario com registro IO — buscar o `phase` mais recente (com `extraction_status = 'completed'`). Usar uma query unica com distinct on user_id ordenado por created_at desc. O campo `message_user_id` serve como proxy do user_id (buscar via chat_sessions join ou usar diretamente se disponivel).

Alternativa mais simples: buscar todos os turn_insights recentes e mapear por `message_user_id` (que referencia o user que enviou a mensagem). Na verdade, turn_insights nao tem user_id direto — tem `message_user_id` que e o id da mensagem. Preciso verificar.

Revisando o schema: turn_insights tem `chat_session_id`. Para obter o user_id, preciso fazer join com chat_sessions. Mas como e admin com RLS permissivo, posso buscar turn_insights e chat_sessions separadamente.

**Abordagem pratica**: Para cada user_id da lista io_user_phase, buscar o turn_insight mais recente via:
- Buscar chat_sessions do usuario
- Buscar turn_insight mais recente dessas sessions

Mas isso seria N+1 queries. Melhor: uma query RPC ou buscar todos turn_insights recentes e resolver no client.

**Abordagem final**: Buscar todas chat_sessions com user_id in (userIds), depois buscar turn_insights com chat_session_id in (sessionIds) ordenado por created_at desc. No client, agrupar por user_id e pegar o mais recente.

### 2. Mapeamento de comparacao

```text
OBSERVER_TO_IO_RANGE:
  ACOLHIMENTO    → [1]
  CLARIFICACAO   → [1, 2]
  PADROES        → [3]
  RAIZ           → [3]
  TROCA          → [4, 5]
  CONSOLIDACAO   → [6, 7]
```

Convergente = io_phase esta dentro do range mapeado do observer phase.

### 3. Nova secao "Shadow Mode" na pagina

Posicionada entre "Distribuicao por Fase" e "Usuarios" (ou acima da tabela).

Conteudo:
- Card com contadores: Total avaliados, Convergentes (X / Y%), Divergentes (X / Y%)
- Checkbox/toggle "Mostrar apenas divergentes"
- Tabela compacta: Nome | Observer Phase | IO Phase | Status (badge verde/vermelho)
- Usuarios sem turn_insights mostram "Sem dados do observer"

### 4. Estado adicional

- `showOnlyDivergent`: boolean state
- `observerPhases`: Map<user_id, observer_phase_string> (da query)

### 5. Nenhuma outra alteracao

- Zero edge functions
- Zero tabelas
- Apenas leitura de dados existentes

