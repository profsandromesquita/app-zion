import { useState, useEffect, useCallback, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";

export type SupportStatus = "checking" | "supported" | "unsupported";
export type UnsupportedReason = 
  | "no-service-worker" 
  | "no-push-manager" 
  | "no-notification" 
  | "not-secure-context"
  | "ios-not-standalone"
  | null;

interface PushState {
  isSupported: boolean;
  supportStatus: SupportStatus;
  unsupportedReason: UnsupportedReason;
  isSubscribed: boolean;
  isLoading: boolean;
  permission: NotificationPermission | null;
  isIOS: boolean;
  isInStandaloneMode: boolean;
}

export function usePushNotifications(userId: string | null) {
  const [state, setState] = useState<PushState>({
    isSupported: false,
    supportStatus: "checking",
    unsupportedReason: null,
    isSubscribed: false,
    isLoading: true,
    permission: null,
    isIOS: false,
    isInStandaloneMode: false,
  });

  // Detectar iOS e modo standalone
  const { isIOS, isInStandaloneMode } = useMemo(() => {
    if (typeof window === "undefined") {
      return { isIOS: false, isInStandaloneMode: false };
    }
    const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent);
    const isInStandaloneMode = window.matchMedia("(display-mode: standalone)").matches;
    return { isIOS, isInStandaloneMode };
  }, []);

  // Verificar suporte e status atual
  useEffect(() => {
    const checkSupport = async () => {
      console.log("[Push] Checking support...");
      console.log("[Push] serviceWorker:", "serviceWorker" in navigator);
      console.log("[Push] PushManager:", "PushManager" in window);
      console.log("[Push] Notification:", "Notification" in window);
      console.log("[Push] isIOS:", isIOS);
      console.log("[Push] isInStandaloneMode:", isInStandaloneMode);
      console.log("[Push] isSecureContext:", window.isSecureContext);

      // Verificar razões específicas de não suporte
      let unsupportedReason: UnsupportedReason = null;

      if (!window.isSecureContext) {
        unsupportedReason = "not-secure-context";
      } else if (!("serviceWorker" in navigator)) {
        unsupportedReason = "no-service-worker";
      } else if (!("PushManager" in window)) {
        unsupportedReason = "no-push-manager";
      } else if (!("Notification" in window)) {
        unsupportedReason = "no-notification";
      } else if (isIOS && !isInStandaloneMode) {
        // iOS Safari normal (não instalado) - Push não funciona
        unsupportedReason = "ios-not-standalone";
      }

      const isSupported =
        "serviceWorker" in navigator &&
        "PushManager" in window &&
        "Notification" in window &&
        !(isIOS && !isInStandaloneMode); // iOS precisa estar em standalone

      console.log("[Push] isSupported:", isSupported);
      console.log("[Push] unsupportedReason:", unsupportedReason);

      if (!isSupported) {
        console.log("[Push] Push notifications not supported on this device/browser");
        setState((s) => ({ 
          ...s, 
          isSupported: false,
          supportStatus: "unsupported",
          unsupportedReason,
          isLoading: false,
          isIOS,
          isInStandaloneMode,
        }));
        return;
      }

      const permission = Notification.permission;
      console.log("[Push] Notification.permission:", permission);

      // Verificar se já está inscrito
      let isSubscribed = false;
      if (userId && permission === "granted") {
        try {
          const registration = await navigator.serviceWorker.ready;
          console.log("[Push] Service Worker ready:", registration);
          const subscription = await registration.pushManager.getSubscription();
          isSubscribed = !!subscription;
          console.log("[Push] Existing subscription:", isSubscribed);
        } catch (err) {
          console.warn("[Push] Error checking push subscription:", err);
        }
      }

      setState({
        isSupported: true,
        supportStatus: "supported",
        unsupportedReason: null,
        isSubscribed,
        isLoading: false,
        permission,
        isIOS,
        isInStandaloneMode,
      });
    };

    checkSupport();
  }, [userId, isIOS, isInStandaloneMode]);

  // Solicitar permissão e inscrever
  const subscribe = useCallback(async () => {
    if (!userId || !state.isSupported) {
      console.log("[Push] Cannot subscribe: userId=", userId, "isSupported=", state.isSupported);
      return false;
    }

    setState((s) => ({ ...s, isLoading: true }));
    console.log("[Push] Starting subscription process...");

    try {
      // Solicitar permissão
      console.log("[Push] Requesting notification permission...");
      const permission = await Notification.requestPermission();
      console.log("[Push] Permission result:", permission);
      
      if (permission !== "granted") {
        setState((s) => ({ ...s, permission, isLoading: false }));
        return false;
      }

      // Registrar service worker se necessário
      let registration = await navigator.serviceWorker.getRegistration();
      console.log("[Push] Existing SW registration:", registration);
      
      if (!registration) {
        console.log("[Push] Registering new service worker...");
        registration = await navigator.serviceWorker.register("/sw.js");
        console.log("[Push] SW registered:", registration);
      }
      await navigator.serviceWorker.ready;
      console.log("[Push] SW ready");

      // Buscar VAPID public key do backend
      console.log("[Push] Fetching VAPID key...");
      const { data: vapidData, error: vapidError } =
        await supabase.functions.invoke("get-vapid-key");

      if (vapidError || !vapidData?.publicKey) {
        console.error("[Push] Failed to get VAPID key:", vapidError);
        setState((s) => ({ ...s, isLoading: false }));
        return false;
      }
      console.log("[Push] VAPID key received");

      // Converter VAPID key para Uint8Array
      const urlBase64ToUint8Array = (base64String: string) => {
        const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
        const base64 = (base64String + padding)
          .replace(/-/g, "+")
          .replace(/_/g, "/");
        const rawData = window.atob(base64);
        const outputArray = new Uint8Array(rawData.length);
        for (let i = 0; i < rawData.length; ++i) {
          outputArray[i] = rawData.charCodeAt(i);
        }
        return outputArray;
      };

      // Criar subscrição push
      console.log("[Push] Creating push subscription...");
      const subscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(vapidData.publicKey),
      });
      console.log("[Push] Subscription created:", subscription.endpoint);

      // Salvar no banco
      const subscriptionJson = subscription.toJSON();
      console.log("[Push] Saving subscription to database...");
      const { error: saveError } = await supabase
        .from("push_subscriptions")
        .upsert(
          {
            user_id: userId,
            endpoint: subscription.endpoint,
            p256dh: subscriptionJson.keys?.p256dh || "",
            auth: subscriptionJson.keys?.auth || "",
            device_info: {
              userAgent: navigator.userAgent,
              platform: navigator.platform,
              language: navigator.language,
              isIOS,
              isInStandaloneMode,
            },
            is_active: true,
            updated_at: new Date().toISOString(),
          },
          {
            onConflict: "user_id,endpoint",
          }
        );

      if (saveError) {
        console.error("[Push] Failed to save push subscription:", saveError);
        setState((s) => ({ ...s, isLoading: false }));
        return false;
      }

      console.log("[Push] Subscription saved successfully!");
      setState({
        isSupported: true,
        supportStatus: "supported",
        unsupportedReason: null,
        isSubscribed: true,
        isLoading: false,
        permission: "granted",
        isIOS,
        isInStandaloneMode,
      });

      return true;
    } catch (error) {
      console.error("[Push] Push subscription failed:", error);
      setState((s) => ({ ...s, isLoading: false }));
      return false;
    }
  }, [userId, state.isSupported, isIOS, isInStandaloneMode]);

  // Cancelar subscrição
  const unsubscribe = useCallback(async () => {
    if (!userId) return;

    setState((s) => ({ ...s, isLoading: true }));
    console.log("[Push] Starting unsubscribe process...");

    try {
      const registration = await navigator.serviceWorker.ready;
      const subscription = await registration.pushManager.getSubscription();

      if (subscription) {
        console.log("[Push] Unsubscribing from push...");
        await subscription.unsubscribe();
        await supabase
          .from("push_subscriptions")
          .delete()
          .eq("user_id", userId)
          .eq("endpoint", subscription.endpoint);
        console.log("[Push] Unsubscribed successfully");
      }

      setState((s) => ({ ...s, isSubscribed: false, isLoading: false }));
    } catch (error) {
      console.error("[Push] Unsubscribe failed:", error);
      setState((s) => ({ ...s, isLoading: false }));
    }
  }, [userId]);

  return { ...state, subscribe, unsubscribe };
}
