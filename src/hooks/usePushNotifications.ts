import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";

interface PushState {
  isSupported: boolean;
  isSubscribed: boolean;
  isLoading: boolean;
  permission: NotificationPermission | null;
}

export function usePushNotifications(userId: string | null) {
  const [state, setState] = useState<PushState>({
    isSupported: false,
    isSubscribed: false,
    isLoading: true,
    permission: null,
  });

  // Verificar suporte e status atual
  useEffect(() => {
    const checkSupport = async () => {
      const isSupported =
        "serviceWorker" in navigator &&
        "PushManager" in window &&
        "Notification" in window;

      if (!isSupported) {
        setState((s) => ({ ...s, isSupported: false, isLoading: false }));
        return;
      }

      const permission = Notification.permission;

      // Verificar se já está inscrito
      let isSubscribed = false;
      if (userId && permission === "granted") {
        try {
          const registration = await navigator.serviceWorker.ready;
          const subscription = await registration.pushManager.getSubscription();
          isSubscribed = !!subscription;
        } catch (err) {
          console.warn("Error checking push subscription:", err);
        }
      }

      setState({
        isSupported: true,
        isSubscribed,
        isLoading: false,
        permission,
      });
    };

    checkSupport();
  }, [userId]);

  // Solicitar permissão e inscrever
  const subscribe = useCallback(async () => {
    if (!userId || !state.isSupported) return false;

    setState((s) => ({ ...s, isLoading: true }));

    try {
      // Solicitar permissão
      const permission = await Notification.requestPermission();
      if (permission !== "granted") {
        setState((s) => ({ ...s, permission, isLoading: false }));
        return false;
      }

      // Registrar service worker se necessário
      let registration = await navigator.serviceWorker.getRegistration();
      if (!registration) {
        registration = await navigator.serviceWorker.register("/sw.js");
      }
      await navigator.serviceWorker.ready;

      // Buscar VAPID public key do backend
      const { data: vapidData, error: vapidError } =
        await supabase.functions.invoke("get-vapid-key");

      if (vapidError || !vapidData?.publicKey) {
        console.error("Failed to get VAPID key:", vapidError);
        setState((s) => ({ ...s, isLoading: false }));
        return false;
      }

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
      const subscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(vapidData.publicKey),
      });

      // Salvar no banco
      const subscriptionJson = subscription.toJSON();
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
            },
            is_active: true,
            updated_at: new Date().toISOString(),
          },
          {
            onConflict: "user_id,endpoint",
          }
        );

      if (saveError) {
        console.error("Failed to save push subscription:", saveError);
        setState((s) => ({ ...s, isLoading: false }));
        return false;
      }

      setState({
        isSupported: true,
        isSubscribed: true,
        isLoading: false,
        permission: "granted",
      });

      return true;
    } catch (error) {
      console.error("Push subscription failed:", error);
      setState((s) => ({ ...s, isLoading: false }));
      return false;
    }
  }, [userId, state.isSupported]);

  // Cancelar subscrição
  const unsubscribe = useCallback(async () => {
    if (!userId) return;

    setState((s) => ({ ...s, isLoading: true }));

    try {
      const registration = await navigator.serviceWorker.ready;
      const subscription = await registration.pushManager.getSubscription();

      if (subscription) {
        await subscription.unsubscribe();
        await supabase
          .from("push_subscriptions")
          .delete()
          .eq("user_id", userId)
          .eq("endpoint", subscription.endpoint);
      }

      setState((s) => ({ ...s, isSubscribed: false, isLoading: false }));
    } catch (error) {
      console.error("Unsubscribe failed:", error);
      setState((s) => ({ ...s, isLoading: false }));
    }
  }, [userId]);

  return { ...state, subscribe, unsubscribe };
}
