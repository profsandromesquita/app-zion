
# ETAPA 7: Matchmaking Semantico

## Visao Geral

Esta etapa cria o sistema de sugestao inteligente de Soldados compativeis com base na dor do Buscador, utilizando:
1. Temas ativos do usuario (`user_themes`) com taxonomia ZION
2. Embeddings semanticos dos testemunhos publicados
3. Disponibilidade horaria dos Soldados
4. Sistema de fallback para MVP com poucos soldados

---

## Arquitetura da Solucao

```text
┌─────────────────────────────────────────────────────────────────┐
│  BUSCADOR (Chat com Zyon)                                       │
│  - Conversa normal                                              │
│  - turn-insight-observer identifica lie_active com taxonomia    │
│  - aggregate-user-journey cria/atualiza user_themes             │
└─────────────────────────────────────────────────────────────────┘
                           │
                           ▼ (Trigger: Fase >= PADROES + lie_active identificado)
┌─────────────────────────────────────────────────────────────────┐
│  ZYON SUGERE CONEXAO                                            │
│  "Parece que voce esta passando por algo com [CENARIO].         │
│   Temos alguem que viveu algo parecido. Quer conhecer?"         │
└─────────────────────────────────────────────────────────────────┘
                           │
                           ▼ (Usuario aceita)
┌─────────────────────────────────────────────────────────────────┐
│  EDGE FUNCTION: matchmaking-soldado                             │
├─────────────────────────────────────────────────────────────────┤
│  INPUT:                                                         │
│  - user_id (buscador)                                           │
│  - session_id (para rastrear tentativas)                        │
│  - excluded_soldados (opcional, do matchmaking_state)           │
│                                                                 │
│  PIPELINE:                                                      │
│  1. Buscar user_themes ativos do buscador                       │
│  2. Gerar embedding combinado dos temas                         │
│  3. Buscar testimonies publicados com embedding                 │
│  4. Calcular similaridade semantica (cosine)                    │
│  5. Filtrar por soldado disponivel (is_available = true)        │
│  6. Filtrar por horarios (soldado_availability)                 │
│  7. Ordenar por:                                                │
│     a) Match de cenario (weight: 0.4)                           │
│     b) Match de security_matrix (weight: 0.3)                   │
│     c) Similaridade semantica (weight: 0.2)                     │
│     d) Proximidade de horario (weight: 0.1)                     │
│  8. Aplicar fallbacks se necessario                             │
│                                                                 │
│  OUTPUT:                                                        │
│  - matches: Array de soldados ranqueados                        │
│  - fallback_type: null | 'generalist' | 'passive' | 'ai_only'   │
│  - suggestion: Texto formatado para exibir                      │
└─────────────────────────────────────────────────────────────────┘
```

---

## PARTE 1: Alteracoes no Banco de Dados

### 1.1 Nova coluna em chat_sessions para estado do matchmaking

```sql
-- Adicionar coluna para rastrear estado do matchmaking
ALTER TABLE public.chat_sessions 
ADD COLUMN matchmaking_state jsonb DEFAULT '{}'::jsonb;

-- Estrutura do matchmaking_state:
-- {
--   "attempts": 0,
--   "excluded_soldados": [],
--   "last_suggestion": null,
--   "last_suggestion_at": null,
--   "fallback_active": false,
--   "mode": "searching" | "matched" | "rejected_all" | "ai_only"
-- }

-- Comentario para documentacao
COMMENT ON COLUMN public.chat_sessions.matchmaking_state IS 
  'Estado do matchmaking: tentativas, soldados excluidos, ultima sugestao';
```

### 1.2 Nova coluna em soldado_profiles para generalista

```sql
-- Adicionar flag de soldado generalista (fallback)
ALTER TABLE public.soldado_profiles 
ADD COLUMN is_generalist boolean DEFAULT false;

-- Comentario
COMMENT ON COLUMN public.soldado_profiles.is_generalist IS 
  'Soldado generalista pode atender qualquer cenario como fallback';
```

---

## PARTE 2: Edge Function matchmaking-soldado

### Arquivo: supabase/functions/matchmaking-soldado/index.ts

### Entrada (Request Body)

```typescript
interface MatchmakingRequest {
  user_id: string;                    // ID do buscador
  session_id: string;                 // ID da sessao do chat
  excluded_soldados?: string[];       // Soldados ja rejeitados
  preferred_days?: number[];          // Dias preferidos (0-6)
  preferred_time_range?: {            // Horario preferido
    start: string;                    // "09:00"
    end: string;                      // "18:00"
  };
}
```

### Saida (Response Body)

```typescript
interface MatchmakingResponse {
  success: boolean;
  matches: SoldadoMatch[];            // Top 3 sugestoes
  total_candidates: number;           // Total de soldados elegiveis
  fallback_type: FallbackType | null; // Tipo de fallback aplicado
  suggestion_text: string;            // Texto formatado para chat
  debug?: {                           // Apenas para admins
    theme_used: ThemeSummary;
    semantic_scores: Record<string, number>;
    availability_filter_removed: number;
  };
}

interface SoldadoMatch {
  soldado_id: string;
  display_name: string;
  bio: string | null;
  specialties: string[];
  scenario_match: boolean;            // Testemunho tem mesmo cenario
  matrix_match: boolean;              // Testemunho tem mesma matriz
  semantic_score: number;             // 0-1 similaridade
  total_score: number;                // Score final ponderado
  testimony_excerpt: string;          // Primeiros 200 chars do testemunho
  available_slots: AvailabilitySlot[]; // Proximos horarios disponiveis
}

interface AvailabilitySlot {
  day_of_week: number;
  day_name: string;                   // "Segunda", "Terca"...
  start_time: string;
  end_time: string;
  is_today: boolean;
  is_tomorrow: boolean;
}

type FallbackType = 
  | 'generalist'      // Soldado generalista (sem match de cenario)
  | 'passive'         // Apenas ouvir testemunho (sem conexao ao vivo)
  | 'ai_only';        // Voltar ao Zyon (apos 3 rejeicoes)
```

### Logica de Matching

```typescript
// 1. Buscar temas ativos do buscador
const themes = await supabase
  .from("user_themes")
  .select("*")
  .eq("user_id", user_id)
  .in("status", ["active", "in_progress"])
  .order("last_activity_at", { ascending: false })
  .limit(3);

// 2. Extrair taxonomia dominante
const dominantTheme = {
  scenario: themes[0]?.scenario,
  center: themes[0]?.center,
  security_matrix: themes[0]?.security_matrix,
  lie_text: themes[0]?.primary_lie?.text
};

// 3. Gerar embedding do contexto do buscador
const contextText = `
  Cenario: ${dominantTheme.scenario}
  Centro: ${dominantTheme.center}
  Matriz: ${dominantTheme.security_matrix}
  Mentira: ${dominantTheme.lie_text}
`;
const queryEmbedding = await generateSimpleEmbedding(contextText);

// 4. Buscar testemunhos publicados com cosine similarity
const { data: testimoniesWithScore } = await supabase.rpc(
  "search_testimonies_by_embedding",
  {
    query_embedding: queryEmbedding,
    match_threshold: 0.03,  // Threshold para hash-based
    match_count: 20,
    exclude_soldados: excluded_soldados || []
  }
);

// 5. Buscar perfis e disponibilidade
const soldadoIds = testimoniesWithScore.map(t => t.user_id);
const { data: profiles } = await supabase
  .from("soldado_profiles")
  .select(`
    id, display_name, bio, specialties, is_available, is_generalist,
    soldado_availability (day_of_week, start_time, end_time)
  `)
  .in("id", soldadoIds)
  .eq("is_available", true);

// 6. Calcular scores compostos
const scoredMatches = profiles.map(profile => {
  const testimony = testimoniesWithScore.find(t => t.user_id === profile.id);
  const analysis = testimony?.analysis || {};
  
  return {
    ...profile,
    scenario_match: analysis.scenario === dominantTheme.scenario,
    matrix_match: analysis.security_matrix === dominantTheme.security_matrix,
    semantic_score: testimony?.similarity || 0,
    total_score: 
      (analysis.scenario === dominantTheme.scenario ? 0.4 : 0) +
      (analysis.security_matrix === dominantTheme.security_matrix ? 0.3 : 0) +
      (testimony?.similarity || 0) * 0.2 +
      (hasAvailabilityToday(profile) ? 0.1 : 0)
  };
});

// 7. Ordenar e pegar top 3
const topMatches = scoredMatches
  .sort((a, b) => b.total_score - a.total_score)
  .slice(0, 3);
```

### Logica de Fallback

```typescript
// Cenario A: Nenhum match semantico encontrado
if (topMatches.length === 0) {
  // Tentar soldado generalista
  const { data: generalists } = await supabase
    .from("soldado_profiles")
    .select("*")
    .eq("is_generalist", true)
    .eq("is_available", true)
    .limit(1);
  
  if (generalists.length > 0) {
    return { 
      matches: generalists, 
      fallback_type: "generalist",
      suggestion_text: "Temos um voluntario disponivel para conversar..."
    };
  }
}

// Cenario B: 3+ rejeicoes consecutivas
const sessionState = await getSessionMatchmakingState(session_id);
if (sessionState.attempts >= 3) {
  return {
    matches: [],
    fallback_type: "ai_only",
    suggestion_text: "Entendo que nenhuma sugestao foi ideal. Podemos continuar nossa conversa aqui, e quando sentir que esta pronto, volto a sugerir."
  };
}

// Cenario C: Usuario nao quer conexao ao vivo
// -> Sugerir ouvir testemunho passivamente
if (preferred_mode === "passive") {
  const testimony = await getPassiveTestimony(dominantTheme);
  return {
    matches: [],
    fallback_type: "passive",
    suggestion_text: `Encontrei um testemunho de alguem que passou por ${dominantTheme.scenario}. Quer ouvir?`,
    passive_testimony_id: testimony?.id
  };
}
```

---

## PARTE 3: Funcao RPC para busca semantica

```sql
-- Funcao para buscar testemunhos por similaridade semantica
CREATE OR REPLACE FUNCTION public.search_testimonies_by_embedding(
  query_embedding vector(1536),
  match_threshold double precision DEFAULT 0.03,
  match_count integer DEFAULT 10,
  exclude_soldados uuid[] DEFAULT '{}'::uuid[]
)
RETURNS TABLE (
  id uuid,
  user_id uuid,
  transcript text,
  analysis jsonb,
  similarity double precision
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    t.id,
    t.user_id,
    t.transcript,
    t.analysis,
    1 - (t.embedding <=> query_embedding) AS similarity
  FROM public.testimonies t
  INNER JOIN public.soldado_profiles sp ON t.user_id = sp.id
  WHERE 
    t.status = 'published'
    AND t.embedding IS NOT NULL
    AND sp.is_available = true
    AND NOT (t.user_id = ANY(exclude_soldados))
    AND 1 - (t.embedding <=> query_embedding) > match_threshold
  ORDER BY similarity DESC
  LIMIT match_count;
END;
$$;
```

---

## PARTE 4: Integracao com Chat (zyon-chat)

### Trigger de Sugestao

O zyon-chat deve detectar quando sugerir conexao. Criterios:
1. Usuario autenticado (nao anonimo)
2. Fase >= PADROES (turn-insight-observer)
3. lie_active identificado com confidence >= 0.6
4. Nao ha matchmaking_state.mode = 'ai_only'
5. Ultima sugestao foi ha mais de 10 turnos OU tema mudou

### Fluxo no Chat

```typescript
// Em zyon-chat, apos processar resposta normal:

// 1. Verificar se deve sugerir conexao
const shouldSuggest = await checkShouldSuggestConnection(
  userId, 
  sessionId, 
  sessionContext // do observer
);

if (shouldSuggest) {
  // 2. Chamar matchmaking
  const matchResult = await supabase.functions.invoke("matchmaking-soldado", {
    body: { user_id: userId, session_id: sessionId }
  });
  
  // 3. Anexar sugestao a resposta
  if (matchResult.data?.matches?.length > 0) {
    response.next_actions = {
      matchmaking_suggestion: {
        soldado: matchResult.data.matches[0],
        suggestion_text: matchResult.data.suggestion_text
      }
    };
  }
}
```

### UI de Sugestao no Chat

Apos a resposta do Zyon, exibir card com:
- Nome e foto do Soldado
- Especialidades/tags
- Trecho do testemunho
- Horarios disponiveis
- Botoes: [Quero conhecer] [Agora nao] [Ver outros]

---

## PARTE 5: Componente de Sugestao no Chat

### Novo componente: SoldadoSuggestionCard.tsx

```typescript
interface SoldadoSuggestionCardProps {
  soldado: SoldadoMatch;
  onAccept: (soldadoId: string) => void;
  onReject: (soldadoId: string, reason: RejectionReason) => void;
  onViewOthers: () => void;
}

type RejectionReason = 
  | 'schedule_mismatch'  // Horarios nao batem
  | 'not_good_match'     // Nao parece bom match
  | 'not_ready'          // Nao estou pronto
  | 'prefer_ai';         // Prefiro continuar com IA
```

---

## PARTE 6: Arquivos a Criar/Modificar

| Arquivo | Acao | Descricao |
|---------|------|-----------|
| `supabase/functions/matchmaking-soldado/index.ts` | CRIAR | Edge function principal |
| `supabase/config.toml` | MODIFICAR | Adicionar funcao |
| Migracao SQL | CRIAR | Adicionar colunas + funcao RPC |
| `src/components/chat/SoldadoSuggestionCard.tsx` | CRIAR | Card de sugestao |
| `src/pages/Chat.tsx` | MODIFICAR | Renderizar sugestao |
| `supabase/functions/zyon-chat/index.ts` | MODIFICAR | Integrar matchmaking trigger |

---

## PARTE 7: Consideracoes de Performance

### Indices Necessarios

```sql
-- Indice para busca por embedding (HNSW)
CREATE INDEX IF NOT EXISTS testimonies_embedding_idx 
ON public.testimonies 
USING hnsw (embedding vector_cosine_ops)
WHERE status = 'published' AND embedding IS NOT NULL;

-- Indice para busca de soldados disponiveis
CREATE INDEX IF NOT EXISTS soldado_profiles_available_idx 
ON public.soldado_profiles (is_available)
WHERE is_available = true;

-- Indice para busca de temas ativos
CREATE INDEX IF NOT EXISTS user_themes_active_idx 
ON public.user_themes (user_id, status)
WHERE status IN ('active', 'in_progress');
```

### Cache de Embeddings

Para evitar recalcular embeddings a cada request:
1. Armazenar embedding do contexto do buscador em `chat_sessions.matchmaking_state`
2. Invalidar quando `user_themes` for atualizado

---

## PARTE 8: Fluxo de Rejeicao

### Opcao A: Horarios nao batem
1. Usuario clica "Horarios nao batem"
2. Sistema pede dias/horarios preferidos
3. Refaz busca com filtro de disponibilidade ajustado
4. Atualiza `matchmaking_state.excluded_soldados` com soldado anterior

### Opcao B: Nao parece bom match
1. Usuario clica "Nao parece bom match"
2. Sistema adiciona soldado a `excluded_soldados`
3. Busca proximo candidato
4. Incrementa `matchmaking_state.attempts`

### Opcao C: Nao estou pronto
1. Usuario clica "Nao estou pronto"
2. Sistema oferece conteudo passivo (ouvir testemunho)
3. Atualiza `matchmaking_state.mode = 'passive'`

### Opcao D: Prefiro continuar com IA
1. Usuario clica "Prefiro continuar com IA"
2. Atualiza `matchmaking_state.mode = 'ai_only'`
3. Sistema para de sugerir por 10 turnos ou ate reset

---

## PARTE 9: Ordem de Implementacao

1. **Migracao SQL** - Colunas + funcao RPC + indices
2. **matchmaking-soldado Edge Function** - Logica principal
3. **config.toml** - Registrar funcao
4. **SoldadoSuggestionCard.tsx** - Componente UI
5. **Chat.tsx** - Renderizar sugestao
6. **zyon-chat** - Integrar trigger de sugestao
7. **Testes end-to-end** - Validar fluxo completo

---

## PARTE 10: Secao Tecnica - Calculo de Similaridade

### Hash-Based vs Semantic Embedding

O sistema atual usa embeddings hash-based (1536 dims) que:
- NAO sao semanticos reais
- Funcionam como fallback ate ter embeddings de verdade
- Threshold de 0.03 (muito baixo porque hashes sao pseudo-aleatorios)

### Migracao Futura

Quando migrar para embeddings reais (OpenAI/Gemini):
1. Criar coluna `embedding_model_id` em testimonies
2. Reprocessar todos os testemunhos
3. Ajustar threshold para 0.4-0.7

### Matching Atual (MVP)

Para o MVP com hash-based, o matching sera majoritariamente baseado em:
1. Match exato de `scenario` (40%)
2. Match exato de `security_matrix` (30%)
3. Disponibilidade (10%)
4. Semantic score como desempate (20%)

Isso garante matches uteis mesmo sem embeddings semanticos reais.
