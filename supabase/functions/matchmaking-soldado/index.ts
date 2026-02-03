import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.89.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// ============================================
// TYPES
// ============================================

interface MatchmakingRequest {
  user_id: string;
  session_id: string;
  excluded_soldados?: string[];
  preferred_days?: number[];
  preferred_time_range?: {
    start: string;
    end: string;
  };
  action?: "find" | "reject" | "passive";
  rejection_reason?: RejectionReason;
}

type RejectionReason = 
  | "schedule_mismatch"
  | "not_good_match"
  | "not_ready"
  | "prefer_ai";

type FallbackType = 
  | "generalist"
  | "passive"
  | "ai_only";

interface AvailabilitySlot {
  day_of_week: number;
  day_name: string;
  start_time: string;
  end_time: string;
  is_today: boolean;
  is_tomorrow: boolean;
}

interface SoldadoMatch {
  soldado_id: string;
  display_name: string;
  bio: string | null;
  specialties: string[];
  scenario_match: boolean;
  matrix_match: boolean;
  semantic_score: number;
  total_score: number;
  testimony_excerpt: string;
  available_slots: AvailabilitySlot[];
  testimony_id?: string;
}

interface MatchmakingResponse {
  success: boolean;
  matches: SoldadoMatch[];
  total_candidates: number;
  fallback_type: FallbackType | null;
  suggestion_text: string;
  passive_testimony_id?: string;
  debug?: {
    theme_used: {
      scenario: string | null;
      center: string | null;
      security_matrix: string | null;
    };
    semantic_scores: Record<string, number>;
    availability_filter_removed: number;
  };
}

// ============================================
// HELPERS
// ============================================

const DAY_NAMES = ["Domingo", "Segunda", "Terça", "Quarta", "Quinta", "Sexta", "Sábado"];

function getDayName(dayOfWeek: number): string {
  return DAY_NAMES[dayOfWeek] || "Desconhecido";
}

function isToday(dayOfWeek: number): boolean {
  const now = new Date();
  return now.getDay() === dayOfWeek;
}

function isTomorrow(dayOfWeek: number): boolean {
  const now = new Date();
  return (now.getDay() + 1) % 7 === dayOfWeek;
}

async function generateSimpleEmbedding(text: string): Promise<number[]> {
  const embedding: number[] = [];
  const encoder = new TextEncoder();
  
  for (let i = 0; i < 48; i++) {
    const data = encoder.encode(text + i.toString());
    const hashBuffer = await crypto.subtle.digest("SHA-256", data);
    const hashArray = new Float32Array(hashBuffer);
    
    for (let j = 0; j < 32 && embedding.length < 1536; j++) {
      const val = (hashArray[j % hashArray.length] || 0) / 2147483647;
      embedding.push(Math.max(-1, Math.min(1, val)));
    }
  }
  
  const magnitude = Math.sqrt(embedding.reduce((sum, v) => sum + v * v, 0));
  return embedding.map(v => v / (magnitude || 1));
}

function formatAvailabilitySlots(availability: any[]): AvailabilitySlot[] {
  if (!availability || !Array.isArray(availability)) return [];
  
  return availability.map(slot => ({
    day_of_week: slot.day_of_week,
    day_name: getDayName(slot.day_of_week),
    start_time: slot.start_time,
    end_time: slot.end_time,
    is_today: isToday(slot.day_of_week),
    is_tomorrow: isTomorrow(slot.day_of_week),
  })).sort((a, b) => {
    // Prioritize today, then tomorrow, then by day of week
    if (a.is_today && !b.is_today) return -1;
    if (b.is_today && !a.is_today) return 1;
    if (a.is_tomorrow && !b.is_tomorrow) return -1;
    if (b.is_tomorrow && !a.is_tomorrow) return 1;
    return a.day_of_week - b.day_of_week;
  });
}

// ============================================
// MAIN HANDLER
// ============================================

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    
    if (!supabaseUrl || !supabaseServiceKey) {
      throw new Error("Supabase credentials not configured");
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);
    const body: MatchmakingRequest = await req.json();
    
    const { 
      user_id, 
      session_id, 
      excluded_soldados = [], 
      preferred_days,
      preferred_time_range,
      action = "find",
      rejection_reason,
    } = body;

    if (!user_id || !session_id) {
      return new Response(
        JSON.stringify({ error: "user_id and session_id are required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log(`[Matchmaking] Starting for user ${user_id}, session ${session_id}`);
    console.log(`[Matchmaking] Action: ${action}, excluded: ${excluded_soldados.length}`);

    // ========================================
    // STEP 1: Handle rejection actions
    // ========================================
    
    if (action === "reject" && rejection_reason) {
      return await handleRejection(supabase, session_id, rejection_reason, excluded_soldados);
    }

    // ========================================
    // STEP 2: Get matchmaking state from session
    // ========================================
    
    const { data: session } = await supabase
      .from("chat_sessions")
      .select("matchmaking_state")
      .eq("id", session_id)
      .single();

    const matchmakingState = session?.matchmaking_state || {
      attempts: 0,
      excluded_soldados: [],
      last_suggestion: null,
      mode: "searching",
    };

    // Combine excluded soldados
    const allExcluded = [...new Set([
      ...excluded_soldados,
      ...(matchmakingState.excluded_soldados || []),
    ])];

    // Check if we should stop suggesting (3+ rejections)
    if (matchmakingState.attempts >= 3) {
      console.log("[Matchmaking] Max attempts reached, returning ai_only");
      return new Response(
        JSON.stringify({
          success: true,
          matches: [],
          total_candidates: 0,
          fallback_type: "ai_only",
          suggestion_text: "Entendo que nenhuma sugestão foi ideal. Podemos continuar nossa conversa aqui, e quando você sentir que está pronto, volto a sugerir.",
        } as MatchmakingResponse),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // ========================================
    // STEP 3: Fetch active themes from user
    // ========================================
    
    const { data: themes, error: themesError } = await supabase
      .from("user_themes")
      .select("*")
      .eq("user_id", user_id)
      .in("status", ["active", "in_progress"])
      .order("last_activity_at", { ascending: false })
      .limit(3);

    if (themesError) {
      console.error("[Matchmaking] Error fetching themes:", themesError);
    }

    const dominantTheme = themes?.[0] || null;
    console.log(`[Matchmaking] Found ${themes?.length || 0} active themes`);

    // If no themes, try to find generalist
    if (!dominantTheme) {
      return await findGeneralistFallback(supabase, session_id);
    }

    // ========================================
    // STEP 4: Generate embedding from context
    // ========================================
    
    const contextText = `
      Cenário: ${dominantTheme.scenario || "geral"}
      Centro: ${dominantTheme.center || ""}
      Matriz: ${dominantTheme.security_matrix || ""}
      Mentira: ${dominantTheme.primary_lie?.text || ""}
    `;
    
    const queryEmbedding = await generateSimpleEmbedding(contextText);
    console.log("[Matchmaking] Generated embedding for context");

    // ========================================
    // STEP 5: Search testimonies by similarity
    // ========================================
    
    const { data: testimoniesWithScore, error: searchError } = await supabase.rpc(
      "search_testimonies_by_embedding",
      {
        query_embedding: `[${queryEmbedding.join(",")}]`,
        match_threshold: 0.03,
        match_count: 20,
        exclude_soldados: allExcluded,
      }
    );

    if (searchError) {
      console.error("[Matchmaking] Error searching testimonies:", searchError);
    }

    console.log(`[Matchmaking] Found ${testimoniesWithScore?.length || 0} matching testimonies`);

    // ========================================
    // STEP 6: Fetch soldado profiles with availability
    // ========================================
    
    const soldadoIds = (testimoniesWithScore || []).map((t: any) => t.user_id);
    
    if (soldadoIds.length === 0) {
      return await findGeneralistFallback(supabase, session_id);
    }

    const { data: profiles, error: profilesError } = await supabase
      .from("soldado_profiles")
      .select(`
        id, display_name, bio, specialties, is_available, is_generalist,
        soldado_availability (day_of_week, start_time, end_time)
      `)
      .in("id", soldadoIds)
      .eq("is_available", true);

    if (profilesError) {
      console.error("[Matchmaking] Error fetching profiles:", profilesError);
    }

    console.log(`[Matchmaking] Found ${profiles?.length || 0} available soldado profiles`);

    if (!profiles || profiles.length === 0) {
      return await findGeneralistFallback(supabase, session_id);
    }

    // ========================================
    // STEP 7: Calculate composite scores
    // ========================================
    
    const scoredMatches: SoldadoMatch[] = profiles.map((profile: any) => {
      const testimony = (testimoniesWithScore || []).find((t: any) => t.user_id === profile.id);
      const analysis = testimony?.analysis || {};
      
      const scenarioMatch = analysis.scenario === dominantTheme.scenario;
      const matrixMatch = analysis.security_matrix === dominantTheme.security_matrix;
      const semanticScore = testimony?.similarity || 0;
      const hasAvailability = profile.soldado_availability?.length > 0;
      
      // Calculate availability match with preferred days
      let availabilityBonus = 0;
      if (hasAvailability && preferred_days && preferred_days.length > 0) {
        const matchingDays = profile.soldado_availability.filter(
          (slot: any) => preferred_days.includes(slot.day_of_week)
        );
        availabilityBonus = matchingDays.length > 0 ? 0.1 : 0;
      } else if (hasAvailability) {
        // Check if available today or tomorrow
        const hasTodayOrTomorrow = profile.soldado_availability.some(
          (slot: any) => isToday(slot.day_of_week) || isTomorrow(slot.day_of_week)
        );
        availabilityBonus = hasTodayOrTomorrow ? 0.1 : 0.05;
      }
      
      // Weighted score calculation
      const totalScore = 
        (scenarioMatch ? 0.4 : 0) +
        (matrixMatch ? 0.3 : 0) +
        semanticScore * 0.2 +
        availabilityBonus;

      return {
        soldado_id: profile.id,
        display_name: profile.display_name || "Soldado",
        bio: profile.bio,
        specialties: profile.specialties || [],
        scenario_match: scenarioMatch,
        matrix_match: matrixMatch,
        semantic_score: semanticScore,
        total_score: totalScore,
        testimony_excerpt: testimony?.transcript?.substring(0, 200) || "",
        available_slots: formatAvailabilitySlots(profile.soldado_availability),
        testimony_id: testimony?.id,
      };
    });

    // Sort by total score and take top 3
    const topMatches = scoredMatches
      .sort((a, b) => b.total_score - a.total_score)
      .slice(0, 3);

    console.log(`[Matchmaking] Top match score: ${topMatches[0]?.total_score.toFixed(2)}`);

    // ========================================
    // STEP 8: Build suggestion text
    // ========================================
    
    let suggestionText = "";
    let fallbackType: FallbackType | null = null;

    if (topMatches.length > 0) {
      const bestMatch = topMatches[0];
      const scenarioText = dominantTheme.scenario?.toLowerCase() || "o que você está passando";
      
      if (bestMatch.scenario_match) {
        suggestionText = `Encontrei alguém que passou por algo muito parecido com ${scenarioText}. ${bestMatch.display_name} compartilhou uma jornada que pode ressoar com a sua. Quer conhecer?`;
      } else if (bestMatch.matrix_match) {
        suggestionText = `Há alguém disponível que enfrentou desafios semelhantes. ${bestMatch.display_name} tem uma história que pode te ajudar. Gostaria de saber mais?`;
      } else {
        suggestionText = `Temos um voluntário disponível que pode conversar com você sobre o que está sentindo. ${bestMatch.display_name} está aqui para ouvir. Quer conhecer?`;
      }
    } else {
      return await findGeneralistFallback(supabase, session_id);
    }

    // ========================================
    // STEP 9: Update session state
    // ========================================
    
    await supabase
      .from("chat_sessions")
      .update({
        matchmaking_state: {
          ...matchmakingState,
          attempts: matchmakingState.attempts + 1,
          last_suggestion: topMatches[0]?.soldado_id || null,
          last_suggestion_at: new Date().toISOString(),
          mode: "searching",
        },
      })
      .eq("id", session_id);

    // ========================================
    // STEP 10: Return response
    // ========================================
    
    const response: MatchmakingResponse = {
      success: true,
      matches: topMatches,
      total_candidates: scoredMatches.length,
      fallback_type: fallbackType,
      suggestion_text: suggestionText,
      debug: {
        theme_used: {
          scenario: dominantTheme.scenario,
          center: dominantTheme.center,
          security_matrix: dominantTheme.security_matrix,
        },
        semantic_scores: Object.fromEntries(
          scoredMatches.slice(0, 5).map(m => [m.soldado_id, m.semantic_score])
        ),
        availability_filter_removed: soldadoIds.length - profiles.length,
      },
    };

    console.log(`[Matchmaking] Returning ${topMatches.length} matches`);
    
    return new Response(
      JSON.stringify(response),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error) {
    console.error("[Matchmaking] Error:", error);
    return new Response(
      JSON.stringify({ 
        error: error instanceof Error ? error.message : "Unknown error",
        success: false,
        matches: [],
        total_candidates: 0,
        fallback_type: null,
        suggestion_text: "Desculpe, tive um problema ao buscar sugestões. Por favor, tente novamente.",
      }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});

// ============================================
// FALLBACK HANDLERS
// ============================================

async function findGeneralistFallback(
  supabase: any, 
  sessionId: string
): Promise<Response> {
  console.log("[Matchmaking] Looking for generalist fallback...");
  
  const { data: generalists } = await supabase
    .from("soldado_profiles")
    .select(`
      id, display_name, bio, specialties, is_available,
      soldado_availability (day_of_week, start_time, end_time)
    `)
    .eq("is_generalist", true)
    .eq("is_available", true)
    .limit(1);

  if (generalists && generalists.length > 0) {
    const generalist = generalists[0];
    console.log("[Matchmaking] Found generalist:", generalist.id);
    
    const response: MatchmakingResponse = {
      success: true,
      matches: [{
        soldado_id: generalist.id,
        display_name: generalist.display_name || "Voluntário",
        bio: generalist.bio,
        specialties: generalist.specialties || [],
        scenario_match: false,
        matrix_match: false,
        semantic_score: 0,
        total_score: 0.3, // Base score for generalist
        testimony_excerpt: "",
        available_slots: formatAvailabilitySlots(generalist.soldado_availability),
      }],
      total_candidates: 1,
      fallback_type: "generalist",
      suggestion_text: "Temos um voluntário disponível para conversar com você. Mesmo sem uma experiência idêntica, ele está preparado para ouvir e apoiar. Gostaria de conhecê-lo?",
    };
    
    return new Response(
      JSON.stringify(response),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }

  // No generalist available - suggest passive content
  console.log("[Matchmaking] No generalist found, suggesting passive content");
  
  const response: MatchmakingResponse = {
    success: true,
    matches: [],
    total_candidates: 0,
    fallback_type: "passive",
    suggestion_text: "No momento, não temos um voluntário disponível. Mas posso compartilhar um testemunho de alguém que passou por algo parecido. Gostaria de ouvir?",
  };

  return new Response(
    JSON.stringify(response),
    { headers: { ...corsHeaders, "Content-Type": "application/json" } }
  );
}

async function handleRejection(
  supabase: any,
  sessionId: string,
  reason: RejectionReason,
  excludedSoldados: string[]
): Promise<Response> {
  console.log(`[Matchmaking] Handling rejection: ${reason}`);
  
  // Get current state
  const { data: session } = await supabase
    .from("chat_sessions")
    .select("matchmaking_state")
    .eq("id", sessionId)
    .single();

  const currentState = session?.matchmaking_state || {};
  const lastSuggestion = currentState.last_suggestion;
  
  let newState = { ...currentState };
  let response: MatchmakingResponse;

  switch (reason) {
    case "schedule_mismatch":
      // Keep searching but note the schedule issue
      newState.mode = "searching";
      if (lastSuggestion) {
        newState.excluded_soldados = [
          ...(newState.excluded_soldados || []),
          lastSuggestion,
        ];
      }
      response = {
        success: true,
        matches: [],
        total_candidates: 0,
        fallback_type: null,
        suggestion_text: "Entendi! Vou buscar alguém com horários mais compatíveis. Você tem preferência de dias ou horários?",
      };
      break;

    case "not_good_match":
      // Exclude soldado and continue searching
      newState.attempts = (newState.attempts || 0) + 1;
      if (lastSuggestion) {
        newState.excluded_soldados = [
          ...(newState.excluded_soldados || []),
          lastSuggestion,
        ];
      }
      
      if (newState.attempts >= 3) {
        newState.mode = "ai_only";
        response = {
          success: true,
          matches: [],
          total_candidates: 0,
          fallback_type: "ai_only",
          suggestion_text: "Entendo que nenhuma sugestão foi ideal. Podemos continuar nossa conversa aqui, e quando você sentir que está pronto, volto a sugerir.",
        };
      } else {
        newState.mode = "searching";
        response = {
          success: true,
          matches: [],
          total_candidates: 0,
          fallback_type: null,
          suggestion_text: "Vou procurar outra pessoa que possa ser mais compatível com sua jornada.",
        };
      }
      break;

    case "not_ready":
      // Offer passive content
      newState.mode = "passive";
      response = {
        success: true,
        matches: [],
        total_candidates: 0,
        fallback_type: "passive",
        suggestion_text: "Tudo bem, no seu tempo. Se quiser, posso compartilhar um testemunho de alguém que passou por algo parecido, para você apenas ouvir. Sem compromisso de conversar.",
      };
      break;

    case "prefer_ai":
      // Stay in AI-only mode
      newState.mode = "ai_only";
      response = {
        success: true,
        matches: [],
        total_candidates: 0,
        fallback_type: "ai_only",
        suggestion_text: "Claro, podemos continuar conversando aqui. Estou com você. Quando sentir que está pronto para uma conexão humana, é só me dizer.",
      };
      break;

    default:
      response = {
        success: true,
        matches: [],
        total_candidates: 0,
        fallback_type: null,
        suggestion_text: "Entendi. Vamos continuar nossa conversa.",
      };
  }

  // Update session state
  await supabase
    .from("chat_sessions")
    .update({ matchmaking_state: newState })
    .eq("id", sessionId);

  return new Response(
    JSON.stringify(response),
    { headers: { ...corsHeaders, "Content-Type": "application/json" } }
  );
}
