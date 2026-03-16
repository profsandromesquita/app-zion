import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.89.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface ExportFilters {
  label?: "useful" | "not_useful" | "theology_report" | "all";
  includeInExport?: boolean;
  startDate?: string;
  endDate?: string;
  intent?: string;
  wasRewritten?: boolean;
  ragLowConfidence?: boolean;
  search?: string;
}

interface ExportRequest {
  format: "jsonl" | "csv";
  filters?: ExportFilters;
  anonymize?: boolean;
  useCorrectedResponses?: boolean;
}

interface Violation {
  code: string;
  description: string;
}

interface Diagnosis {
  symptom?: string;
  distorted_virtue?: string;
  root_fear?: string;
  security_matrix?: string;
}

interface CuratedCorrection {
  id: string;
  feedback_item_id: string;
  status: string;
  adherence_score: number | null;
  violations: Violation[];
  corrected_response: string | null;
  diagnosis: Diagnosis;
  notes: string | null;
  include_in_training: boolean;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

    if (!supabaseUrl || !supabaseServiceKey) {
      throw new Error("Supabase configuration missing");
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Verificar autenticação e permissão de admin
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

    // Verificar se é admin
    const { data: roleData, error: roleError } = await supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", user.id)
      .eq("role", "admin")
      .single();

    if (roleError || !roleData) {
      return new Response(
        JSON.stringify({ error: "Admin access required" }),
        { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const body: ExportRequest = await req.json();
    const { format = "jsonl", filters = {}, anonymize = true, useCorrectedResponses = true } = body;

    console.log("Export request from admin:", user.id, { format, filters, anonymize, useCorrectedResponses });

    // Construir query com filtros
    let query = supabase
      .from("feedback_dataset_items")
      .select("*")
      .order("created_at", { ascending: false });

    // Aplicar filtros
    if (filters.label && filters.label !== "all") {
      query = query.eq("feedback_label", filters.label);
    }

    if (filters.includeInExport !== undefined) {
      query = query.eq("include_in_export", filters.includeInExport);
    }

    if (filters.startDate) {
      query = query.gte("created_at", filters.startDate);
    }

    if (filters.endDate) {
      query = query.lte("created_at", filters.endDate);
    }

    if (filters.intent) {
      query = query.eq("intent", filters.intent);
    }

    if (filters.wasRewritten !== undefined) {
      query = query.eq("was_rewritten", filters.wasRewritten);
    }

    if (filters.ragLowConfidence !== undefined) {
      query = query.eq("rag_low_confidence", filters.ragLowConfidence);
    }

    if (filters.search) {
      query = query.or(`user_prompt_text.ilike.%${filters.search}%,assistant_answer_text.ilike.%${filters.search}%`);
    }

    const { data: items, error: queryError } = await query;

    if (queryError) {
      console.error("Query error:", queryError);
      throw queryError;
    }

    // Buscar correções curadas se useCorrectedResponses estiver ativo
    let curatedCorrections: CuratedCorrection[] = [];
    if (useCorrectedResponses && items && items.length > 0) {
      const itemIds = items.map((item) => item.id);
      const { data: corrections, error: correctionsError } = await supabase
        .from("curated_corrections")
        .select("*")
        .in("feedback_item_id", itemIds)
        .eq("include_in_training", true);

      if (correctionsError) {
        console.error("Error fetching corrections:", correctionsError);
      } else {
        curatedCorrections = (corrections || []) as CuratedCorrection[];
      }
    }

    // Criar mapa de correções por feedback_item_id
    const correctionsMap = new Map<string, CuratedCorrection>();
    curatedCorrections.forEach((c) => {
      correctionsMap.set(c.feedback_item_id, c);
    });

    console.log(`Found ${curatedCorrections.length} curated corrections for ${items?.length || 0} items`);

    // Preparar dados para export
    const exportData = (items || []).map((item) => {
      const correction = correctionsMap.get(item.id);
      
      // Usar resposta corrigida se disponível e useCorrectedResponses estiver ativo
      const responseToUse = useCorrectedResponses && correction?.corrected_response
        ? correction.corrected_response
        : item.assistant_answer_text;

      if (anonymize) {
        const baseData = {
          prompt: item.user_prompt_text,
          response: responseToUse,
          response_is_corrected: !!(correction?.corrected_response),
          label: item.feedback_label,
          intent: item.intent,
          model_id: item.model_id,
          was_rewritten: item.was_rewritten,
          rag_used: item.rag_used,
          rag_low_confidence: item.rag_low_confidence,
          created_at: item.created_at,
        };

        // Adicionar dados de curadoria se disponíveis
        if (correction) {
          return {
            ...baseData,
            curation_status: correction.status,
            adherence_score: correction.adherence_score,
            violations: correction.violations,
            diagnosis: correction.diagnosis,
          };
        }

        return baseData;
      }

      // Não anonimizado - retorna tudo
      return {
        ...item,
        response_corrected: correction?.corrected_response || null,
        response_is_corrected: !!(correction?.corrected_response),
        curation_status: correction?.status || null,
        adherence_score: correction?.adherence_score || null,
        violations: correction?.violations || [],
        diagnosis: correction?.diagnosis || null,
      };
    });

    // Registrar audit log
    const { error: auditError } = await supabase
      .from("admin_audit_logs")
      .insert({
        admin_id: user.id,
        action: "dataset_export",
        details: {
          format,
          filters,
          count: exportData.length,
          anonymized: anonymize,
          used_corrected_responses: useCorrectedResponses,
          corrections_applied: curatedCorrections.length,
        },
        ip_address: req.headers.get("x-forwarded-for") || req.headers.get("cf-connecting-ip") || null,
      });

    if (auditError) {
      console.error("Audit log error (non-fatal):", auditError);
    }

    console.log("Exporting", exportData.length, "items in format:", format, "with", curatedCorrections.length, "corrections applied");

    // Formatar output
    if (format === "jsonl") {
      const jsonl = exportData.map((r) => JSON.stringify(r)).join("\n");
      return new Response(jsonl, {
        headers: {
          ...corsHeaders,
          "Content-Type": "application/x-ndjson",
          "Content-Disposition": `attachment; filename="feedback_dataset_${new Date().toISOString().split("T")[0]}.jsonl"`,
        },
      });
    } else {
      // CSV
      const csv = convertToCSV(exportData, anonymize);
      return new Response(csv, {
        headers: {
          ...corsHeaders,
          "Content-Type": "text/csv; charset=utf-8",
          "Content-Disposition": `attachment; filename="feedback_dataset_${new Date().toISOString().split("T")[0]}.csv"`,
        },
      });
    }
  } catch (error) {
    console.error("Error in dataset-export:", error);
    return new Response(
      JSON.stringify({
        error: error instanceof Error ? error.message : "Unknown error",
        success: false,
      }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});

// Converter array de objetos para CSV
function convertToCSV(data: Record<string, unknown>[], anonymize: boolean): string {
  if (data.length === 0) return "";

  const headers = anonymize
    ? [
        "prompt", "response", "response_is_corrected", "label", "intent", 
        "model_id", "was_rewritten", "rag_used", "rag_low_confidence", 
        "created_at", "curation_status", "adherence_score", "violations", "diagnosis"
      ]
    : Object.keys(data[0]);

  const escapeCSV = (value: unknown): string => {
    if (value === null || value === undefined) return "";
    const str = typeof value === "object" ? JSON.stringify(value) : String(value);
    // Escapar aspas duplas e envolver em aspas se contiver caracteres especiais
    if (str.includes(",") || str.includes('"') || str.includes("\n")) {
      return `"${str.replace(/"/g, '""')}"`;
    }
    return str;
  };

  const rows = data.map((row) => headers.map((h) => escapeCSV(row[h])).join(","));

  return [headers.join(","), ...rows].join("\n");
}
