import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.89.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

/**
 * Aggregate User Journey
 * 
 * This function is called by turn-insight-observer after saving an insight with taxonomy data.
 * It creates or updates user_themes records to consolidate journey data by user/theme.
 */

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const {
      user_id,
      session_id,
      insight_id,
      lie_active,
      phase,
      phase_confidence,
      shift_detected,
      overall_score,
      truth_target,
    } = await req.json();

    console.log("=== AGGREGATE USER JOURNEY START ===");
    console.log("User ID:", user_id);
    console.log("Session ID:", session_id);
    console.log("Insight ID:", insight_id);

    if (!user_id) {
      console.log("No user_id provided, skipping aggregation");
      return new Response(
        JSON.stringify({ status: "skipped", reason: "no_user_id" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

    if (!supabaseUrl || !supabaseServiceKey) {
      throw new Error("Supabase credentials not configured");
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Extract taxonomy from lie_active
    const scenario = lie_active?.scenario;
    const center = lie_active?.center;
    const securityMatrix = lie_active?.security_matrix;
    const lieText = lie_active?.text;

    if (!scenario || !securityMatrix) {
      console.log("No taxonomy data in lie_active, skipping");
      return new Response(
        JSON.stringify({ status: "skipped", reason: "no_taxonomy" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log(`Taxonomy: ${scenario} | ${center} | ${securityMatrix}`);

    // Check if theme already exists for this user + scenario + security_matrix
    const { data: existingTheme, error: fetchError } = await supabase
      .from("user_themes")
      .select("*")
      .eq("user_id", user_id)
      .eq("scenario", scenario)
      .eq("security_matrix", securityMatrix)
      .maybeSingle();

    if (fetchError && fetchError.code !== "PGRST116") {
      console.error("Error fetching existing theme:", fetchError);
      throw fetchError;
    }

    if (existingTheme) {
      console.log("Updating existing theme:", existingTheme.id);

      // Calculate new averages
      const newTurnCount = existingTheme.turn_count + 1;
      const newAvgScore = (
        (existingTheme.avg_score * existingTheme.turn_count) + (overall_score || 0)
      ) / newTurnCount;
      const newShiftCount = existingTheme.total_shifts + (shift_detected ? 1 : 0);

      // Add session to list if not already present
      const sessionIds = existingTheme.session_ids || [];
      if (session_id && !sessionIds.includes(session_id)) {
        sessionIds.push(session_id);
      }

      // Update theme
      const { error: updateError } = await supabase
        .from("user_themes")
        .update({
          current_phase: phase || existingTheme.current_phase,
          phase_confidence: phase_confidence || existingTheme.phase_confidence,
          total_shifts: newShiftCount,
          avg_score: Math.round(newAvgScore * 100) / 100,
          turn_count: newTurnCount,
          session_ids: sessionIds,
          last_activity_at: new Date().toISOString(),
          // Update primary_lie if this one has higher confidence
          primary_lie: (lie_active?.confidence || 0) > (existingTheme.primary_lie?.confidence || 0)
            ? { text: lieText, confidence: lie_active?.confidence }
            : existingTheme.primary_lie,
          // Update truth_target if provided and has higher confidence
          target_truth: (truth_target?.confidence || 0) > (existingTheme.target_truth?.confidence || 0)
            ? truth_target
            : existingTheme.target_truth,
          // Update status based on phase
          status: phase === "CONSOLIDACAO" ? "resolved" : 
                  phase === "TROCA" ? "in_progress" : 
                  existingTheme.status,
          resolved_at: phase === "CONSOLIDACAO" ? new Date().toISOString() : existingTheme.resolved_at,
        })
        .eq("id", existingTheme.id);

      if (updateError) {
        console.error("Error updating theme:", updateError);
        throw updateError;
      }

      console.log("Theme updated successfully");

    } else {
      console.log("Creating new theme for:", scenario, securityMatrix);

      // Create theme label
      const themeLabel = `${lieText?.substring(0, 50) || scenario} (${securityMatrix})`;

      // Create new theme
      const { error: insertError } = await supabase
        .from("user_themes")
        .insert({
          user_id,
          theme_label: themeLabel,
          scenario,
          center: center || "EMOCIONAL", // Default if not provided
          security_matrix: securityMatrix,
          current_phase: phase || "ACOLHIMENTO",
          phase_confidence: phase_confidence || 0,
          total_shifts: shift_detected ? 1 : 0,
          avg_score: overall_score || 0,
          primary_lie: lieText ? { text: lieText, confidence: lie_active?.confidence || 0.5 } : {},
          target_truth: truth_target || {},
          session_ids: session_id ? [session_id] : [],
          turn_count: 1,
          status: "active",
        });

      if (insertError) {
        console.error("Error creating theme:", insertError);
        throw insertError;
      }

      console.log("Theme created successfully");
    }

    // Update user_profiles aggregates
    await updateUserProfileAggregates(supabase, user_id);

    console.log("=== AGGREGATE USER JOURNEY COMPLETE ===");

    return new Response(
      JSON.stringify({ 
        status: "completed",
        action: existingTheme ? "updated" : "created",
        theme: { scenario, center, security_matrix: securityMatrix },
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error) {
    console.error("Aggregate error:", error);
    return new Response(
      JSON.stringify({ 
        error: error instanceof Error ? error.message : "Unknown error",
        status: "failed",
      }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});

/**
 * Update aggregate metrics in user_profiles
 */
async function updateUserProfileAggregates(supabase: any, userId: string) {
  try {
    // Get all themes for this user
    const { data: themes, error: themesError } = await supabase
      .from("user_themes")
      .select("center, security_matrix, status, total_shifts, avg_score")
      .eq("user_id", userId);

    if (themesError) {
      console.error("Error fetching themes for aggregation:", themesError);
      return;
    }

    if (!themes || themes.length === 0) {
      return;
    }

    // Calculate aggregates
    const activeThemesCount = themes.filter((t: any) => t.status === "active" || t.status === "in_progress").length;
    const totalShifts = themes.reduce((sum: number, t: any) => sum + (t.total_shifts || 0), 0);
    const globalAvgScore = themes.reduce((sum: number, t: any) => sum + (t.avg_score || 0), 0) / themes.length;

    // Find dominant center and security_matrix
    const centerCounts: Record<string, number> = {};
    const matrixCounts: Record<string, number> = {};
    
    for (const theme of themes) {
      if (theme.center) {
        centerCounts[theme.center] = (centerCounts[theme.center] || 0) + 1;
      }
      if (theme.security_matrix) {
        matrixCounts[theme.security_matrix] = (matrixCounts[theme.security_matrix] || 0) + 1;
      }
    }

    const primaryCenter = Object.entries(centerCounts)
      .sort((a, b) => b[1] - a[1])[0]?.[0] || null;
    
    const primarySecurityMatrix = Object.entries(matrixCounts)
      .sort((a, b) => b[1] - a[1])[0]?.[0] || null;

    // Update user_profiles
    const { error: updateError } = await supabase
      .from("user_profiles")
      .upsert({
        id: userId,
        primary_center: primaryCenter,
        primary_security_matrix: primarySecurityMatrix,
        active_themes_count: activeThemesCount,
        total_shifts: totalShifts,
        global_avg_score: Math.round(globalAvgScore * 100) / 100,
        updated_at: new Date().toISOString(),
      }, { onConflict: "id" });

    if (updateError) {
      console.error("Error updating user_profiles:", updateError);
    } else {
      console.log("User profile aggregates updated");
    }
  } catch (err) {
    console.error("Error in updateUserProfileAggregates:", err);
  }
}
