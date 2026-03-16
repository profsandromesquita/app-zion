import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.89.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

/**
 * Resync Taxonomy
 * 
 * This function reprocesses existing turn_insights that have lie_active JSON data
 * but NULL values in the taxonomy columns (lie_center, lie_security_matrix, lie_scenario).
 * 
 * It applies the corrected sanitization logic and triggers aggregate-user-journey
 * for each recovered insight.
 * 
 * Execute multiple times if needed (limit 100 per call to avoid timeout).
 */

// Same corrected values as turn-insight-observer
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

  try {
    // 1. Fetch insights with JSON data but NULL columns
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
    let skipped = 0;
    const errors: string[] = [];

    for (const insight of insights || []) {
      try {
        const lieActive = (insight.lie_active as Record<string, any>) || {};
        const userId = (insight.chat_sessions as any)?.user_id;

        // Apply corrected sanitization
        const rawCenter = lieActive.center;
        const rawMatrix = lieActive.security_matrix;
        const rawScenario = lieActive.scenario;

        const lieCenter = (rawCenter && typeof rawCenter === 'string' && VALID_CENTERS.includes(rawCenter.toUpperCase())) 
          ? rawCenter.toUpperCase() : null;
        
        const lieSecurityMatrix = (rawMatrix && typeof rawMatrix === 'string' && VALID_SECURITY_MATRICES.includes(rawMatrix.toUpperCase())) 
          ? rawMatrix.toUpperCase() : null;
        
        const lieScenario = (rawScenario && typeof rawScenario === 'string' && rawScenario.trim() && rawScenario.toUpperCase() !== 'N/A')
          ? rawScenario.trim() : null;

        // Only update if we can extract at least security_matrix
        if (!lieSecurityMatrix) {
          console.log(`Insight ${insight.id}: No valid security_matrix in JSON (raw: ${rawMatrix}), skipping`);
          skipped++;
          continue;
        }

        console.log(`Insight ${insight.id}: Extracted center=${lieCenter}, matrix=${lieSecurityMatrix}, scenario=${lieScenario}`);

        // 2. Update columns
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

        // 3. Trigger aggregate-user-journey if we have user
        if (userId && lieSecurityMatrix) {
          try {
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
              console.log(`Aggregated insight ${insight.id} for user ${userId}`);
            } else {
              const errorText = await aggregateResponse.text();
              console.error(`Aggregate failed for ${insight.id}: ${errorText}`);
            }
          } catch (aggErr) {
            console.error(`Aggregate exception for ${insight.id}:`, aggErr);
          }
        }
      } catch (err) {
        errors.push(`Insight ${insight.id}: ${err}`);
      }
    }

    console.log("=== RESYNC COMPLETE ===");
    console.log(`Updated: ${updated}, Aggregated: ${aggregated}, Skipped: ${skipped}, Errors: ${errors.length}`);

    return new Response(
      JSON.stringify({
        status: "completed",
        found: insights?.length || 0,
        updated,
        aggregated,
        skipped,
        errors: errors.slice(0, 10), // First 10 errors only
        message: updated > 0 
          ? `Successfully resynced ${updated} insights. Run again if more remain.`
          : "No insights to resync or all had invalid taxonomy data.",
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error) {
    console.error("Resync error:", error);
    return new Response(
      JSON.stringify({ 
        error: error instanceof Error ? error.message : "Unknown error",
        status: "failed",
      }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
