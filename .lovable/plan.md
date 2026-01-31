
# Plano de Implementação: Integrar Bio/Avatar no Modelo + Melhorar Jornada

## Resumo Executivo
Implementar duas melhorias conforme recomendações do relatório técnico:
1. **Integrar Bio e Avatar Simbólico** no contexto do modelo Zyon-Chat
2. **Melhorar visualização da Jornada** com métricas dinâmicas (`phase_confidence`, `total_shifts`)

---

## PARTE 1: Integrar Bio e Avatar no Contexto do Modelo

### 1.1 Alterações na Query de Profiles

**Arquivo**: `supabase/functions/zyon-chat/index.ts`  
**Linha**: 1667-1671

```text
ANTES:
.select("nome, grammar_gender")

DEPOIS:
.select("nome, grammar_gender, bio, avatar_url")
```

### 1.2 Criar Mapeamento de Avatares Simbólicos

**Arquivo**: `supabase/functions/zyon-chat/index.ts`  
**Localização**: Após as constantes existentes (aprox. linha 50-100)

```typescript
// Mapeamento de avatares simbólicos para contexto emocional
const AVATAR_EMOTIONAL_CONTEXT: Record<string, { 
  name: string; 
  emotionalHint: string; 
  suggestionForModel: string 
}> = {
  "seed-in-dark": {
    name: "A Semente no Escuro",
    emotionalHint: "Usuário se sente 'enterrado' pelos problemas mas tem esperança de potencial adormecido",
    suggestionForModel: "Valorize pequenos progressos. Lembre que toda jornada começa com um primeiro passo."
  },
  "kintsugi-vase": {
    name: "O Vaso Kintsugi",
    emotionalHint: "Usuário está aceitando que suas 'quebras' podem ser transformadas em beleza",
    suggestionForModel: "Valide a coragem de olhar para as cicatrizes. Enfatize resiliência e cura."
  },
  "deep-diver": {
    name: "O Mergulhador nas Profundezas",
    emotionalHint: "Usuário está pronto para encarar medos subconscientes",
    suggestionForModel: "Pode ir mais fundo nas perguntas. O usuário demonstra coragem para introspecção."
  },
  "lit-labyrinth": {
    name: "O Labirinto Iluminado",
    emotionalHint: "Usuário se sente perdido mas está buscando clareza ativamente",
    suggestionForModel: "Ajude a ordenar pensamentos. Faça perguntas que tragam clareza gradual."
  },
  "flame-in-storm": {
    name: "A Chama na Tempestade",
    emotionalHint: "Usuário passa por momento difícil mas mantém força interior",
    suggestionForModel: "Reconheça a força de resistir. Não minimize a tempestade, mas valorize a chama."
  },
  "breaking-cocoon": {
    name: "O Casulo a Romper",
    emotionalHint: "Usuário em fase de transição intensa, sente desconforto da mudança",
    suggestionForModel: "Normalize o desconforto da transformação. Celebre sinais de evolução."
  },
  "mountain-horizon": {
    name: "A Montanha no Horizonte",
    emotionalHint: "Usuário identificou o tamanho do desafio e está determinado",
    suggestionForModel: "Reconheça a grandeza do desafio. Foque em passos concretos, não no cume."
  },
  "clearing-mirror": {
    name: "O Espelho Embaciado",
    emotionalHint: "Usuário começando a questionar mentiras sobre si mesmo",
    suggestionForModel: "Ajude a limpar mais do espelho. Faça perguntas que revelem identidade verdadeira."
  },
  "broken-chain": {
    name: "A Corrente Quebrada",
    emotionalHint: "Usuário teve momento de libertação, identificou mentira que o prendia",
    suggestionForModel: "Celebre a libertação! Ajude a consolidar o insight para que não volte."
  },
  "inner-sunrise": {
    name: "O Nascer do Sol Interior",
    emotionalHint: "Usuário vendo luz ao fundo do túnel, fase de otimismo e renovação",
    suggestionForModel: "Alimente a esperança. Este é momento de consolidar ganhos e olhar para frente."
  }
};

// Função auxiliar para extrair ID do avatar simbólico a partir da URL
function extractSymbolicAvatarId(avatarUrl: string | null): string | null {
  if (!avatarUrl) return null;
  
  // Avatares simbólicos estão em /avatars/[id].webp
  const match = avatarUrl.match(/\/avatars\/([a-z-]+)\.webp$/);
  return match ? match[1] : null;
}
```

### 1.3 Injetar Bio e Avatar no Contexto (Uso Discreto)

**Arquivo**: `supabase/functions/zyon-chat/index.ts`  
**Localização**: Após linha 1714 (após `if (onboardingContext)`)

```typescript
// ============================================
// BIO AND SYMBOLIC AVATAR CONTEXT INJECTION
// ============================================
let selfPerceptionContext = "";

// Bio: contexto explícito fornecido pelo usuário
if (basicProfile?.bio && basicProfile.bio.trim().length > 0) {
  selfPerceptionContext += `\n\n## AUTO-DESCRIÇÃO DO USUÁRIO (use discretamente, sem mencionar que leu)
O usuário descreveu-se assim: "${basicProfile.bio.trim().substring(0, 500)}"
REGRAS: Use como PISTA de contexto. NÃO repita literalmente. NÃO diga "você disse na sua bio".`;
}

// Avatar simbólico: pista de auto-percepção emocional
const symbolicAvatarId = extractSymbolicAvatarId(basicProfile?.avatar_url);
if (symbolicAvatarId && AVATAR_EMOTIONAL_CONTEXT[symbolicAvatarId]) {
  const avatarContext = AVATAR_EMOTIONAL_CONTEXT[symbolicAvatarId];
  selfPerceptionContext += `\n\n## ESTADO EMOCIONAL AUTO-PERCEBIDO (pista sutil, NÃO mencione o avatar)
Avatar escolhido: "${avatarContext.name}"
Pista emocional: ${avatarContext.emotionalHint}
Sugestão: ${avatarContext.suggestionForModel}
REGRA: Use como orientação de tom, NÃO diga "pelo seu avatar" ou "você escolheu".`;
}

if (selfPerceptionContext) {
  diaryContext += selfPerceptionContext;
  console.log("Self-perception context injected (bio + avatar)");
}
```

---

## PARTE 2: Melhorar Visualização da Jornada

### 2.1 Expandir Dados da Jornada no Profile.tsx

**Arquivo**: `src/pages/Profile.tsx`

**Atualizar Interface** (linha 28-33):
```typescript
interface JourneyData {
  fase_jornada: string | null;
  active_themes_count: number | null;
  global_avg_score: number | null;
  spiritual_maturity: string | null;
  // NOVOS CAMPOS
  total_shifts: number | null;
  updated_at: string | null;
}
```

**Atualizar Query** (linha 108-112):
```typescript
const { data: journeyData, error: journeyError } = await supabase
  .from("user_profiles")
  .select("fase_jornada, active_themes_count, global_avg_score, spiritual_maturity, total_shifts, updated_at")
  .eq("id", user.id)
  .maybeSingle();
```

### 2.2 Atualizar Componente JourneySection

**Arquivo**: `src/components/profile/JourneySection.tsx`

**Atualizar Interface**:
```typescript
interface JourneyData {
  fase_jornada: string | null;
  active_themes_count: number | null;
  global_avg_score: number | null;
  spiritual_maturity: string | null;
  total_shifts: number | null;
  updated_at: string | null;
}
```

**Calcular Progresso Dinâmico**:
```typescript
// Progresso base por fase (peso: 60%)
const baseProgress = PHASE_MESSAGES[phase]?.progress || 10;

// Bônus por shifts/insights (peso: 25%, max +15%)
const shiftsBonus = Math.min(15, (journey.total_shifts || 0) * 3);

// Bônus por atividade recente (peso: 15%, max +10%)
const daysSinceActivity = journey.updated_at 
  ? Math.floor((Date.now() - new Date(journey.updated_at).getTime()) / (1000 * 60 * 60 * 24))
  : 30;
const activityBonus = daysSinceActivity <= 3 ? 10 : daysSinceActivity <= 7 ? 5 : 0;

// Progresso final (máximo 95%, nunca 100%)
const dynamicProgress = Math.min(95, baseProgress + shiftsBonus + activityBonus);
```

**Adicionar Card de Insights/Shifts**:
```text
┌──────────────────┐  ┌──────────────────┐  ┌──────────────────┐  ┌──────────────────┐
│  📊 TEMAS ATIVOS │  │  ⭐ SCORE MÉDIO  │  │  💡 INSIGHTS     │  │  🌿 MATURIDADE  │
│  ────────────────│  │  ────────────────│  │  ────────────────│  │  ────────────────│
│        0         │  │       3.5        │  │       12         │  │   Consolidado   │
│                  │  │                  │  │                  │  │                 │
│  Temas em        │  │  Progresso       │  │  Mudanças de     │  │  Nível de       │
│  exploração      │  │  geral           │  │  perspectiva     │  │  crescimento    │
└──────────────────┘  └──────────────────┘  └──────────────────┘  └──────────────────┘
```

**Indicador de Atividade Recente**:
```text
┌─────────────────────────────────────────────────────────────┐
│  📈 Progresso da jornada                           42%     │
│  ▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░  │
│  Início ────────────────────────────────── Consolidação    │
│                                                             │
│  ● Ativo recentemente (última sessão há 2 dias)            │
└─────────────────────────────────────────────────────────────┘
```

---

## Arquivos a Modificar

| Arquivo | Alterações |
|---------|------------|
| `supabase/functions/zyon-chat/index.ts` | Adicionar bio/avatar_url na query, criar mapeamento, injetar contexto |
| `src/components/profile/JourneySection.tsx` | Adicionar total_shifts, cálculo dinâmico, indicador de atividade |
| `src/pages/Profile.tsx` | Expandir JourneyData interface e query |

---

## Fluxo de Implementação

```text
PARTE 1: Integração Bio/Avatar no Modelo
├── 1.1 Adicionar bio e avatar_url na query de profiles (linha 1669)
├── 1.2 Criar constante AVATAR_EMOTIONAL_CONTEXT e função auxiliar
└── 1.3 Injetar contexto após onboarding (após linha 1714)

PARTE 2: Melhorar Visualização da Jornada
├── 2.1 Expandir JourneyData interface (Profile.tsx)
├── 2.2 Atualizar query para incluir total_shifts e updated_at
├── 2.3 Implementar cálculo de progresso dinâmico (JourneySection.tsx)
├── 2.4 Adicionar card de Insights (total_shifts)
└── 2.5 Adicionar indicador de atividade recente

DEPLOY: Fazer deploy da edge function após modificações
```

---

## Detalhes Técnicos

### Regras de Uso Discreto (Bio e Avatar)

| Dado | Uso Permitido | Uso PROIBIDO |
|------|---------------|--------------|
| Bio | Contextualizar respostas, adaptar tom | "Você disse na sua bio que..." |
| Avatar | Orientar tom emocional | "Pelo seu avatar de casulo..." |

### Fórmula de Progresso Dinâmico

```
Progresso = min(95, BasePhase + ShiftsBonus + ActivityBonus)

Onde:
- BasePhase = Valor fixo por fase (10-95%)
- ShiftsBonus = min(15, total_shifts × 3)
- ActivityBonus = 10 se <3 dias, 5 se <7 dias, 0 caso contrário
```

### Exemplo de Cálculo

| Cenário | Fase | Shifts | Dias | Cálculo | Resultado |
|---------|------|--------|------|---------|-----------|
| Usuário novo | inicio | 0 | 1 | 10 + 0 + 10 | 20% |
| Usuário ativo | PADROES | 4 | 2 | 50 + 12 + 10 | 72% |
| Usuário avançado | TROCA | 6 | 10 | 80 + 15 + 0 | 95% |

---

## Resultado Esperado

1. **Modelo mais contextualizado**: Zyon saberá usar bio e avatar como pistas emocionais
2. **Jornada dinâmica**: Progresso reflete atividade real, não apenas fase estática
3. **Feedback visual**: Usuário vê contagem de insights e indicador de atividade
4. **Nunca 100%**: Simboliza jornada contínua de crescimento
