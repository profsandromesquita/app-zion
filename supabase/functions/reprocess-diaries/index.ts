import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { batch_size = 20 } = await req.json().catch(() => ({}));

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // Fetch all diary entries with content >= 10 chars
    const { data: allEntries, error } = await supabase
      .from("diary_entries")
      .select("id, content, user_id, io_analysis")
      .order("created_at", { ascending: true });

    if (error) {
      console.error("Error fetching diary entries:", error);
      return new Response(
        JSON.stringify({ error: error.message }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Filter: content >= 10 chars AND (no io_analysis OR no primary_category)
    const pending = (allEntries || []).filter((e: any) => {
      if (!e.content || e.content.trim().length < 10) return false;
      if (!e.io_analysis) return true;
      if (typeof e.io_analysis === "object" && !e.io_analysis.primary_category) return true;
      return false;
    });

    const total = pending.length;
    const batch = pending.slice(0, batch_size);
    let processed = 0;

    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    for (const entry of batch) {
      try {
        const resp = await fetch(`${SUPABASE_URL}/functions/v1/analyze-diary`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
          },
          body: JSON.stringify({
            diary_entry_id: entry.id,
            content: entry.content,
            user_id: entry.user_id,
          }),
        });

        if (resp.ok) {
          processed++;
        } else {
          console.error(`Failed to process entry ${entry.id}: ${resp.status}`);
        }
      } catch (err) {
        console.error(`Error processing entry ${entry.id}:`, err);
      }

      // Delay between calls to avoid rate limits
      if (batch.indexOf(entry) < batch.length - 1) {
        await new Promise((r) => setTimeout(r, 1500));
      }
    }

    const remaining = total - processed;

    return new Response(
      JSON.stringify({ processed, remaining, total }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    console.error("reprocess-diaries error:", err);
    return new Response(
      JSON.stringify({ error: err instanceof Error ? err.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
