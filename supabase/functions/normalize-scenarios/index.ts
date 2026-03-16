import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.89.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

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
  'FILHOS': 'PATERNIDADE',
  'EXISTENCIAL': 'AUTOESTIMA',
  'GERAL': 'AUTOESTIMA',
  'VIDA SOCIAL': 'VIDA_SOCIAL',
  'VIDA_PESSOAL': 'AUTOESTIMA',
  // Novas variações detectadas nos dados
  'FAMÍLIA': 'FAMILIA',
  'MINISTÉRIO': 'MINISTERIO',
  'INFÂNCIA': 'FAMILIA',
  'INFANCIA': 'FAMILIA',
  'FUTURO': 'CARREIRA',
  'AJUDAR': 'MINISTERIO',
  'COACHING': 'MINISTERIO',
  'COMUNICAÇÃO': 'VIDA_SOCIAL',
  'COMUNICACAO': 'VIDA_SOCIAL',
  'INTERPESSOAL': 'VIDA_SOCIAL',
  'RELACIONAMENTO_DE_AJUDA': 'MINISTERIO',
  'AJUDA_ESPIRITUAL': 'MINISTERIO',
  'RELACIONAMENTO_COM_FILHO': 'PATERNIDADE',
};

// Função para normalizar cenário
function normalizeScenario(rawScenario: string | undefined | null): string | null {
  if (!rawScenario || typeof rawScenario !== 'string') return null;
  
  // Limpar e uppercase
  let scenario = rawScenario.trim().toUpperCase().replace(/[\-\s]+/g, '_');
  
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
    const parts = rawScenario.split(separators).map(p => p.trim().toUpperCase().replace(/[\-\s]+/g, '_'));
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
    'FINANC': 'FINANCAS',
    'DINHEIR': 'FINANCAS',
    'MINISTER': 'MINISTERIO',
    'IGREJA': 'MINISTERIO',
    'LUTO': 'LUTO',
    'MORT': 'LUTO',
    'SEXUAL': 'SEXUALIDADE',
    'PATERN': 'PATERNIDADE',
    'MATERN': 'MATERNIDADE',
    'FILHO': 'PATERNIDADE',
    'AJUD': 'MINISTERIO',
    'COACH': 'MINISTERIO',
    'FUTUR': 'CARREIRA',
    'INFAN': 'FAMILIA',
    'COMUNICA': 'VIDA_SOCIAL',
    'INTERPES': 'VIDA_SOCIAL',
    'ESPIRIT': 'MINISTERIO',
  };
  
  for (const [keyword, canonical] of Object.entries(keywords)) {
    if (scenario.includes(keyword)) {
      return canonical;
    }
  }
  
  return null;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const supabase = createClient(supabaseUrl, supabaseKey);

  console.log("=== NORMALIZE SCENARIOS START ===");

  try {
    const body = await req.json().catch(() => ({}));
    const batchSize = body.batch_size || 200;
    const dryRun = body.dry_run === true;

    console.log(`Batch size: ${batchSize}, Dry run: ${dryRun}`);

    // 1. Buscar todos os turn_insights com lie_scenario
    const { data: insights, error: insightsError } = await supabase
      .from("turn_insights")
      .select("id, lie_scenario")
      .not("lie_scenario", "is", null)
      .limit(batchSize);

    if (insightsError) {
      throw insightsError;
    }

    let insightsNormalized = 0;
    let insightsUnchanged = 0;
    let insightsFailed = 0;
    const mappings: Record<string, string> = {};

    for (const insight of insights || []) {
      const current = insight.lie_scenario;
      const canonical = normalizeScenario(current);
      
      if (canonical && canonical !== current) {
        if (!dryRun) {
          const { error } = await supabase
            .from("turn_insights")
            .update({ lie_scenario: canonical })
            .eq("id", insight.id);
          
          if (error) {
            console.error(`Failed to update insight ${insight.id}:`, error);
            insightsFailed++;
            continue;
          }
        }
        
        insightsNormalized++;
        if (!mappings[current]) {
          mappings[current] = canonical;
        }
      } else if (canonical) {
        insightsUnchanged++;
      } else {
        console.log(`Could not normalize: "${current}"`);
        insightsFailed++;
      }
    }

    console.log(`Insights: ${insightsNormalized} normalized, ${insightsUnchanged} unchanged, ${insightsFailed} failed`);

    // 2. PRIMEIRO: Consolidar temas duplicados que terão o mesmo cenário após normalização
    // Isso evita conflitos de unique constraint
    console.log("Starting theme consolidation before normalization...");

    const { data: allThemesForConsolidation, error: consolidationFetchError } = await supabase
      .from("user_themes")
      .select("id, user_id, scenario, security_matrix, turn_count, avg_score, total_shifts, session_ids, created_at, theme_label, primary_lie, target_truth, current_phase")
      .order("created_at", { ascending: true })
      .limit(500);

    if (consolidationFetchError) {
      throw consolidationFetchError;
    }

    // Agrupar por user_id + cenário NORMALIZADO + security_matrix
    const normalizationGroups: Record<string, typeof allThemesForConsolidation> = {};
    for (const theme of allThemesForConsolidation || []) {
      const normalizedScenario = normalizeScenario(theme.scenario) || theme.scenario;
      const key = `${theme.user_id}|${normalizedScenario}|${theme.security_matrix}`;
      if (!normalizationGroups[key]) {
        normalizationGroups[key] = [];
      }
      normalizationGroups[key].push(theme);
    }

    let themesConsolidated = 0;
    let themesDeletedForConsolidation = 0;

    for (const [key, duplicates] of Object.entries(normalizationGroups)) {
      if (duplicates.length <= 1) continue;

      const normalizedScenario = normalizeScenario(duplicates[0].scenario) || duplicates[0].scenario;
      console.log(`Consolidating ${duplicates.length} themes for ${key} -> ${normalizedScenario}`);

      // O primeiro (mais antigo) será o principal
      const primary = duplicates[0];
      const toMerge = duplicates.slice(1);

      // Calcular valores agregados
      let totalTurnCount = primary.turn_count || 0;
      let totalShifts = primary.total_shifts || 0;
      let scoreSum = (primary.avg_score || 0) * (primary.turn_count || 1);
      let allSessionIds = [...(primary.session_ids || [])];

      for (const dup of toMerge) {
        totalTurnCount += dup.turn_count || 0;
        totalShifts += dup.total_shifts || 0;
        scoreSum += (dup.avg_score || 0) * (dup.turn_count || 1);
        allSessionIds = [...allSessionIds, ...(dup.session_ids || [])];
      }

      const newAvgScore = totalTurnCount > 0 ? scoreSum / totalTurnCount : 0;
      const uniqueSessionIds = [...new Set(allSessionIds)];

      if (!dryRun) {
        // Primeiro deletar duplicatas para evitar conflito
        for (const dup of toMerge) {
          const { error: deleteError } = await supabase
            .from("user_themes")
            .delete()
            .eq("id", dup.id);

          if (deleteError) {
            console.error(`Failed to delete duplicate theme ${dup.id}:`, deleteError);
          } else {
            themesDeletedForConsolidation++;
          }
        }

        // Agora atualizar o tema principal com valores consolidados E cenário normalizado
        const { error: updateError } = await supabase
          .from("user_themes")
          .update({
            scenario: normalizedScenario,
            turn_count: totalTurnCount,
            total_shifts: totalShifts,
            avg_score: Math.round(newAvgScore * 100) / 100,
            session_ids: uniqueSessionIds,
            updated_at: new Date().toISOString(),
          })
          .eq("id", primary.id);

        if (updateError) {
          console.error(`Failed to update primary theme ${primary.id}:`, updateError);
        } else {
          themesConsolidated++;
        }
      } else {
        themesConsolidated++;
        themesDeletedForConsolidation += toMerge.length;
      }
    }

    console.log(`Consolidation: ${themesConsolidated} groups merged, ${themesDeletedForConsolidation} themes deleted`);

    // 3. Agora normalizar os temas restantes (que não tinham duplicatas)
    const { data: remainingThemes, error: themesError } = await supabase
      .from("user_themes")
      .select("id, scenario, user_id, security_matrix")
      .limit(batchSize);

    if (themesError) {
      throw themesError;
    }

    let themesNormalized = 0;
    let themesUnchanged = 0;
    let themesFailed = 0;

    for (const theme of remainingThemes || []) {
      const current = theme.scenario;
      const canonical = normalizeScenario(current);
      
      if (canonical && canonical !== current) {
        if (!dryRun) {
          const { error } = await supabase
            .from("user_themes")
            .update({ scenario: canonical })
            .eq("id", theme.id);
          
          if (error) {
            console.error(`Failed to update theme ${theme.id}:`, error);
            themesFailed++;
            continue;
          }
        }
        
        themesNormalized++;
      } else if (canonical) {
        themesUnchanged++;
      } else {
        console.log(`Could not normalize theme scenario: "${current}"`);
        themesFailed++;
      }
    }

    console.log(`Themes: ${themesNormalized} normalized, ${themesUnchanged} unchanged, ${themesFailed} failed`);

    console.log("=== NORMALIZE SCENARIOS COMPLETE ===");

    return new Response(
      JSON.stringify({
        status: "completed",
        dry_run: dryRun,
        insights: {
          total: insights?.length || 0,
          normalized: insightsNormalized,
          unchanged: insightsUnchanged,
          failed: insightsFailed,
          mappings,
        },
        themes: {
          total: remainingThemes?.length || 0,
          normalized: themesNormalized,
          unchanged: themesUnchanged,
          failed: themesFailed,
        },
        consolidation: {
          groups_merged: themesConsolidated,
          themes_deleted: themesDeletedForConsolidation,
        },
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error) {
    console.error("Normalize error:", error);
    return new Response(
      JSON.stringify({ 
        error: error instanceof Error ? error.message : "Unknown error",
        status: "failed",
      }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
