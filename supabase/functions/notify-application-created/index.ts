import webPush from "npm:web-push@3.6.7";
import { createClient } from "npm:@supabase/supabase-js@2.49.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

interface NotifyApplicationRequest {
  user_id: string;
  application_id: string;
  sponsor_name?: string;
}

async function sendPushToUser(
  supabaseUrl: string,
  supabaseKey: string,
  userId: string,
  notification: {
    title: string;
    body: string;
    data?: Record<string, string>;
  }
): Promise<{ sent: number; failed: number }> {
  const supabase = createClient(supabaseUrl, supabaseKey);

  // Get VAPID keys
  const vapidPublicKey = Deno.env.get("VAPID_PUBLIC_KEY");
  const vapidPrivateKey = Deno.env.get("VAPID_PRIVATE_KEY");

  if (!vapidPublicKey || !vapidPrivateKey) {
    console.error("VAPID keys not configured");
    return { sent: 0, failed: 0 };
  }

  webPush.setVapidDetails(
    "mailto:suporte@zion.app",
    vapidPublicKey,
    vapidPrivateKey
  );

  // Get user's push subscriptions
  const { data: subscriptions, error } = await supabase
    .from("push_subscriptions")
    .select("id, endpoint, p256dh, auth")
    .eq("user_id", userId)
    .eq("is_active", true);

  if (error || !subscriptions || subscriptions.length === 0) {
    console.log(`No active subscriptions for user ${userId}`);
    return { sent: 0, failed: 0 };
  }

  console.log(`Found ${subscriptions.length} subscriptions for user ${userId}`);

  const payload = JSON.stringify({
    title: notification.title,
    body: notification.body,
    icon: "/icons/icon-192.png",
    badge: "/icons/badge-72.png",
    data: notification.data || {},
  });

  let sent = 0;
  let failed = 0;

  for (const sub of subscriptions) {
    try {
      await webPush.sendNotification(
        {
          endpoint: sub.endpoint,
          keys: {
            p256dh: sub.p256dh,
            auth: sub.auth,
          },
        },
        payload
      );
      sent++;
      console.log(`Push sent to subscription ${sub.id}`);
    } catch (err: unknown) {
      const error = err as { statusCode?: number; message?: string };
      console.error(`Failed to send to subscription ${sub.id}:`, error.message);
      failed++;

      // Mark subscription as inactive if it's a 410 Gone or 404 Not Found
      if (error.statusCode === 410 || error.statusCode === 404) {
        await supabase
          .from("push_subscriptions")
          .update({ is_active: false })
          .eq("id", sub.id);
        console.log(`Marked subscription ${sub.id} as inactive`);
      }
    }
  }

  return { sent, failed };
}

Deno.serve(async (req) => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const body: NotifyApplicationRequest = await req.json();
    const { user_id, application_id, sponsor_name } = body;

    if (!user_id || !application_id) {
      return new Response(
        JSON.stringify({ error: "user_id and application_id are required" }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    console.log(`[notify-application-created] Notifying user ${user_id} for application ${application_id}`);

    // Get user name for personalization
    const { data: profile } = await supabase
      .from("profiles")
      .select("nome")
      .eq("id", user_id)
      .maybeSingle();

    const userName = profile?.nome || "";
    const greeting = userName ? `${userName}, v` : "V";

    // Send push notification
    const result = await sendPushToUser(supabaseUrl, supabaseKey, user_id, {
      title: "Você foi indicado para Soldado! 🎖️",
      body: `${greeting}ocê foi reconhecido por sua jornada de transformação. Acesse seu perfil para gravar seu testemunho.`,
      data: {
        url: "/profile",
        application_id: application_id,
      },
    });

    console.log(`[notify-application-created] Push result:`, result);

    return new Response(
      JSON.stringify({
        success: true,
        push_sent: result.sent,
        push_failed: result.failed,
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (error) {
    console.error("[notify-application-created] Error:", error);
    return new Response(
      JSON.stringify({ error: "Internal server error" }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
