import { createClient } from "jsr:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

// Web Push utilities (using web-push npm package)
import webpush from "npm:web-push@3.6.7";

Deno.serve(async (req) => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  console.log("Starting push reminder job...");

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // Configure VAPID
    const vapidPublicKey = Deno.env.get("VAPID_PUBLIC_KEY");
    const vapidPrivateKey = Deno.env.get("VAPID_PRIVATE_KEY");

    if (!vapidPublicKey || !vapidPrivateKey) {
      console.error("VAPID keys not configured");
      return new Response(
        JSON.stringify({ error: "VAPID keys not configured" }),
        {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    webpush.setVapidDetails(
      "mailto:contato@zion.app",
      vapidPublicKey,
      vapidPrivateKey
    );

    // Calculate 48h cutoff time
    const cutoffTime = new Date(Date.now() - 48 * 60 * 60 * 1000).toISOString();
    console.log("Looking for users inactive since:", cutoffTime);

    // Fetch inactive users with active push subscriptions
    // Query profiles and join with push_subscriptions
    const { data: profiles, error: profilesError } = await supabase
      .from("profiles")
      .select("id, nome, last_active_at")
      .lt("last_active_at", cutoffTime);

    if (profilesError) {
      console.error("Error fetching profiles:", profilesError);
      return new Response(
        JSON.stringify({ error: profilesError.message }),
        {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    if (!profiles || profiles.length === 0) {
      console.log("No inactive users found");
      return new Response(
        JSON.stringify({ sent: 0, failed: 0, message: "No inactive users" }),
        {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    console.log(`Found ${profiles.length} inactive users`);

    // Get subscriptions for these users
    const userIds = profiles.map((p) => p.id);
    const { data: subscriptions, error: subsError } = await supabase
      .from("push_subscriptions")
      .select("user_id, endpoint, p256dh, auth")
      .in("user_id", userIds)
      .eq("is_active", true);

    if (subsError) {
      console.error("Error fetching subscriptions:", subsError);
      return new Response(
        JSON.stringify({ error: subsError.message }),
        {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    if (!subscriptions || subscriptions.length === 0) {
      console.log("No active subscriptions found for inactive users");
      return new Response(
        JSON.stringify({ sent: 0, failed: 0, message: "No subscriptions" }),
        {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    console.log(`Found ${subscriptions.length} active subscriptions`);

    // Create user lookup map
    const userMap = new Map(profiles.map((p) => [p.id, p]));

    const results = {
      sent: 0,
      failed: 0,
      errors: [] as string[],
    };

    // Send notifications
    for (const sub of subscriptions) {
      const user = userMap.get(sub.user_id);
      if (!user) continue;

      try {
        const payload = JSON.stringify({
          title: "Zion está com saudades 💚",
          body: user.nome
            ? `Oi ${user.nome}, faz um tempo que não conversamos. Como você está?`
            : "Faz um tempo que não conversamos. Como você está?",
          icon: "/icons/icon-192.png",
          badge: "/icons/badge-72.png",
          data: { url: "/chat" },
        });

        await webpush.sendNotification(
          {
            endpoint: sub.endpoint,
            keys: { p256dh: sub.p256dh, auth: sub.auth },
          },
          payload
        );

        results.sent++;
        console.log(`Sent notification to user ${sub.user_id}`);
      } catch (err: unknown) {
        results.failed++;
        const errorMessage = err instanceof Error ? err.message : String(err);
        results.errors.push(`User ${sub.user_id}: ${errorMessage}`);
        console.error(`Failed to send to ${sub.user_id}:`, errorMessage);

        // If endpoint invalid (410 Gone or 404), deactivate subscription
        const statusCode = (err as { statusCode?: number })?.statusCode;
        if (statusCode === 410 || statusCode === 404) {
          console.log(`Deactivating invalid subscription for ${sub.user_id}`);
          await supabase
            .from("push_subscriptions")
            .update({ is_active: false, updated_at: new Date().toISOString() })
            .eq("endpoint", sub.endpoint);
        }
      }
    }

    console.log("Push reminder results:", results);

    return new Response(JSON.stringify(results), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("Error in send-push-reminder:", error);
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
