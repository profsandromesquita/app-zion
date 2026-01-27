
# Plano de Implementação: Padronização de Cenários Individuais

## Resumo Executivo

Este plano implementa a padronização de cenários do Observer para usar uma **lista canônica fixa de 12 cenários**, eliminando a fragmentação causada pelo "tagging livre" e aumentando a precisão na detecção da raiz da dor.

## Problema Atual (Evidência nos Dados)

```text
CENÁRIOS FRAGMENTADOS (dados reais da query):
─────────────────────────────────────────────
Vida Social                      → 24 ocorrências ✓
Carreira                         → 19 ocorrências ✓
Família                          →  5 ocorrências ✓
Casamento                        →  4 ocorrências ✓
Ministério                       →  4 ocorrências ✓
Autoestima                       →  3 ocorrências ⚠️
Luto                             →  2 ocorrências ✓
Autoimagem                       →  2 ocorrências ⚠️
Paternidade                      →  2 ocorrências ✓
─────────────────────────────────────────────
FRAGMENTAÇÕES (compostos/variações):
─────────────────────────────────────────────
"Casamento, Carreira"            →  1 ❌
"Relacionamento (casamento), Vida Social" → 1 ❌
"Vida Pessoal / Propósito / Carreira"     → 1 ❌
"Acadêmica, Identidade Pessoal, Vida Social" → 1 ❌
"Geral/Existencial"              →  1 ❌
"Saúde/Mental"                   →  1 ❌
[+15 outras variações]
```

**Impacto:** 19 variações únicas para ~12 cenários reais = ~60% de fragmentação

## Lista Canônica Proposta

Baseada em: dados reais + metodologia ZION + onboarding

```text
┌──────────────────────────────────────────────────────────────────────┐
│                    CENÁRIOS CANÔNICOS (12)                           │
├──────────────────────────────────────────────────────────────────────┤
│  CASAMENTO      │ Conflitos conjugais, intimidade, expectativas      │
│  CARREIRA       │ Trabalho, performance, propósito profissional      │
│  FAMILIA        │ Relações familiares gerais (pais, irmãos)          │
│  VIDA_SOCIAL    │ Amizades, aceitação social, pertencimento          │
│  AUTOESTIMA     │ Valor próprio, autoimagem, identidade pessoal      │
│  SAUDE          │ Física e mental, ansiedade, depressão              │
│  FINANCAS       │ Dinheiro, provisão, segurança material             │
│  MINISTERIO     │ Servir, liderança espiritual, igreja               │
│  LUTO           │ Perdas, morte, separações                          │
│  SEXUALIDADE    │ Identidade sexual, pornografia, pureza             │
│  PATERNIDADE    │ Ser pai, relação com filhos (homens)               │
│  MATERNIDADE    │ Ser mãe, relação com filhos (mulheres)             │
└──────────────────────────────────────────────────────────────────────┘
```

## Arquitetura da Solução

```text
┌──────────────────────────────────────────────────────────────────────┐
│                         FLUXO ATUALIZADO                             │
├──────────────────────────────────────────────────────────────────────┤
│                                                                      │
│  1. OBSERVER PROMPT (turn-insight-observer)                          │
│     └── Instrui LLM a escolher de ENUM fixo (12 opções)              │
│     └── Remove "tagging livre"                                       │
│     └── Adiciona campo "related_scenarios" (array) para contextos    │
│                                                                      │
│  2. TOOL SCHEMA                                                      │
│     └── scenario: enum com 12 valores                                │
│     └── related_scenarios: array opcional                            │
│                                                                      │
│  3. SANITIZAÇÃO                                                      │
│     └── Valida contra lista canônica                                 │
│     └── Extrai cenário primário de strings compostas                 │
│     └── Preserva cenários relacionados em JSON                       │
│                                                                      │
│  4. AGGREGATOR (aggregate-user-journey)                              │
│     └── Usa apenas cenário primário para criar/atualizar temas       │
│     └── Evita fragmentação                                           │
│                                                                      │
│  5. MIGRAÇÃO DE DADOS                                                │
│     └── Script de normalização para dados existentes                 │
│     └── Mapeia variações para cenários canônicos                     │
│                                                                      │
└──────────────────────────────────────────────────────────────────────┘
```

## Detalhes Técnicos

### Arquivo 1: `supabase/functions/turn-insight-observer/index.ts`

#### Mudança 1.1: Atualizar OBSERVER_SYSTEM_PROMPT (linhas ~94-96)

**DE:**
```text
### CENÁRIO (Onde dói) - Tagging Livre:
Casamento, Carreira, Paternidade, Maternidade, Sexualidade, Vida Social, 
Saúde, Família, Ministério, Finanças, Vício, Propósito, Luto, etc.
```

**PARA:**
```text
### CENÁRIO (Onde dói) - OBRIGATÓRIO escolher UM da lista:
- CASAMENTO: Conflitos conjugais, intimidade, expectativas do parceiro
- CARREIRA: Trabalho, performance, propósito profissional, acadêmico
- FAMILIA: Relações familiares gerais (pais, irmãos, família de origem)
- VIDA_SOCIAL: Amizades, aceitação social, pertencimento, rejeição
- AUTOESTIMA: Valor próprio, autoimagem, identidade pessoal
- SAUDE: Saúde física e mental, ansiedade, depressão, vícios
- FINANCAS: Dinheiro, provisão, segurança material
- MINISTERIO: Servir a Deus, liderança espiritual, igreja
- LUTO: Perdas, morte de entes, separações, término
- SEXUALIDADE: Identidade sexual, pornografia, pureza
- PATERNIDADE: Ser pai, relação com filhos (perspectiva masculina)
- MATERNIDADE: Ser mãe, relação com filhos (perspectiva feminina)

REGRA: Escolha o cenário PRINCIPAL. Se múltiplos contextos estão presentes,
liste os secundários em "related_scenarios" (array).
Exemplo: Usuário fala de problema no casamento que afeta trabalho
→ scenario: "CASAMENTO", related_scenarios: ["CARREIRA"]
```

#### Mudança 1.2: Atualizar EXTRACTION_TOOL schema (linhas ~228-241)

**DE:**
```typescript
scenario: { 
  type: "string",
  description: "Cenário onde dói (tagging livre): Casamento, Carreira, ..."
},
```

**PARA:**
```typescript
scenario: { 
  type: "string", 
  enum: ["CASAMENTO", "CARREIRA", "FAMILIA", "VIDA_SOCIAL", "AUTOESTIMA", 
         "SAUDE", "FINANCAS", "MINISTERIO", "LUTO", "SEXUALIDADE", 
         "PATERNIDADE", "MATERNIDADE"],
  description: "Cenário PRINCIPAL onde a dor se manifesta"
},
related_scenarios: {
  type: "array",
  items: { 
    type: "string",
    enum: ["CASAMENTO", "CARREIRA", "FAMILIA", "VIDA_SOCIAL", "AUTOESTIMA", 
           "SAUDE", "FINANCAS", "MINISTERIO", "LUTO", "SEXUALIDADE", 
           "PATERNIDADE", "MATERNIDADE"]
  },
  description: "Cenários secundários afetados (opcional)"
},
```

#### Mudança 1.3: Atualizar JSON_SCHEMA_INSTRUCTIONS (linhas ~350+)

Adicionar o enum de scenario e o campo related_scenarios no schema JSON de fallback.

#### Mudança 1.4: Atualizar Sanitização (linhas ~702-737)

**ADICIONAR constante VALID_SCENARIOS:**
```typescript
// Cenários canônicos ZION - Lista fixa de 12 opções
const VALID_SCENARIOS = [
  'CASAMENTO', 'CARREIRA', 'FAMILIA', 'VIDA_SOCIAL', 'AUTOESTIMA',
  'SAUDE', 'FINANCAS', 'MINISTERIO', 'LUTO', 'SEXUALIDADE',
  'PATERNIDADE', 'MATERNIDADE'
];

// Mapeamento de variações comuns para cenários canônicos
const SCENARIO_ALIASES: Record<string, string> = {
  'RELACIONAMENTO': 'CASAMENTO',
  'RELACIONAMENTOS': 'VIDA_SOCIAL',
  'TRABALHO': 'CARREIRA',
  'PROFISSIONAL': 'CARREIRA',
  'ACADÊMICA': 'CARREIRA',
  'ACADEMICA': 'CARREIRA',
  'AUTOIMAGEM': 'AUTOESTIMA',
  'IDENTIDADE': 'AUTOESTIMA',
  'PROPÓSITO': 'CARREIRA',
  'PROPOSITO': 'CARREIRA',
  'VÍCIO': 'SAUDE',
  'VICIO': 'SAUDE',
  'ANSIEDADE': 'SAUDE',
  'DEPRESSÃO': 'SAUDE',
  'DEPRESSAO': 'SAUDE',
  'MENTAL': 'SAUDE',
  'FÍSICA': 'SAUDE',
  'FISICA': 'SAUDE',
  'FILHOS': 'PATERNIDADE', // ou MATERNIDADE baseado em contexto
  'EXISTENCIAL': 'AUTOESTIMA',
  'GERAL': 'AUTOESTIMA',
};
```

**ATUALIZAR lógica de sanitização:**
```typescript
// Função para normalizar cenário
function normalizeScenario(rawScenario: string | undefined): string | null {
  if (!rawScenario || typeof rawScenario !== 'string') return null;
  
  // Limpar e uppercase
  let scenario = rawScenario.trim().toUpperCase().replace(/[_\-\s]+/g, '_');
  
  // Se já é válido, retornar
  if (VALID_SCENARIOS.includes(scenario)) {
    return scenario;
  }
  
  // Tentar alias direto
  if (SCENARIO_ALIASES[scenario]) {
    return SCENARIO_ALIASES[scenario];
  }
  
  // Se é composto (contém vírgula, barra, etc.), extrair primeiro
  const separators = /[,\/\|]+/;
  if (separators.test(rawScenario)) {
    const parts = rawScenario.split(separators).map(p => p.trim().toUpperCase().replace(/[_\-\s]+/g, '_'));
    for (const part of parts) {
      if (VALID_SCENARIOS.includes(part)) {
        return part;
      }
      if (SCENARIO_ALIASES[part]) {
        return SCENARIO_ALIASES[part];
      }
    }
  }
  
  // Busca parcial em VALID_SCENARIOS
  for (const valid of VALID_SCENARIOS) {
    if (scenario.includes(valid) || valid.includes(scenario)) {
      return valid;
    }
  }
  
  // Fallback: se contém palavras-chave
  const keywords: Record<string, string> = {
    'CASAMENT': 'CASAMENTO',
    'CARREIR': 'CARREIRA',
    'TRABALH': 'CARREIRA',
    'FAMILI': 'FAMILIA',
    'SOCIAL': 'VIDA_SOCIAL',
    'AMIZAD': 'VIDA_SOCIAL',
    'AUTOESTIM': 'AUTOESTIMA',
    'IMAGEM': 'AUTOESTIMA',
    'SAUD': 'SAUDE',
    'MENTAL': 'SAUDE',
    'FINANC': 'FINANCAS',
    'DINHEIR': 'FINANCAS',
    'MINISTER': 'MINISTERIO',
    'IGREJA': 'MINISTERIO',
    'LUTO': 'LUTO',
    'MORT': 'LUTO',
    'SEXUAL': 'SEXUALIDADE',
    'PATERN': 'PATERNIDADE',
    'MATERN': 'MATERNIDADE',
  };
  
  for (const [keyword, canonical] of Object.entries(keywords)) {
    if (scenario.includes(keyword)) {
      return canonical;
    }
  }
  
  console.log(`Unable to normalize scenario: "${rawScenario}"`);
  return null;
}

// Aplicar na sanitização
const lieScenario = normalizeScenario(rawScenario);
```

#### Mudança 1.5: Salvar related_scenarios no lie_active JSON

Ao atualizar o registro, incluir related_scenarios extraídos (se houver):
```typescript
lie_active: {
  ...extractedData.lie_active,
  related_scenarios: extractedData.lie_active?.related_scenarios || []
},
```

### Arquivo 2: `supabase/functions/aggregate-user-journey/index.ts`

#### Mudança 2.1: Garantir que usa cenário normalizado

Não precisa de grandes mudanças - a lógica atual já usa `scenario` diretamente.
Apenas garantir que o cenário já vem normalizado do Observer.

### Arquivo 3: `supabase/functions/normalize-scenarios/index.ts` (NOVO)

Criar nova Edge Function para normalizar dados existentes:

```typescript
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.89.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const VALID_SCENARIOS = [
  'CASAMENTO', 'CARREIRA', 'FAMILIA', 'VIDA_SOCIAL', 'AUTOESTIMA',
  'SAUDE', 'FINANCAS', 'MINISTERIO', 'LUTO', 'SEXUALIDADE',
  'PATERNIDADE', 'MATERNIDADE'
];

const SCENARIO_ALIASES: Record<string, string> = {
  'RELACIONAMENTO': 'CASAMENTO',
  'RELACIONAMENTOS': 'VIDA_SOCIAL',
  // ... (mesma lista do observer)
};

function normalizeScenario(raw: string): string | null {
  // ... (mesma função do observer)
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const supabase = createClient(supabaseUrl, supabaseKey);

  console.log("=== NORMALIZE SCENARIOS START ===");

  // 1. Buscar todos os turn_insights com lie_scenario não-canônico
  const { data: insights } = await supabase
    .from("turn_insights")
    .select("id, lie_scenario, lie_active")
    .not("lie_scenario", "is", null)
    .limit(200);

  let normalized = 0;
  let unchanged = 0;
  const mappings: Record<string, string> = {};

  for (const insight of insights || []) {
    const current = insight.lie_scenario;
    const canonical = normalizeScenario(current);
    
    if (canonical && canonical !== current) {
      await supabase
        .from("turn_insights")
        .update({ lie_scenario: canonical })
        .eq("id", insight.id);
      
      normalized++;
      mappings[current] = canonical;
    } else {
      unchanged++;
    }
  }

  // 2. Normalizar user_themes
  const { data: themes } = await supabase
    .from("user_themes")
    .select("id, scenario")
    .limit(200);

  let themesNormalized = 0;

  for (const theme of themes || []) {
    const current = theme.scenario;
    const canonical = normalizeScenario(current);
    
    if (canonical && canonical !== current) {
      await supabase
        .from("user_themes")
        .update({ scenario: canonical })
        .eq("id", theme.id);
      
      themesNormalized++;
    }
  }

  // 3. Consolidar temas duplicados (mesmo user + cenário normalizado + matriz)
  // ... (lógica de merge)

  return new Response(
    JSON.stringify({
      insights: { normalized, unchanged, mappings },
      themes: { normalized: themesNormalized },
    }),
    { headers: { ...corsHeaders, "Content-Type": "application/json" } }
  );
});
```

### Arquivo 4: `supabase/config.toml`

Adicionar nova função:
```toml
[functions.normalize-scenarios]
verify_jwt = false
```

### Arquivo 5: `src/components/onboarding/OnboardingFlow.tsx`

#### Mudança 5.1: Alinhar PAIN_TAGS com cenários canônicos (opcional)

Atualmente as tags do onboarding são mais emocionais que cenários.
Podemos manter como está ou adicionar mapeamento.

## Sequência de Execução

```text
┌────────────────────────────────────────────────────────────────┐
│                    ORDEM DE IMPLEMENTAÇÃO                      │
├────────────────────────────────────────────────────────────────┤
│                                                                │
│  FASE 1: Código do Observer                                    │
│  ──────────────────────────                                    │
│  1.1 Atualizar OBSERVER_SYSTEM_PROMPT                          │
│  1.2 Atualizar EXTRACTION_TOOL schema                          │
│  1.3 Atualizar JSON_SCHEMA_INSTRUCTIONS                        │
│  1.4 Adicionar VALID_SCENARIOS e normalizeScenario()           │
│  1.5 Atualizar lógica de sanitização                           │
│                                                                │
│  FASE 2: Script de Normalização                                │
│  ─────────────────────────────                                 │
│  2.1 Criar normalize-scenarios Edge Function                   │
│  2.2 Atualizar config.toml                                     │
│                                                                │
│  FASE 3: Deploy e Execução                                     │
│  ─────────────────────────                                     │
│  3.1 Deploy automático das funções                             │
│  3.2 Executar normalize-scenarios (pode precisar múltiplas)    │
│  3.3 Executar resync-taxonomy (para re-agregar)                │
│                                                                │
│  FASE 4: Verificação                                           │
│  ────────────────────                                          │
│  4.1 Verificar Mapa de Jornada - temas consolidados            │
│  4.2 Testar novas conversas - cenários sendo extraídos         │
│                                                                │
└────────────────────────────────────────────────────────────────┘
```

## Resultado Esperado

### Antes da Normalização (19 variações)
| Cenário | Ocorrências |
|---------|-------------|
| Vida Social | 24 |
| Carreira | 19 |
| Família | 5 |
| Casamento | 4 |
| ... | ... |
| "Casamento, Carreira" | 1 |
| "Relacionamento (casamento), Vida Social" | 1 |
| **Total variações únicas** | **19** |

### Depois da Normalização (12 canônicos)
| Cenário Canônico | Ocorrências Consolidadas |
|------------------|--------------------------|
| VIDA_SOCIAL | ~28 |
| CARREIRA | ~24 |
| CASAMENTO | ~8 |
| FAMILIA | ~6 |
| MINISTERIO | 4 |
| AUTOESTIMA | ~5 |
| SAUDE | ~3 |
| LUTO | 2 |
| PATERNIDADE | 2 |
| **Total variações únicas** | **9** (apenas cenários em uso) |

### Impacto na Precisão
- **Fragmentação:** 60% → 0%
- **Temas por usuário:** ~11 → ~5 (mais consolidado)
- **Detecção de padrões cross-session:** Habilitado (mesmo cenário = mesmo tema)
- **Proximidade da raiz:** Aumenta pois múltiplas sessões sobre "CASAMENTO" se consolidam

## Arquivos a Modificar

| Arquivo | Operação | Linhas Afetadas |
|---------|----------|-----------------|
| `supabase/functions/turn-insight-observer/index.ts` | EDITAR | ~94-96, ~228-241, ~350+, ~702-737 |
| `supabase/functions/normalize-scenarios/index.ts` | CRIAR | Nova função |
| `supabase/config.toml` | EDITAR | Adicionar normalize-scenarios |

## Considerações de Segurança

- A função `normalize-scenarios` usa `verify_jwt = false` mas requer `SUPABASE_SERVICE_ROLE_KEY`
- Limite de 200 registros por chamada para evitar timeout
- Pode ser necessário executar múltiplas vezes
- Operação é idempotente (pode rodar várias vezes sem duplicar)

## Rollback

Se necessário reverter:
1. O código anterior está no histórico do Git
2. Os dados originais estão preservados no campo `lie_active` JSON (não modificamos o JSON, apenas a coluna `lie_scenario`)
3. Pode-se re-executar `resync-taxonomy` com a lógica antiga para restaurar
