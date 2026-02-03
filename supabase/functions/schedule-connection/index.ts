import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";
import webpush from "npm:web-push@3.6.7";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

interface ScheduleRequest {
  buscador_id: string;
  soldado_id: string;
  chat_session_id: string;
  scheduled_at: string; // ISO timestamp
  duration_minutes?: number;
}

interface AvailabilitySlot {
  day_of_week: number;
  start_time: string;
  end_time: string;
}

// Helper to generate Jitsi meeting URL
function generateJitsiUrl(sessionId: string): string {
  const roomName = `zion-${sessionId.substring(0, 8)}`;
  return `https://meet.jit.si/${roomName}`;
}

// Helper to format date for notifications
function formatDateForNotification(date: Date): string {
  return date.toLocaleDateString("pt-BR", {
    weekday: "long",
    day: "2-digit",
    month: "long",
    hour: "2-digit",
    minute: "2-digit",
  });
}

// Send push notification to user
async function sendPushToUser(
  supabaseUrl: string,
  supabaseKey: string,
  userId: string,
  payload: { title: string; body: string; data?: Record<string, string> }
): Promise<void> {
  const supabase = createClient(supabaseUrl, supabaseKey);

  // Get VAPID keys
  const vapidPublicKey = Deno.env.get("VAPID_PUBLIC_KEY");
  const vapidPrivateKey = Deno.env.get("VAPID_PRIVATE_KEY");

  if (!vapidPublicKey || !vapidPrivateKey) {
    console.warn("[Push] VAPID keys not configured");
    return;
  }

  webpush.setVapidDetails(
    "mailto:contato@zion.app",
    vapidPublicKey,
    vapidPrivateKey
  );

  // Get user's push subscriptions
  const { data: subscriptions, error } = await supabase
    .from("push_subscriptions")
    .select("endpoint, p256dh, auth")
    .eq("user_id", userId)
    .eq("is_active", true);

  if (error || !subscriptions?.length) {
    console.log("[Push] No active subscriptions for user:", userId);
    return;
  }

  const pushPayload = JSON.stringify({
    title: payload.title,
    body: payload.body,
    icon: "/icons/icon-192.png",
    badge: "/icons/badge-72.png",
    data: {
      url: payload.data?.url || "/soldado",
      ...payload.data,
    },
  });

  // Send to all subscriptions
  for (const sub of subscriptions) {
    try {
      await webpush.sendNotification(
        {
          endpoint: sub.endpoint,
          keys: {
            p256dh: sub.p256dh,
            auth: sub.auth,
          },
        },
        pushPayload
      );
      console.log("[Push] Notification sent to:", sub.endpoint.substring(0, 50));
    } catch (err) {
      console.warn("[Push] Failed to send:", err);
      // Mark subscription as inactive if it fails
      if ((err as any).statusCode === 410) {
        await supabase
          .from("push_subscriptions")
          .update({ is_active: false })
          .eq("endpoint", sub.endpoint);
      }
    }
  }
}

Deno.serve(async (req) => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const body: ScheduleRequest = await req.json();
    const {
      buscador_id,
      soldado_id,
      chat_session_id,
      scheduled_at,
      duration_minutes = 30,
    } = body;

    console.log("[Schedule] Request:", {
      buscador_id,
      soldado_id,
      chat_session_id,
      scheduled_at,
    });

    // 1. Validate inputs
    if (!buscador_id || !soldado_id || !chat_session_id || !scheduled_at) {
      return new Response(
        JSON.stringify({ success: false, error: "Missing required fields" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const scheduledDate = new Date(scheduled_at);
    if (isNaN(scheduledDate.getTime())) {
      return new Response(
        JSON.stringify({ success: false, error: "Invalid scheduled_at date" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // 2. Validate soldado exists and is available
    const { data: soldadoProfile, error: soldadoError } = await supabase
      .from("soldado_profiles")
      .select("id, display_name, is_available, max_weekly_sessions")
      .eq("id", soldado_id)
      .single();

    if (soldadoError || !soldadoProfile) {
      console.error("[Schedule] Soldado not found:", soldadoError);
      return new Response(
        JSON.stringify({ success: false, error: "Soldado not found" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (!soldadoProfile.is_available) {
      return new Response(
        JSON.stringify({ success: false, error: "Soldado is not available" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // 3. Check for scheduling conflicts (soldado)
    const { data: existingConflict } = await supabase
      .from("connection_sessions")
      .select("id")
      .eq("soldado_id", soldado_id)
      .in("status", ["scheduled", "confirmed"])
      .gte("scheduled_at", new Date(scheduledDate.getTime() - 30 * 60 * 1000).toISOString())
      .lte("scheduled_at", new Date(scheduledDate.getTime() + 30 * 60 * 1000).toISOString())
      .limit(1);

    if (existingConflict && existingConflict.length > 0) {
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: "Soldado has a scheduling conflict at this time" 
        }),
        { status: 409, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // 4. Create connection session
    const sessionData = {
      soldado_id,
      buscador_id,
      chat_session_id,
      scheduled_at: scheduledDate.toISOString(),
      duration_minutes,
      status: "scheduled" as const,
      meeting_url: "", // Will be set after insert with ID
    };

    const { data: session, error: sessionError } = await supabase
      .from("connection_sessions")
      .insert(sessionData)
      .select("id, scheduled_at, duration_minutes, status")
      .single();

    if (sessionError || !session) {
      console.error("[Schedule] Failed to create session:", sessionError);
      return new Response(
        JSON.stringify({ success: false, error: "Failed to create session" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // 5. Generate and update meeting URL
    const meetingUrl = generateJitsiUrl(session.id);
    await supabase
      .from("connection_sessions")
      .update({ meeting_url: meetingUrl })
      .eq("id", session.id);

    // 6. Update chat session matchmaking_state
    await supabase
      .from("chat_sessions")
      .update({
        matchmaking_state: {
          status: "matched",
          soldado_id,
          connection_session_id: session.id,
          matched_at: new Date().toISOString(),
        },
      })
      .eq("id", chat_session_id);

    // 7. Get buscador name for notification
    const { data: buscadorProfile } = await supabase
      .from("profiles")
      .select("nome")
      .eq("id", buscador_id)
      .single();

    const buscadorName = buscadorProfile?.nome || "Um buscador";

    // 8. Send push notification to Soldado (fire and forget)
    sendPushToUser(supabaseUrl, supabaseServiceKey, soldado_id, {
      title: "Nova conexão agendada 📅",
      body: `${buscadorName} quer conversar com você ${formatDateForNotification(scheduledDate)}`,
      data: {
        url: "/soldado",
        session_id: session.id,
      },
    }).catch((err) => console.warn("[Push] Error:", err));

    // 9. Build response
    const endTime = new Date(scheduledDate.getTime() + duration_minutes * 60000);

    const response = {
      success: true,
      session: {
        id: session.id,
        scheduled_at: session.scheduled_at,
        duration_minutes: session.duration_minutes,
        meeting_url: meetingUrl,
        soldado_name: soldadoProfile.display_name || "Soldado",
      },
      calendar_event: {
        title: `Conversa ZION com ${soldadoProfile.display_name || "Soldado"}`,
        description: "Sessão de acompanhamento espiritual no ZION",
        start: scheduledDate.toISOString(),
        end: endTime.toISOString(),
        location: meetingUrl,
      },
    };

    console.log("[Schedule] Success:", response.session.id);

    return new Response(JSON.stringify(response), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("[Schedule] Error:", error);
    return new Response(
      JSON.stringify({ 
        success: false, 
        error: error instanceof Error ? error.message : "Internal server error" 
      }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
