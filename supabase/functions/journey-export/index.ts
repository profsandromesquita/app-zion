import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.89.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// ============================================
// HELPERS
// ============================================

function anonymizeInsight(insight: any): any {
  const { 
    chat_session_id, 
    message_user_id, 
    message_assistant_id, 
    curated_by,
    ...anonymized 
  } = insight;
  return anonymized;
}

function convertToCSV(data: any[]): string {
  if (data.length === 0) return "";
  
  const flattenObject = (obj: any, prefix = ""): Record<string, any> => {
    const result: Record<string, any> = {};
    for (const [key, value] of Object.entries(obj)) {
      const newKey = prefix ? `${prefix}_${key}` : key;
      if (value && typeof value === "object" && !Array.isArray(value)) {
        Object.assign(result, flattenObject(value, newKey));
      } else if (Array.isArray(value)) {
        result[newKey] = value.join("; ");
      } else {
        result[newKey] = value;
      }
    }
    return result;
  };
  
  const flatData = data.map(item => flattenObject(item));
  const headers = [...new Set(flatData.flatMap(item => Object.keys(item)))];
  
  const escapeCSV = (val: any): string => {
    if (val === null || val === undefined) return "";
    const str = String(val);
    if (str.includes(",") || str.includes('"') || str.includes("\n")) {
      return `"${str.replace(/"/g, '""')}"`;
    }
    return str;
  };
  
  const csvRows = [headers.join(",")];
  for (const item of flatData) {
    const row = headers.map(h => escapeCSV(item[h]));
    csvRows.push(row.join(","));
  }
  
  return csvRows.join("\n");
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

    // Verify admin role from auth header
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: "Authorization required" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const token = authHeader.replace("Bearer ", "");
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    
    if (authError || !user) {
      return new Response(
        JSON.stringify({ error: "Invalid token" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Check admin role
    const { data: roleData } = await supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", user.id)
      .eq("role", "admin")
      .maybeSingle();

    if (!roleData) {
      return new Response(
        JSON.stringify({ error: "Admin access required" }),
        { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const { 
      format = "jsonl",
      mode = "turn-level",
      anonymize = true,
      include_meta = false,
      filters = {}
    } = await req.json();

    console.log("Export request:", { format, mode, anonymize, include_meta, filters });

    // Build query
    let query = supabase
      .from("turn_insights")
      .select("*")
      .eq("extraction_status", "completed")
      .order("created_at", { ascending: true });

    // Apply filters
    if (filters.phase) {
      query = query.eq("phase", filters.phase);
    }
    if (filters.include_in_training === true) {
      query = query.eq("include_in_training", true);
    }
    if (filters.exclude_from_training === false) {
      query = query.or("exclude_from_training.is.null,exclude_from_training.eq.false");
    }
    if (filters.min_score !== undefined) {
      query = query.gte("overall_score", filters.min_score);
    }
    if (filters.max_score !== undefined) {
      query = query.lte("overall_score", filters.max_score);
    }
    if (filters.shift_detected !== undefined) {
      query = query.eq("shift_detected", filters.shift_detected);
    }
    if (filters.session_id) {
      query = query.eq("chat_session_id", filters.session_id);
    }
    if (filters.date_from) {
      query = query.gte("created_at", filters.date_from);
    }
    if (filters.date_to) {
      query = query.lte("created_at", filters.date_to);
    }

    const { data: insights, error: queryError } = await query;

    if (queryError) {
      console.error("Query error:", queryError);
      throw queryError;
    }

    console.log(`Found ${insights?.length || 0} insights`);

    if (!insights || insights.length === 0) {
      return new Response(
        JSON.stringify({ error: "No data found matching filters" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    let exportData: any[];

    if (mode === "turn-level") {
      // Each turn is a row
      exportData = insights.map(insight => {
        const base = anonymize ? anonymizeInsight(insight) : insight;
        
        if (!include_meta) {
          // Simplified format for training
          return {
            phase: base.phase,
            user_emotions: base.primary_emotions?.join(", ") || "",
            emotion_intensity: base.emotion_intensity,
            lie_active: base.lie_active?.text || "",
            truth_target: base.truth_target?.text || "",
            shift_detected: base.shift_detected,
            overall_score: base.overall_score,
            issues: base.issues_detected?.join(", ") || "",
          };
        }
        
        return base;
      });
    } else {
      // Trajectory-level: group by session
      const sessionMap = new Map<string, any[]>();
      
      for (const insight of insights) {
        const sessionId = insight.chat_session_id;
        if (!sessionMap.has(sessionId)) {
          sessionMap.set(sessionId, []);
        }
        sessionMap.get(sessionId)!.push(insight);
      }

      exportData = Array.from(sessionMap.entries()).map(([sessionId, turns]) => {
        const sortedTurns = turns.sort((a, b) => a.turn_number - b.turn_number);
        const lastTurn = sortedTurns[sortedTurns.length - 1];
        const avgScore = sortedTurns.reduce((sum, t) => sum + (t.overall_score || 0), 0) / sortedTurns.length;
        const shiftCount = sortedTurns.filter(t => t.shift_detected).length;

        const trajectory = {
          session_id: anonymize ? undefined : sessionId,
          turn_count: sortedTurns.length,
          final_phase: lastTurn.phase,
          avg_score: Math.round(avgScore * 100) / 100,
          shift_count: shiftCount,
          phases_progression: sortedTurns.map(t => t.phase),
          turns: sortedTurns.map(turn => {
            const base = anonymize ? anonymizeInsight(turn) : turn;
            if (!include_meta) {
              return {
                turn_number: turn.turn_number,
                phase: turn.phase,
                shift_detected: turn.shift_detected,
                overall_score: turn.overall_score,
              };
            }
            return base;
          }),
        };

        return trajectory;
      });
    }

    // Log export action
    await supabase.from("admin_audit_logs").insert({
      admin_id: user.id,
      action: "journey_export",
      details: {
        format,
        mode,
        anonymize,
        include_meta,
        filters,
        count: exportData.length,
      },
    });

    // Format response
    let content: string;
    let contentType: string;
    let filename: string;

    const timestamp = new Date().toISOString().split("T")[0];

    if (format === "jsonl") {
      content = exportData.map(item => JSON.stringify(item)).join("\n");
      contentType = "application/x-ndjson";
      filename = `journey-export-${mode}-${timestamp}.jsonl`;
    } else if (format === "csv") {
      content = convertToCSV(exportData);
      contentType = "text/csv";
      filename = `journey-export-${mode}-${timestamp}.csv`;
    } else {
      content = JSON.stringify(exportData, null, 2);
      contentType = "application/json";
      filename = `journey-export-${mode}-${timestamp}.json`;
    }

    return new Response(content, {
      headers: {
        ...corsHeaders,
        "Content-Type": contentType,
        "Content-Disposition": `attachment; filename="${filename}"`,
      },
    });

  } catch (error) {
    console.error("Export error:", error);
    return new Response(
      JSON.stringify({ 
        error: error instanceof Error ? error.message : "Unknown error" 
      }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
