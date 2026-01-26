
# Plano de Correção Sistemática: Sanitização de Taxonomia ZION

## Diagnóstico Confirmado

### Problema Raiz
A função `turn-insight-observer` usa constantes de validação **incompatíveis** com os valores que o próprio prompt instrui o LLM a extrair:

| Campo | Prompt Instrui | Código Valida | Resultado |
|-------|---------------|---------------|-----------|
| `center` | `INSTINTIVO`, `EMOCIONAL`, `MENTAL` | `MENTE`, `CORACAO`, `INSTINTO` | **NULL** |
| `security_matrix` | `SOBREVIVENCIA`, `IDENTIDADE`, `CAPACIDADE` | `SELF`, `OTHERS`, `WORLD`, `GOD` | **NULL** |
| `scenario` | Tagging livre (Casamento, Carreira, etc.) | `AUTONOMIA`, `CONEXAO`, `SEGURANCA` | **NULL** |

### Impacto Quantificado
| Métrica | Valor |
|---------|-------|
| Total de insights | 179 |
| Com `lie_active` no JSON | 129 |
| Perdidos na sanitização | **52 (40%)** |
| Usuários invisíveis no Mapa | 3 (Priscilla, Saulo, outros) |

### Valores Reais Extraídos pelo LLM
```text
Centers:     EMOCIONAL (51x), MENTAL (22x), INSTINTIVO (7x)
Matrices:    IDENTIDADE (63x), CAPACIDADE (22x), SOBREVIVENCIA (1x)
Scenarios:   Vida Social (23x), Carreira (14x), Família (4x), Casamento (6x), etc.
```

---

## Arquitetura da Correção

```text
┌──────────────────────────────────────────────────────────────────────────────┐
│                           CORREÇÃO EM 3 FASES                                │
├──────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  FASE 1: Corrigir Constantes de Validação                                    │
│  ────────────────────────────────────────                                    │
│  • Atualizar VALID_CENTERS para valores corretos                             │
│  • Atualizar VALID_SECURITY_MATRICES para valores corretos                   │
│  • Remover restrição de VALID_SCENARIOS (permitir tagging livre)             │
│                                                                              │
│  FASE 2: Ajustar Condição de Disparo do Aggregator                           │
│  ────────────────────────────────────────────────                            │
│  • Alterar condição de (lieSecurityMatrix AND lieScenario)                   │
│    para apenas (lieSecurityMatrix) - cenário é secundário                    │
│                                                                              │
│  FASE 3: Criar Script de Re-Sincronização                                    │
│  ───────────────────────────────────────                                     │
│  • Criar edge function para reprocessar insights existentes                  │
│  • Extrair valores do JSON lie_active → colunas de tabela                    │
│  • Disparar aggregate-user-journey para cada insight recuperado              │
│                                                                              │
└──────────────────────────────────────────────────────────────────────────────┘
```

---

## Fase 1: Corrigir Constantes de Validação

### Arquivo: `supabase/functions/turn-insight-observer/index.ts`

### Localização Exata: Linhas 702-713

**ANTES (Código Incorreto):**
```typescript
// Valid values for CHECK constraints - sanitize "N/A", empty strings, or invalid values to null
const VALID_CENTERS = ['MENTE', 'CORACAO', 'INSTINTO'];
const VALID_SCENARIOS = ['AUTONOMIA', 'CONEXAO', 'SEGURANCA'];
const VALID_SECURITY_MATRICES = ['SELF', 'OTHERS', 'WORLD', 'GOD'];

const rawScenario = lieActive.scenario;
const rawCenter = lieActive.center;
const rawSecurityMatrix = lieActive.security_matrix;

// Sanitize: only accept valid enum values, otherwise null
const lieScenario = (rawScenario && VALID_SCENARIOS.includes(rawScenario)) ? rawScenario : null;
const lieCenter = (rawCenter && VALID_CENTERS.includes(rawCenter)) ? rawCenter : null;
const lieSecurityMatrix = (rawSecurityMatrix && VALID_SECURITY_MATRICES.includes(rawSecurityMatrix)) ? rawSecurityMatrix : null;
```

**DEPOIS (Código Corrigido):**
```typescript
// ============================================
// VALID VALUES FOR ZION TAXONOMY
// Must match exactly what the LLM is instructed to extract in OBSERVER_SYSTEM_PROMPT
// ============================================

// Centers (Como o usuário reage) - Linhas 98-101 do prompt
const VALID_CENTERS = ['INSTINTIVO', 'EMOCIONAL', 'MENTAL'];

// Security Matrix (Raiz teológica) - Linhas 103-117 do prompt  
const VALID_SECURITY_MATRICES = ['SOBREVIVENCIA', 'IDENTIDADE', 'CAPACIDADE'];

// Scenarios: Tagging Livre - NÃO RESTRINGIR
// O prompt (linhas 94-96) permite qualquer cenário: Casamento, Carreira, Família, etc.
// Apenas sanitizar strings vazias ou "N/A"

const rawScenario = lieActive.scenario;
const rawCenter = lieActive.center;
const rawSecurityMatrix = lieActive.security_matrix;

// Sanitize center: must be one of the 3 valid values
const lieCenter = (rawCenter && VALID_CENTERS.includes(rawCenter.toUpperCase())) 
  ? rawCenter.toUpperCase() 
  : null;

// Sanitize security_matrix: must be one of the 3 valid values
const lieSecurityMatrix = (rawSecurityMatrix && VALID_SECURITY_MATRICES.includes(rawSecurityMatrix.toUpperCase())) 
  ? rawSecurityMatrix.toUpperCase() 
  : null;

// Sanitize scenario: allow any non-empty string (tagging livre)
// Only reject empty strings, "N/A", null, or undefined
const lieScenario = (rawScenario && 
  typeof rawScenario === 'string' && 
  rawScenario.trim() !== '' && 
  rawScenario.toUpperCase() !== 'N/A')
  ? rawScenario.trim()
  : null;
```

---

## Fase 2: Ajustar Condição de Disparo

### Arquivo: `supabase/functions/turn-insight-observer/index.ts`

### Localização Exata: Linha 763

**ANTES:**
```typescript
// Call aggregate-user-journey if we have taxonomy data and a user
if (userId && lieSecurityMatrix && lieScenario) {
```

**DEPOIS:**
```typescript
// Call aggregate-user-journey if we have taxonomy data and a user
// Cenário é secundário - basta ter security_matrix para agregar
if (userId && lieSecurityMatrix) {
```

**Justificativa:** O `security_matrix` é o campo mais crítico para a jornada teológica. O `scenario` é contexto adicional, mas não deve bloquear a agregação.

---

## Fase 3: Script de Re-Sincronização

### Nova Edge Function: `supabase/functions/resync-taxonomy/index.ts`

Esta função irá:
1. Buscar todos os insights onde `lie_active` tem dados mas as colunas estão NULL
2. Extrair valores do JSON e aplicar a nova sanitização
3. Atualizar as colunas da tabela
4. Disparar `aggregate-user-journey` para cada insight recuperado

```typescript
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.89.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Mesmos valores corrigidos do turn-insight-observer
const VALID_CENTERS = ['INSTINTIVO', 'EMOCIONAL', 'MENTAL'];
const VALID_SECURITY_MATRICES = ['SOBREVIVENCIA', 'IDENTIDADE', 'CAPACIDADE'];

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const supabase = createClient(supabaseUrl, supabaseServiceKey);

  console.log("=== RESYNC TAXONOMY START ===");

  // 1. Buscar insights com dados no JSON mas colunas NULL
  const { data: insights, error } = await supabase
    .from("turn_insights")
    .select(`
      id,
      chat_session_id,
      lie_active,
      phase,
      phase_confidence,
      shift_detected,
      overall_score,
      truth_target,
      chat_sessions!inner(user_id)
    `)
    .not("lie_active", "eq", "{}")
    .is("lie_security_matrix", null)
    .limit(100);

  if (error) {
    console.error("Query error:", error);
    return new Response(JSON.stringify({ error: error.message }), { 
      status: 500, 
      headers: { ...corsHeaders, "Content-Type": "application/json" } 
    });
  }

  console.log(`Found ${insights?.length || 0} insights to resync`);

  let updated = 0;
  let aggregated = 0;
  const errors: string[] = [];

  for (const insight of insights || []) {
    try {
      const lieActive = insight.lie_active || {};
      const userId = (insight.chat_sessions as any)?.user_id;

      // Aplicar nova sanitização
      const rawCenter = lieActive.center;
      const rawMatrix = lieActive.security_matrix;
      const rawScenario = lieActive.scenario;

      const lieCenter = (rawCenter && VALID_CENTERS.includes(rawCenter.toUpperCase())) 
        ? rawCenter.toUpperCase() : null;
      
      const lieSecurityMatrix = (rawMatrix && VALID_SECURITY_MATRICES.includes(rawMatrix.toUpperCase())) 
        ? rawMatrix.toUpperCase() : null;
      
      const lieScenario = (rawScenario && rawScenario.trim() && rawScenario.toUpperCase() !== 'N/A')
        ? rawScenario.trim() : null;

      // Só atualizar se conseguimos extrair pelo menos security_matrix
      if (!lieSecurityMatrix) {
        console.log(`Insight ${insight.id}: No valid security_matrix in JSON, skipping`);
        continue;
      }

      // 2. Atualizar colunas
      const { error: updateError } = await supabase
        .from("turn_insights")
        .update({
          lie_center: lieCenter,
          lie_security_matrix: lieSecurityMatrix,
          lie_scenario: lieScenario,
        })
        .eq("id", insight.id);

      if (updateError) {
        errors.push(`Update ${insight.id}: ${updateError.message}`);
        continue;
      }

      updated++;

      // 3. Disparar aggregate-user-journey se temos user
      if (userId && lieSecurityMatrix) {
        const aggregateResponse = await fetch(
          `${supabaseUrl}/functions/v1/aggregate-user-journey`,
          {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              "Authorization": `Bearer ${supabaseServiceKey}`,
            },
            body: JSON.stringify({
              user_id: userId,
              session_id: insight.chat_session_id,
              insight_id: insight.id,
              lie_active: lieActive,
              phase: insight.phase,
              phase_confidence: insight.phase_confidence,
              shift_detected: insight.shift_detected || false,
              overall_score: insight.overall_score,
              truth_target: insight.truth_target || {},
            }),
          }
        );

        if (aggregateResponse.ok) {
          aggregated++;
        } else {
          console.error(`Aggregate failed for ${insight.id}`);
        }
      }
    } catch (err) {
      errors.push(`Insight ${insight.id}: ${err}`);
    }
  }

  console.log("=== RESYNC COMPLETE ===");
  console.log(`Updated: ${updated}, Aggregated: ${aggregated}, Errors: ${errors.length}`);

  return new Response(
    JSON.stringify({
      status: "completed",
      found: insights?.length || 0,
      updated,
      aggregated,
      errors: errors.slice(0, 10), // Primeiros 10 erros
    }),
    { headers: { ...corsHeaders, "Content-Type": "application/json" } }
  );
});
```

---

## Configuração da Nova Edge Function

### Arquivo: `supabase/config.toml`

Adicionar ao final do arquivo:
```toml
[functions.resync-taxonomy]
verify_jwt = false
```

---

## Sequência de Execução

```text
┌────────────────────────────────────────────────────────────────┐
│                    ORDEM DE IMPLEMENTAÇÃO                      │
├────────────────────────────────────────────────────────────────┤
│                                                                │
│  1. ✏️  Editar turn-insight-observer                           │
│     └── Corrigir VALID_CENTERS, VALID_SECURITY_MATRICES        │
│     └── Remover restrição de VALID_SCENARIOS                   │
│     └── Ajustar condição do aggregate (linha 763)              │
│                                                                │
│  2. 🆕 Criar resync-taxonomy                                   │
│     └── Nova edge function para reprocessar dados existentes   │
│                                                                │
│  3. 📝 Atualizar config.toml                                   │
│     └── Adicionar entrada para resync-taxonomy                 │
│                                                                │
│  4. 🚀 Deploy das funções                                      │
│     └── Deploy automático pelo Lovable                         │
│                                                                │
│  5. ▶️  Executar resync-taxonomy                                │
│     └── Chamar via curl/ferramenta para reprocessar            │
│     └── Pode precisar chamar múltiplas vezes (limite 100)      │
│                                                                │
│  6. ✅ Verificar resultados                                     │
│     └── Confirmar que usuários aparecem no Mapa de Jornada     │
│                                                                │
└────────────────────────────────────────────────────────────────┘
```

---

## Resultado Esperado

### Antes da Correção
| Usuário | Insights | Com Matriz | Temas |
|---------|----------|------------|-------|
| Priscilla | 53 | 0 | 0 |
| Sandro (sandbox) | 13 | 0 | 0 |
| Contato | 2 | 0 | 0 |

### Depois da Correção
| Usuário | Insights | Com Matriz | Temas |
|---------|----------|------------|-------|
| Priscilla | 53 | ~40+ | ~5+ |
| Sandro (sandbox) | 13 | ~10+ | ~3+ |
| Contato | 2 | ~1+ | ~1+ |

---

## Arquivos a Modificar

| Arquivo | Operação | Descrição |
|---------|----------|-----------|
| `supabase/functions/turn-insight-observer/index.ts` | EDITAR | Linhas 702-713, 763 |
| `supabase/functions/resync-taxonomy/index.ts` | CRIAR | Nova função de re-sincronização |
| `supabase/config.toml` | EDITAR | Adicionar entrada para resync-taxonomy |

---

## Seção Técnica: Detalhes de Implementação

### Mapeamento de Valores (Referência Cruzada)

```text
PROMPT (Linhas 98-101)              →  VALID_CENTERS
├── INSTINTIVO                      →  ✓ INSTINTIVO
├── EMOCIONAL                       →  ✓ EMOCIONAL
└── MENTAL                          →  ✓ MENTAL

PROMPT (Linhas 103-117)             →  VALID_SECURITY_MATRICES
├── SOBREVIVENCIA                   →  ✓ SOBREVIVENCIA
├── IDENTIDADE                      →  ✓ IDENTIDADE
└── CAPACIDADE                      →  ✓ CAPACIDADE

PROMPT (Linhas 94-96)               →  VALID_SCENARIOS
├── Casamento                       →  ✓ (tagging livre)
├── Carreira                        →  ✓ (tagging livre)
├── Família                         →  ✓ (tagging livre)
└── [qualquer outro]                →  ✓ (tagging livre)
```

### Considerações de Segurança
- A função `resync-taxonomy` usa `verify_jwt = false` mas requer `SUPABASE_SERVICE_ROLE_KEY`
- Limite de 100 insights por chamada para evitar timeout
- Pode ser necessário executar múltiplas vezes até zerar o backlog
