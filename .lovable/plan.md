

# Redesign IOJourneySection — Narrativa Contextual

## Resumo
Reescrever `src/components/profile/IOJourneySection.tsx` para transformar dados brutos em narrativa emocional. Nenhuma alteração em backend, tabelas ou edge functions.

## Alterações em `src/components/profile/IOJourneySection.tsx`

### 1. Dados derivados (sem novas queries)
- **Dias desde entrada na fase**: `daysSincePhaseEntry = daysDiff(phase_entered_at, now)`
- **Adesão**: `totalSessions / daysSincePhaseEntry`
- **Semana atual (streak visual)**: query `io_daily_sessions` dos últimos 7 dias para marcar quais dias tiveram sessão completa

Nova query adicional (leve):
```typescript
const { data: weekSessions } = useQuery({
  queryKey: ["io-week-sessions", userId],
  queryFn: async () => {
    const weekAgo = new Date(); weekAgo.setDate(weekAgo.getDate() - 6);
    const { data } = await supabase.from("io_daily_sessions")
      .select("session_date").eq("user_id", userId).eq("completed", true)
      .gte("session_date", weekAgo.toISOString().split("T")[0]);
    return new Set((data || []).map(d => d.session_date));
  },
});
```

### 2. Constantes de conteúdo narrativo
- `IGI_MESSAGES`: mapa de faixas (0-2, 2-4, 4-6, 6-8, 8-10) com frases contextuais
- `STREAK_MESSAGES`: mapa por faixa (0, 1-2, 3-4, 5+)
- `ADHERENCE_MESSAGES`: mapa por faixa (<30%, 30-60%, >60%)
- `PHASE_DETAILS`: 7 entradas com descrição expandida + critério de avanço
- IGI zero: mensagem especial

### 3. Layout vertical (ordem)

**a) Barra de fases** — manter a barra de 7 círculos existente (sem mudança)

**b) Card da fase atual** — manter card verde, adicionar:
- `Collapsible` com trigger "Entender esta fase" (ChevronDown)
- Conteúdo expandido: descrição longa + "O que falta para avançar:" com texto da fase

**c) Índice de Integridade (IGI)**
- Label: "Seu índice de integridade"
- Valor `X.X / 10` com seta de tendência
- `Progress` bar (0-10 mapeado para 0-100%)
- Frase contextual abaixo por faixa

**d) Streak Visual (7 dias)**
- Linha horizontal de 7 círculos (Seg-Dom da semana atual)
- Preenchido verde se sessão, cinza vazio se não
- Labels dos dias (S T Q Q S S D)
- Frase contextual por faixa de streak
- Número de streak menor abaixo

**e) Sessões com proporção**
- "X sessões em Y dias"
- Frase de adesão

**f) Gráfico de evolução IGI**
- Se `igi_history.length >= 3`: manter `MiniIGIChart` existente, adicionar eixos leves
- Se `< 3`: mensagem de construção com ícone `BarChart3` + texto motivacional

**g) Botão de sessão** — manter como está

### 4. Componentes usados
- `Collapsible`, `CollapsibleTrigger`, `CollapsibleContent` de `@radix-ui/react-collapsible`
- `Progress` existente
- `ChevronDown` de lucide-react
- Tailwind classes existentes (paleta emerald/lime)

### 5. Arquivo alterado
- `src/components/profile/IOJourneySection.tsx` (reescrita completa, ~350 linhas)

