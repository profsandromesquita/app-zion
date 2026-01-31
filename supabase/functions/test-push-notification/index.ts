import { createClient } from "jsr:@supabase/supabase-js@2";
import webpush from "npm:web-push@3.6.7";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

interface PushSubscription {
  id: string;
  endpoint: string;
  p256dh: string;
  auth: string;
  user_id: string;
}

async function sendPushNotification(
  subscription: PushSubscription,
  vapidPublicKey: string,
  vapidPrivateKey: string
): Promise<boolean> {
  try {
    webpush.setVapidDetails(
      "mailto:contato@zion.app",
      vapidPublicKey,
      vapidPrivateKey
    );

    const pushSubscription = {
      endpoint: subscription.endpoint,
      keys: {
        p256dh: subscription.p256dh,
        auth: subscription.auth,
      },
    };

    const payload = JSON.stringify({
      title: "🔔 Teste de Notificação",
      body: "Se você está vendo isso, as notificações push estão funcionando!",
      icon: "/icons/icon-192.png",
      badge: "/icons/badge-72.png",
      data: {
        url: "/chat",
        timestamp: Date.now(),
      },
    });

    await webpush.sendNotification(pushSubscription, payload);
    console.log(`[TestPush] Notification sent to user ${subscription.user_id}`);
    return true;
  } catch (error: unknown) {
    const err = error as { statusCode?: number; message?: string };
    console.error(`[TestPush] Failed to send notification:`, err);
    
    // Se a subscription expirou ou é inválida
    if (err.statusCode === 410 || err.statusCode === 404) {
      console.log(`[TestPush] Subscription expired for user ${subscription.user_id}`);
    }
    return false;
  }
}

Deno.serve(async (req) => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    // Verificar autenticação
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: "Missing authorization header" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const vapidPublicKey = Deno.env.get("VAPID_PUBLIC_KEY")!;
    const vapidPrivateKey = Deno.env.get("VAPID_PRIVATE_KEY")!;

    // Criar cliente com service role mas verificar token do usuário
    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);

    // Extrair e verificar o token JWT
    const token = authHeader.replace("Bearer ", "");
    const { data: { user }, error: authError } = await supabaseAdmin.auth.getUser(token);
    
    if (authError || !user) {
      console.error("[TestPush] Auth error:", authError);
      return new Response(
        JSON.stringify({ error: "Invalid authorization" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log(`[TestPush] Testing push for user ${user.id}`);

    // Buscar subscrições do usuário
    const { data: subscriptions, error: subError } = await supabaseAdmin
      .from("push_subscriptions")
      .select("*")
      .eq("user_id", user.id)
      .eq("is_active", true);

    if (subError) {
      console.error("[TestPush] Error fetching subscriptions:", subError);
      return new Response(
        JSON.stringify({ error: "Failed to fetch subscriptions" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (!subscriptions || subscriptions.length === 0) {
      return new Response(
        JSON.stringify({ 
          success: false, 
          message: "Nenhuma subscrição ativa encontrada. Ative as notificações primeiro clicando no ícone do sino." 
        }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log(`[TestPush] Found ${subscriptions.length} active subscriptions`);

    // Enviar notificação para cada dispositivo
    let successCount = 0;
    let failCount = 0;

    for (const sub of subscriptions) {
      const success = await sendPushNotification(
        sub as PushSubscription,
        vapidPublicKey,
        vapidPrivateKey
      );
      
      if (success) {
        successCount++;
      } else {
        failCount++;
        // Marcar subscrição como inativa se falhou
        await supabaseAdmin
          .from("push_subscriptions")
          .update({ is_active: false })
          .eq("id", sub.id);
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        message: `Notificação de teste enviada! ${successCount} dispositivo(s) notificado(s).`,
        details: {
          total: subscriptions.length,
          success: successCount,
          failed: failCount,
        },
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("[TestPush] Unexpected error:", error);
    return new Response(
      JSON.stringify({ error: "Internal server error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
