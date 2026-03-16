import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.89.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

// ============================================================
// HARD RULES — Pure functions for each phase
// ============================================================

interface CriteriaResult {
  met: boolean;
  details: string;
}

interface Session {
  id: string;
  session_date: string;
  completed: boolean;
  escala_clareza: number | null;
  escala_regulacao: number | null;
  escala_identidade: number | null;
  escala_constancia: number | null;
  escala_vitalidade: number | null;
  escala_agencia: number | null;
  escala_autonomia: number | null;
  phase_at_session: number;
}

function evaluatePhase1(sessions: Session[]): CriteriaResult {
  // clareza >= 6 por 3 dias CONSECUTIVOS (mais recentes)
  const completed = sessions
    .filter((s) => s.completed && s.escala_clareza !== null)
    .sort((a, b) => b.session_date.localeCompare(a.session_date));

  if (completed.length < 3) {
    return {
      met: false,
      details: `Necessário 3 sessões com clareza >= 6. Completadas: ${completed.length}`,
    };
  }

  const last3 = completed.slice(0, 3);
  const allMet = last3.every((s) => (s.escala_clareza ?? 0) >= 6);
  const values = last3.map((s) => s.escala_clareza);

  if (allMet) {
    return {
      met: true,
      details: `Clareza >= 6 por 3 dias consecutivos: [${values.join(", ")}]`,
    };
  }
  return {
    met: false,
    details: `Clareza nas últimas 3 sessões: [${values.join(", ")}]. Necessário >= 6 em todas.`,
  };
}

function evaluatePhase2(
  currentSessions: Session[],
  phase1Sessions: Session[]
): CriteriaResult {
  // regulacao melhorou >= 30% vs média da Fase 1
  // Fallback: regulacao >= 6 por 3 dias se sem histórico fase 1
  const currentCompleted = currentSessions.filter(
    (s) => s.completed && s.escala_regulacao !== null
  );
  const phase1Completed = phase1Sessions.filter(
    (s) => s.completed && s.escala_regulacao !== null
  );

  if (currentCompleted.length < 3) {
    return {
      met: false,
      details: `Necessário pelo menos 3 sessões na Fase 2. Completadas: ${currentCompleted.length}`,
    };
  }

  if (phase1Completed.length === 0) {
    // Fallback: threshold absoluto
    const sorted = currentCompleted.sort((a, b) =>
      b.session_date.localeCompare(a.session_date)
    );
    const last3 = sorted.slice(0, 3);
    const allMet = last3.every((s) => (s.escala_regulacao ?? 0) >= 6);
    const values = last3.map((s) => s.escala_regulacao);
    return {
      met: allMet,
      details: allMet
        ? `Regulação >= 6 por 3 dias (fallback sem histórico F1): [${values.join(", ")}]`
        : `Regulação nas últimas 3 sessões: [${values.join(", ")}]. Necessário >= 6 (fallback).`,
    };
  }

  const avgPhase1 =
    phase1Completed.reduce((sum, s) => sum + (s.escala_regulacao ?? 0), 0) /
    phase1Completed.length;
  const avgPhase2 =
    currentCompleted.reduce((sum, s) => sum + (s.escala_regulacao ?? 0), 0) /
    currentCompleted.length;
  const improvement = avgPhase1 > 0 ? avgPhase2 / avgPhase1 : 0;
  const met = improvement >= 1.3;

  return {
    met,
    details: met
      ? `Regulação melhorou ${((improvement - 1) * 100).toFixed(0)}% (F1: ${avgPhase1.toFixed(1)}, F2: ${avgPhase2.toFixed(1)})`
      : `Regulação: F1 média ${avgPhase1.toFixed(1)}, F2 média ${avgPhase2.toFixed(1)}. Necessário +30%.`,
  };
}

function evaluatePhase3(
  sessions: Session[],
  phaseCriteriaMet: Record<string, unknown>
): CriteriaResult {
  // Campos de identidade preenchidos + clareza >= 7 nas últimas 3 sessões
  const requiredFields = [
    "crenca_mae",
    "medo_dominante",
    "vergonha_central",
    "virtude_ferida",
    "cenario",
    "centro",
  ];
  const filledFields = requiredFields.filter(
    (f) =>
      phaseCriteriaMet[f] !== undefined &&
      phaseCriteriaMet[f] !== null &&
      phaseCriteriaMet[f] !== ""
  );
  const fieldsComplete = filledFields.length === requiredFields.length;
  const missingFields = requiredFields.filter(
    (f) => !filledFields.includes(f)
  );

  const completed = sessions
    .filter((s) => s.completed && s.escala_clareza !== null)
    .sort((a, b) => b.session_date.localeCompare(a.session_date));

  let clarezaMet = false;
  let clarezaDetail = "";
  if (completed.length >= 3) {
    const last3 = completed.slice(0, 3);
    const avg =
      last3.reduce((sum, s) => sum + (s.escala_clareza ?? 0), 0) / 3;
    clarezaMet = avg >= 7;
    clarezaDetail = `Média clareza últimas 3: ${avg.toFixed(1)}`;
  } else {
    clarezaDetail = `Sessões insuficientes para clareza (${completed.length}/3)`;
  }

  const met = fieldsComplete && clarezaMet;
  return {
    met,
    details: met
      ? `Identidade completa + ${clarezaDetail}`
      : `Campos: ${filledFields.length}/${requiredFields.length} (faltam: ${missingFields.join(", ") || "nenhum"}). ${clarezaDetail}.`,
  };
}

function evaluatePhase4(streakCurrent: number): CriteriaResult {
  const met = streakCurrent >= 5;
  return {
    met,
    details: met
      ? `Streak de ${streakCurrent} dias (necessário: 5)`
      : `Streak atual: ${streakCurrent}/5 dias consecutivos`,
  };
}

function evaluatePhase5(sessions: Session[]): CriteriaResult {
  // vitalidade >= 6 por 5 dias
  const completed = sessions
    .filter((s) => s.completed && s.escala_vitalidade !== null)
    .sort((a, b) => b.session_date.localeCompare(a.session_date));

  if (completed.length < 5) {
    return {
      met: false,
      details: `Necessário 5 sessões com vitalidade >= 6. Completadas: ${completed.length}`,
    };
  }

  const last5 = completed.slice(0, 5);
  const allMet = last5.every((s) => (s.escala_vitalidade ?? 0) >= 6);
  const values = last5.map((s) => s.escala_vitalidade);

  return {
    met: allMet,
    details: allMet
      ? `Vitalidade >= 6 por 5 dias: [${values.join(", ")}]`
      : `Vitalidade últimas 5 sessões: [${values.join(", ")}]. Necessário >= 6 em todas.`,
  };
}

function evaluatePhase6(
  phaseCriteriaMet: Record<string, unknown>
): CriteriaResult {
  const areasComPlano = Array.isArray(phaseCriteriaMet.areas_com_plano)
    ? phaseCriteriaMet.areas_com_plano
    : [];
  const acaoExecutada = phaseCriteriaMet.acao_executada === true;
  const met = areasComPlano.length >= 3 && acaoExecutada;

  return {
    met,
    details: met
      ? `Plano em ${areasComPlano.length} áreas + ação executada`
      : `Áreas com plano: ${areasComPlano.length}/3. Ação executada: ${acaoExecutada ? "sim" : "não"}.`,
  };
}

function evaluatePhase7(sessions: Session[]): CriteriaResult {
  // autonomia >= 7 (manutenção) nas últimas 5 sessões
  const completed = sessions
    .filter((s) => s.completed && s.escala_autonomia !== null)
    .sort((a, b) => b.session_date.localeCompare(a.session_date));

  if (completed.length < 5) {
    return {
      met: true, // Fase 7 é manutenção — se não há dados suficientes, manter
      details: `Manutenção — sessões insuficientes para avaliar regressão (${completed.length}/5)`,
    };
  }

  const last5 = completed.slice(0, 5);
  const avg =
    last5.reduce((sum, s) => sum + (s.escala_autonomia ?? 0), 0) / 5;
  const met = avg >= 7;

  return {
    met,
    details: met
      ? `Autonomia média ${avg.toFixed(1)} >= 7 (manutenção OK)`
      : `Autonomia média ${avg.toFixed(1)} < 7 — considerar regressão`,
  };
}

// ============================================================
// REGRESSION EVALUATION
// ============================================================

interface RegressionResult {
  shouldRegress: boolean;
  details: string;
  recentIgi: number;
  overallIgi: number;
}

function calculateSessionIgi(s: Session): number {
  const g1Vals = [s.escala_clareza, s.escala_regulacao, s.escala_identidade].filter(
    (v) => v !== null
  ) as number[];
  const g2Vals = [
    s.escala_constancia,
    s.escala_vitalidade,
    s.escala_agencia,
    s.escala_autonomia,
  ].filter((v) => v !== null) as number[];

  if (g1Vals.length === 0 && g2Vals.length === 0) return 0;

  const g1Avg = g1Vals.length > 0 ? g1Vals.reduce((a, b) => a + b, 0) / g1Vals.length : 0;
  const g2Avg = g2Vals.length > 0 ? g2Vals.reduce((a, b) => a + b, 0) / g2Vals.length : 0;

  if (g1Vals.length === 0) return g2Avg;
  if (g2Vals.length === 0) return g1Avg;
  return 0.5 * g1Avg + 0.5 * g2Avg;
}

function evaluateRegression(
  allPhaseSessions: Session[]
): RegressionResult {
  const completed = allPhaseSessions.filter((s) => s.completed);
  if (completed.length < 6) {
    return {
      shouldRegress: false,
      details: `Sessões insuficientes para avaliar regressão (${completed.length}/6 mínimo)`,
      recentIgi: 0,
      overallIgi: 0,
    };
  }

  const sorted = completed.sort((a, b) =>
    b.session_date.localeCompare(a.session_date)
  );
  const recent5 = sorted.slice(0, 5);
  const recentIgi =
    recent5.reduce((sum, s) => sum + calculateSessionIgi(s), 0) / 5;
  const overallIgi =
    completed.reduce((sum, s) => sum + calculateSessionIgi(s), 0) /
    completed.length;

  const threshold = overallIgi * 0.7;
  const shouldRegress = overallIgi > 0 && recentIgi < threshold;

  return {
    shouldRegress,
    details: shouldRegress
      ? `IGI recente ${recentIgi.toFixed(2)} < 70% da média geral ${overallIgi.toFixed(2)} (threshold: ${threshold.toFixed(2)})`
      : `IGI recente ${recentIgi.toFixed(2)} vs média geral ${overallIgi.toFixed(2)} — sem regressão`,
    recentIgi: Math.round(recentIgi * 100) / 100,
    overallIgi: Math.round(overallIgi * 100) / 100,
  };
}

// ============================================================
// OBSERVER SIGNALS
// ============================================================

interface ObserverSignals {
  totalConversations: number;
  shiftsDetected: number;
  avgEmotionIntensity: number;
  unstableCount: number;
  avgOverallScore: number;
  severeIssuesCount: number;
  hasSevereBlock: boolean;
  observerPhase: string | null;
  recentShiftDescriptions: string[];
}

async function fetchObserverSignals(
  supabase: any,
  userId: string,
  lookbackDays = 14
): Promise<ObserverSignals> {
  const since = new Date(Date.now() - lookbackDays * 86400000).toISOString();

  // Step 1: get user's chat session IDs in the lookback window
  const { data: sessionRows } = await supabase
    .from("chat_sessions")
    .select("id")
    .eq("user_id", userId)
    .gte("created_at", since);

  const sessionIds: string[] = (sessionRows || []).map((r: { id: string }) => r.id);

  if (sessionIds.length === 0) {
    return {
      totalConversations: 0,
      shiftsDetected: 0,
      avgEmotionIntensity: 0,
      unstableCount: 0,
      avgOverallScore: 0,
      severeIssuesCount: 0,
      hasSevereBlock: false,
      observerPhase: null,
      recentShiftDescriptions: [],
    };
  }

  // Step 2: fetch turn_insights for those sessions
  const { data: insights } = await supabase
    .from("turn_insights")
    .select(
      "shift_detected, shift_description, emotion_intensity, emotion_stability, overall_score, phase, created_at"
    )
    .in("chat_session_id", sessionIds)
    .gte("created_at", since)
    .order("created_at", { ascending: false });

  const rows = insights || [];
  if (rows.length === 0) {
    return {
      totalConversations: 0,
      shiftsDetected: 0,
      avgEmotionIntensity: 0,
      unstableCount: 0,
      avgOverallScore: 0,
      severeIssuesCount: 0,
      hasSevereBlock: false,
      observerPhase: null,
      recentShiftDescriptions: [],
    };
  }

  let shiftsDetected = 0;
  let emotionSum = 0;
  let emotionCount = 0;
  let unstableCount = 0;
  let scoreSum = 0;
  let scoreCount = 0;
  let severeIssuesCount = 0;

  for (const r of rows) {
    if (r.shift_detected) shiftsDetected++;
    if (r.emotion_intensity !== null) {
      emotionSum += r.emotion_intensity;
      emotionCount++;
    }
    if (r.emotion_stability === "unstable") unstableCount++;
    if (r.overall_score !== null) {
      scoreSum += r.overall_score;
      scoreCount++;
    }
    // Severe: intensity 3 + unstable, OR overall_score <= 1
    const isSevere =
      (r.emotion_intensity === 3 && r.emotion_stability === "unstable") ||
      (r.overall_score !== null && r.overall_score <= 1);
    if (isSevere) severeIssuesCount++;
  }

  const recentShifts = rows
    .filter((r: any) => r.shift_detected && r.shift_description)
    .slice(0, 3)
    .map((r: any) => r.shift_description as string);

  return {
    totalConversations: rows.length,
    shiftsDetected,
    avgEmotionIntensity: emotionCount > 0 ? emotionSum / emotionCount : 0,
    unstableCount,
    avgOverallScore: scoreCount > 0 ? scoreSum / scoreCount : 0,
    severeIssuesCount,
    hasSevereBlock: severeIssuesCount > 0,
    observerPhase: rows[0]?.phase || null,
    recentShiftDescriptions: recentShifts,
  };
}

// ============================================================
// PHASE NAMES & NEXT CRITERIA DESCRIPTIONS
// ============================================================

const PHASE_NAMES: Record<number, string> = {
  1: "Consciência",
  2: "Limites",
  3: "Identidade",
  4: "Ritmo",
  5: "Vitalidade",
  6: "Governo",
  7: "Plenitude",
};

const NEXT_CRITERIA: Record<number, string> = {
  1: "Manter clareza >= 6 por 3 dias consecutivos",
  2: "Melhorar regulação em 30% comparado à Fase 1",
  3: "Preencher outputs de identidade e manter clareza >= 7",
  4: "Alcançar streak de 5 dias consecutivos",
  5: "Manter vitalidade >= 6 por 5 dias",
  6: "Completar plano em 3 áreas e executar 1 ação",
  7: "Manter autonomia >= 7 (fase de manutenção)",
};

// ============================================================
// STREAK CALCULATION
// ============================================================

function calculateStreak(
  sessions: Session[],
  currentStreak: number,
  bestStreak: number
): { streak_current: number; streak_best: number } {
  const completedDates = sessions
    .filter((s) => s.completed)
    .map((s) => s.session_date)
    .sort()
    .reverse();

  if (completedDates.length === 0) {
    return { streak_current: 0, streak_best: bestStreak };
  }

  const today = new Date().toISOString().split("T")[0];
  const yesterday = new Date(Date.now() - 86400000).toISOString().split("T")[0];

  const mostRecent = completedDates[0];

  // If most recent session is not today or yesterday, streak is broken
  if (mostRecent !== today && mostRecent !== yesterday) {
    return { streak_current: 0, streak_best: bestStreak };
  }

  // Count consecutive days from most recent
  let streak = 1;
  for (let i = 1; i < completedDates.length; i++) {
    const prev = new Date(completedDates[i - 1]);
    const curr = new Date(completedDates[i]);
    const diffMs = prev.getTime() - curr.getTime();
    const diffDays = Math.round(diffMs / 86400000);
    if (diffDays === 1) {
      streak++;
    } else {
      break;
    }
  }

  return {
    streak_current: streak,
    streak_best: Math.max(streak, bestStreak),
  };
}

// ============================================================
// MAIN HANDLER
// ============================================================

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { user_id, action = "evaluate", override_phase, override_notes } =
      await req.json();

    if (!user_id) {
      return new Response(
        JSON.stringify({ error: "user_id is required" }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // ========================================
    // STEP 0: FEATURE FLAG CHECK (CRÍTICO)
    // ========================================
    const { data: flagResult } = await supabase.rpc("get_feature_flag", {
      p_flag_name: "io_phase_manager_enabled",
      p_user_id: user_id,
    });

    if (flagResult !== true) {
      await supabase.from("observability_logs").insert({
        user_id,
        event_type: "flag_check",
        event_data: {
          flag: "io_phase_manager_enabled",
          value: false,
          action,
        },
      });

      return new Response(
        JSON.stringify({
          skipped: true,
          reason: "io_phase_manager_enabled is false",
          user_id,
        }),
        {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    // ========================================
    // ACTION ROUTER
    // ========================================

    if (action === "get_status") {
      return await handleGetStatus(supabase, user_id);
    }

    if (action === "manual_override") {
      return await handleManualOverride(
        supabase,
        req,
        user_id,
        override_phase,
        override_notes
      );
    }

    // action === 'evaluate' (default)
    return await handleEvaluate(supabase, user_id);
  } catch (error) {
    console.error("Error in io-phase-manager:", error);
    return new Response(
      JSON.stringify({
        error: error instanceof Error ? error.message : "Unknown error",
      }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});

// ============================================================
// GET STATUS
// ============================================================

async function handleGetStatus(supabase: any, userId: string) {
  const { data: userPhase, error } = await supabase
    .from("io_user_phase")
    .select("*")
    .eq("user_id", userId)
    .single();

  if (error || !userPhase) {
    return new Response(
      JSON.stringify({
        success: true,
        user_id: userId,
        status: "no_record",
        message: "Usuário não possui registro de fase IO",
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }

  return new Response(
    JSON.stringify({
      success: true,
      user_id: userId,
      current_phase: userPhase.current_phase,
      phase_name: PHASE_NAMES[userPhase.current_phase] || "Desconhecida",
      igi_current: userPhase.igi_current,
      streak_current: userPhase.streak_current,
      streak_best: userPhase.streak_best,
      total_sessions: userPhase.total_sessions,
      last_session_date: userPhase.last_session_date,
      phase_entered_at: userPhase.phase_entered_at,
      phase_criteria_met: userPhase.phase_criteria_met,
      next_criteria: NEXT_CRITERIA[userPhase.current_phase] || "",
    }),
    {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    }
  );
}

// ============================================================
// MANUAL OVERRIDE
// ============================================================

async function handleManualOverride(
  supabase: any,
  req: Request,
  userId: string,
  overridePhase?: number,
  overrideNotes?: string
) {
  // Validate phase
  if (!overridePhase || overridePhase < 1 || overridePhase > 7) {
    return new Response(
      JSON.stringify({
        error: "override_phase must be between 1 and 7",
      }),
      {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }

  // Validate admin via JWT
  const authHeader = req.headers.get("Authorization");
  if (!authHeader?.startsWith("Bearer ")) {
    return new Response(
      JSON.stringify({ error: "Authorization required for manual_override" }),
      {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }

  const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const userClient = createClient(supabaseUrl, anonKey, {
    global: { headers: { Authorization: authHeader } },
  });

  const token = authHeader.replace("Bearer ", "");
  const { data: claimsData, error: claimsError } =
    await userClient.auth.getClaims(token);

  if (claimsError || !claimsData?.claims) {
    return new Response(
      JSON.stringify({ error: "Invalid token" }),
      {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }

  const adminId = claimsData.claims.sub as string;

  // Verify admin/desenvolvedor role
  const { data: isAdmin } = await supabase.rpc("has_role", {
    _user_id: adminId,
    _role: "admin",
  });
  const { data: isDev } = await supabase.rpc("has_role", {
    _user_id: adminId,
    _role: "desenvolvedor",
  });

  if (!isAdmin && !isDev) {
    return new Response(
      JSON.stringify({
        error: "Only admin or desenvolvedor can perform manual_override",
      }),
      {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }

  // Get current phase
  const { data: currentRecord } = await supabase
    .from("io_user_phase")
    .select("current_phase")
    .eq("user_id", userId)
    .single();

  const previousPhase = currentRecord?.current_phase ?? 1;

  // Update phase
  await supabase
    .from("io_user_phase")
    .update({
      current_phase: overridePhase,
      phase_entered_at: new Date().toISOString(),
      phase_criteria_met: {},
      updated_at: new Date().toISOString(),
    })
    .eq("user_id", userId);

  // Record transition
  await supabase.from("io_phase_transitions").insert({
    user_id: userId,
    from_phase: previousPhase,
    to_phase: overridePhase,
    transition_type: "manual_override",
    triggered_by: "admin",
    criteria_snapshot: {
      admin_id: adminId,
      notes: overrideNotes || "Manual override via admin",
      previous_phase: previousPhase,
    },
    notes: overrideNotes || null,
  });

  // Log
  await supabase.from("observability_logs").insert({
    user_id: userId,
    event_type: "phase_transition",
    event_data: {
      action: "manual_override",
      admin_id: adminId,
      previous_phase: previousPhase,
      new_phase: overridePhase,
      notes: overrideNotes,
    },
  });

  return new Response(
    JSON.stringify({
      success: true,
      user_id: userId,
      previous_phase: previousPhase,
      current_phase: overridePhase,
      phase_name: PHASE_NAMES[overridePhase] || "Desconhecida",
      decision: "manual_override",
      admin_id: adminId,
    }),
    {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    }
  );
}

// ============================================================
// EVALUATE (main flow)
// ============================================================

async function handleEvaluate(supabase: any, userId: string) {
  // STEP 1.5: Observer signals feature flag check
  const { data: observerFlagResult } = await supabase.rpc("get_feature_flag", {
    p_flag_name: "io_pm_observer_signals_enabled",
    p_user_id: userId,
  });
  const isObserverSignalsEnabled = observerFlagResult === true;

  // STEP 1.6: Registro analysis feature flag check
  const { data: registroFlagResult } = await supabase.rpc("get_feature_flag", {
    p_flag_name: "io_pm_registro_analysis_enabled",
    p_user_id: userId,
  });
  const isRegistroAnalysisEnabled = registroFlagResult === true;

  // STEP 2: Fetch current state
  let { data: userPhase } = await supabase
    .from("io_user_phase")
    .select("*")
    .eq("user_id", userId)
    .single();

  // If no record, create with phase 1
  if (!userPhase) {
    const { data: newRecord, error: insertErr } = await supabase
      .from("io_user_phase")
      .insert({
        user_id: userId,
        current_phase: 1,
        igi_current: 0,
        igi_history: [],
        streak_current: 0,
        streak_best: 0,
        total_sessions: 0,
        phase_criteria_met: {},
        phase_entered_at: new Date().toISOString(),
      })
      .select("*")
      .single();

    if (insertErr) {
      console.error("Error creating io_user_phase:", insertErr);
      return new Response(
        JSON.stringify({ error: "Failed to initialize user phase" }),
        {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    // Record initial placement
    await supabase.from("io_phase_transitions").insert({
      user_id: userId,
      from_phase: 1,
      to_phase: 1,
      transition_type: "initial_placement",
      triggered_by: "phase_manager",
      criteria_snapshot: { reason: "First evaluation — no existing record" },
    });

    return new Response(
      JSON.stringify({
        success: true,
        user_id: userId,
        previous_phase: 1,
        current_phase: 1,
        phase_name: "Consciência",
        decision: "maintain",
        criteria_status: {
          phase_1: { met: false, details: "Registro criado. Sem sessões ainda." },
        },
        igi: { current: 0, previous: 0 },
        streak: { current: 0, best: 0 },
        shadow_mode: true,
        next_criteria: NEXT_CRITERIA[1],
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }

  const currentPhase: number = userPhase.current_phase;
  const previousIgi: number = userPhase.igi_current ?? 0;
  const phaseCriteriaMet: Record<string, unknown> =
    (userPhase.phase_criteria_met as Record<string, unknown>) || {};

  // STEP 3: Fetch sessions for current phase
  const { data: currentPhaseSessions } = await supabase
    .from("io_daily_sessions")
    .select("*")
    .eq("user_id", userId)
    .eq("phase_at_session", currentPhase)
    .order("session_date", { ascending: false });

  const sessions: Session[] = currentPhaseSessions || [];

  // Fetch all user sessions for streak calculation
  const { data: allSessions } = await supabase
    .from("io_daily_sessions")
    .select("*")
    .eq("user_id", userId)
    .order("session_date", { ascending: false });

  const allUserSessions: Session[] = allSessions || [];

  // STEP 3.5: Fetch observer signals (if enabled)
  let observerSignals: ObserverSignals | null = null;
  if (isObserverSignalsEnabled) {
    try {
      observerSignals = await fetchObserverSignals(supabase, userId, 14);
    } catch (err) {
      console.error("Error fetching observer signals:", err);
      // Non-blocking: continue without observer signals
    }
  }

  // STEP 4: Apply hard rules for current phase
  let criteriaResult: CriteriaResult;

  switch (currentPhase) {
    case 1:
      criteriaResult = evaluatePhase1(sessions);
      break;
    case 2: {
      // Need phase 1 sessions for comparison
      const { data: p1Sessions } = await supabase
        .from("io_daily_sessions")
        .select("*")
        .eq("user_id", userId)
        .eq("phase_at_session", 1);
      criteriaResult = evaluatePhase2(sessions, p1Sessions || []);
      break;
    }
    case 3:
      criteriaResult = evaluatePhase3(sessions, phaseCriteriaMet);
      break;
    case 4:
      criteriaResult = evaluatePhase4(userPhase.streak_current ?? 0);
      break;
    case 5:
      criteriaResult = evaluatePhase5(sessions);
      break;
    case 6:
      criteriaResult = evaluatePhase6(phaseCriteriaMet);
      break;
    case 7:
      criteriaResult = evaluatePhase7(sessions);
      break;
    default:
      criteriaResult = { met: false, details: `Fase desconhecida: ${currentPhase}` };
  }

  // STEP 4.5: Observer blocking check
  let blockedByObserver = false;
  if (criteriaResult.met && observerSignals?.hasSevereBlock) {
    const auxiliaryNote =
      `Observer: ${observerSignals.shiftsDetected} shifts, ` +
      `score médio ${observerSignals.avgOverallScore.toFixed(1)}, ` +
      `${observerSignals.severeIssuesCount} issue(s) severa(s)`;
    criteriaResult = {
      met: false,
      details:
        criteriaResult.details +
        ` | BLOQUEIO: observer detectou instabilidade severa. ${auxiliaryNote}`,
    };
    blockedByObserver = true;
  } else if (observerSignals) {
    // Append auxiliary info to details (informational only)
    const auxiliaryNote =
      `Observer: ${observerSignals.shiftsDetected} shifts, ` +
      `score médio ${observerSignals.avgOverallScore.toFixed(1)}, ` +
      `sem bloqueio`;
    criteriaResult = {
      met: criteriaResult.met,
      details: criteriaResult.details + ` | ${auxiliaryNote}`,
    };
  }

  // STEP 4.6: Registro analysis blocking check
  let registroBlock = false;
  let registroSummary: Record<string, unknown> | null = null;

  if (isRegistroAnalysisEnabled) {
    try {
      const withAnalysis = sessions.filter(
        (s: any) => s.registro_analysis && !s.registro_analysis.skipped
      );

      if (withAnalysis.length > 0) {
        const avgGenuineness = withAnalysis.reduce(
          (sum: number, s: any) => sum + (s.registro_analysis.genuineness_score || 0), 0
        ) / withAnalysis.length;
        const avgCoherence = withAnalysis.reduce(
          (sum: number, s: any) => sum + (s.registro_analysis.coherence_with_scales || 0), 0
        ) / withAnalysis.length;
        const superficialCount = withAnalysis.filter(
          (s: any) => s.registro_analysis.depth_level === "superficial"
        ).length;
        const repetitionCount = withAnalysis.filter(
          (s: any) => s.registro_analysis.repetition_detected
        ).length;

        registroSummary = {
          sessions_analyzed: withAnalysis.length,
          avg_genuineness: Math.round(avgGenuineness * 1000) / 1000,
          avg_coherence: Math.round(avgCoherence * 1000) / 1000,
          superficial_count: superficialCount,
          repetition_count: repetitionCount,
        };

        // Bloqueio: últimas 3 sessões com avgCoherence < 0.3 E avgGenuineness < 0.3
        const recent3 = withAnalysis
          .sort((a: any, b: any) => b.session_date.localeCompare(a.session_date))
          .slice(0, 3);
        if (recent3.length >= 3) {
          const r3Genuineness = recent3.reduce(
            (sum: number, s: any) => sum + (s.registro_analysis.genuineness_score || 0), 0
          ) / 3;
          const r3Coherence = recent3.reduce(
            (sum: number, s: any) => sum + (s.registro_analysis.coherence_with_scales || 0), 0
          ) / 3;
          if (r3Coherence < 0.3 && r3Genuineness < 0.3 && criteriaResult.met) {
            criteriaResult = {
              met: false,
              details: criteriaResult.details +
                " | BLOQUEIO REGISTRO: Registros indicam incoerência grave entre escalas e reflexão textual" +
                ` (genuineness: ${r3Genuineness.toFixed(2)}, coherence: ${r3Coherence.toFixed(2)})`,
            };
            registroBlock = true;
          }
        }
      }
    } catch (err) {
      console.error("Error processing registro analysis:", err);
      // Non-blocking: continue without registro analysis
    }
  }

  // STEP 5: Evaluate regression
  const regressionResult = evaluateRegression(sessions);

  // STEP 6: Calculate IGI from most recent session
  let newIgi = previousIgi;
  const completedSessions = sessions.filter((s) => s.completed);
  if (completedSessions.length > 0) {
    const mostRecent = completedSessions.sort((a, b) =>
      b.session_date.localeCompare(a.session_date)
    )[0];

    const { data: igiResult } = await supabase.rpc("calculate_igi", {
      p_clareza: mostRecent.escala_clareza,
      p_regulacao: mostRecent.escala_regulacao,
      p_identidade: mostRecent.escala_identidade,
      p_constancia: mostRecent.escala_constancia,
      p_vitalidade: mostRecent.escala_vitalidade,
      p_agencia: mostRecent.escala_agencia,
      p_autonomia: mostRecent.escala_autonomia,
    });
    if (igiResult !== null && igiResult !== undefined) {
      newIgi = Number(igiResult);
    }
  }

  // STEP 7: Update streak
  const { streak_current, streak_best } = calculateStreak(
    allUserSessions,
    userPhase.streak_current ?? 0,
    userPhase.streak_best ?? 0
  );

  // STEP 8: Decide and record
  let decision: "advance" | "regression" | "maintain" = "maintain";
  let newPhase = currentPhase;

  if (criteriaResult.met && currentPhase < 7) {
    decision = "advance";
    newPhase = currentPhase + 1;
  } else if (
    regressionResult.shouldRegress &&
    currentPhase > 1 &&
    !criteriaResult.met
  ) {
    decision = "regression";
    newPhase = currentPhase - 1;
  }

  // Update io_user_phase
  const igiHistory = Array.isArray(userPhase.igi_history)
    ? userPhase.igi_history
    : [];
  if (newIgi !== previousIgi) {
    igiHistory.push({
      value: newIgi,
      date: new Date().toISOString().split("T")[0],
      phase: currentPhase,
    });
    if (igiHistory.length > 100) igiHistory.splice(0, igiHistory.length - 100);
  }

  const updatePayload: Record<string, unknown> = {
    igi_current: newIgi,
    igi_history: igiHistory,
    streak_current,
    streak_best,
    total_sessions: allUserSessions.filter((s) => s.completed).length,
    last_session_date:
      completedSessions.length > 0
        ? completedSessions.sort((a, b) =>
            b.session_date.localeCompare(a.session_date)
          )[0].session_date
        : userPhase.last_session_date,
    updated_at: new Date().toISOString(),
  };

  if (decision === "advance") {
    updatePayload.current_phase = newPhase;
    updatePayload.phase_entered_at = new Date().toISOString();
    updatePayload.phase_criteria_met = {};
  } else if (decision === "regression") {
    updatePayload.current_phase = newPhase;
    updatePayload.phase_entered_at = new Date().toISOString();
    updatePayload.phase_criteria_met = {};
  }

  await supabase
    .from("io_user_phase")
    .update(updatePayload)
    .eq("user_id", userId);

  // Record transition if phase changed
  if (decision !== "maintain") {
    await supabase.from("io_phase_transitions").insert({
      user_id: userId,
      from_phase: currentPhase,
      to_phase: newPhase,
      transition_type: decision === "advance" ? "advance" : "regression",
      triggered_by: "phase_manager",
      criteria_snapshot: {
        criteria_result: criteriaResult,
        regression_result: regressionResult,
        igi_before: previousIgi,
        igi_after: newIgi,
        streak_current,
        total_sessions_in_phase: sessions.length,
        shadow_mode: true,
        observer_signals: observerSignals || null,
        blocked_by_observer: blockedByObserver,
        registro_analysis_summary: registroSummary || null,
        blocked_by_registro: registroBlock,
      },
    });
  }

  // STEP 9: Observability log
  const { data: activeFlags } = await supabase
    .from("feature_flags")
    .select("flag_name, flag_value")
    .like("flag_name", "io_%");

  const flagsSnapshot: Record<string, boolean> = {};
  (activeFlags || []).forEach(
    (f: { flag_name: string; flag_value: boolean }) => {
      flagsSnapshot[f.flag_name] = f.flag_value;
    }
  );

  const observerRecommendation = observerSignals
    ? observerSignals.hasSevereBlock
      ? "blocked"
      : observerSignals.shiftsDetected > 0
        ? "positive"
        : "neutral"
    : null;

  await supabase.from("observability_logs").insert({
    user_id: userId,
    event_type: "phase_transition",
    event_data: {
      previous_phase: currentPhase,
      new_phase: newPhase,
      decision,
      criteria_evaluated: criteriaResult,
      regression_evaluated: regressionResult,
      igi_before: previousIgi,
      igi_after: newIgi,
      streak: streak_current,
      observer_phase: observerSignals?.observerPhase || null,
      observer_signals_consulted: isObserverSignalsEnabled,
      observer_shifts: observerSignals?.shiftsDetected || 0,
      observer_severe_block: observerSignals?.hasSevereBlock || false,
      observer_recommendation: observerRecommendation,
      blocked_by_observer: blockedByObserver,
      registro_analysis_consulted: isRegistroAnalysisEnabled,
      registro_avg_genuineness: (registroSummary as any)?.avg_genuineness ?? null,
      registro_avg_coherence: (registroSummary as any)?.avg_coherence ?? null,
      registro_block: registroBlock,
      shadow_mode: true,
    },
    flags_active: flagsSnapshot,
  });

  // STEP 10: Return response
  const response: Record<string, unknown> = {
    success: true,
    user_id: userId,
    previous_phase: currentPhase,
    current_phase: newPhase,
    phase_name: PHASE_NAMES[newPhase] || "Desconhecida",
    decision,
    criteria_status: {
      [`phase_${currentPhase}`]: criteriaResult,
    },
    regression: regressionResult,
    igi: {
      current: newIgi,
      previous: previousIgi,
    },
    streak: {
      current: streak_current,
      best: streak_best,
    },
    shadow_mode: true,
    next_criteria:
      decision === "advance"
        ? NEXT_CRITERIA[newPhase] || ""
        : NEXT_CRITERIA[currentPhase] || "",
  };

  if (observerSignals) {
    response.observer_signals = {
      consulted: true,
      total_conversations: observerSignals.totalConversations,
      shifts_detected: observerSignals.shiftsDetected,
      avg_overall_score: Math.round(observerSignals.avgOverallScore * 100) / 100,
      severe_block: observerSignals.hasSevereBlock,
      blocked_by_observer: blockedByObserver,
      recommendation: observerRecommendation,
      observer_phase: observerSignals.observerPhase,
    };
  }

  return new Response(JSON.stringify(response), {
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}
