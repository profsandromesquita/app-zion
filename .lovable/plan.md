
# Plano: Implementar PWA com Notificações Push para Lembrete 48h

## Visão Geral da Arquitetura

```text
+------------------+      +-------------------+      +------------------+
|   App React      |      |   Service Worker  |      |   Edge Function  |
|   (Frontend)     |----->|   (sw.js)         |      |   (CRON)         |
+------------------+      +-------------------+      +------------------+
        |                         |                         |
        v                         v                         v
+------------------+      +-------------------+      +------------------+
|  manifest.json   |      |  Push API         |      |  DB: push_subs   |
|  (Instalação)    |      |  (Notificações)   |      |  + last_active   |
+------------------+      +-------------------+      +------------------+
```

---

## Componentes a Criar/Modificar

| Arquivo | Tipo | Descrição |
|---------|------|-----------|
| `public/manifest.json` | Novo | Manifesto PWA para instalação |
| `public/sw.js` | Novo | Service Worker para notificações push |
| `index.html` | Modificar | Adicionar meta tags PWA e link manifest |
| `src/hooks/usePushNotifications.ts` | Novo | Hook para gerenciar subscrição push |
| `src/components/PushNotificationPrompt.tsx` | Novo | Componente UI para solicitar permissão |
| `supabase/functions/send-push-reminder/index.ts` | Novo | Edge Function CRON para enviar lembretes |
| `supabase/config.toml` | Modificar | Adicionar nova edge function |
| Migração SQL | Novo | Criar tabela `push_subscriptions` e campo `last_active_at` |

---

## 1. Manifesto PWA (public/manifest.json)

```json
{
  "name": "Zion - Companheiro Espiritual",
  "short_name": "Zion",
  "description": "Seu companheiro de jornada espiritual",
  "start_url": "/chat",
  "display": "standalone",
  "background_color": "#0f172a",
  "theme_color": "#10b981",
  "orientation": "portrait-primary",
  "icons": [
    {
      "src": "/icons/icon-192.png",
      "sizes": "192x192",
      "type": "image/png",
      "purpose": "any maskable"
    },
    {
      "src": "/icons/icon-512.png",
      "sizes": "512x512",
      "type": "image/png",
      "purpose": "any maskable"
    }
  ]
}
```

**Nota**: Será necessário criar ícones em `public/icons/` nos tamanhos 192x192 e 512x512 (baseados no logo Zion).

---

## 2. Service Worker (public/sw.js)

```javascript
// Versão do cache
const CACHE_VERSION = 'zion-v1';
const STATIC_CACHE = [
  '/',
  '/chat',
  '/manifest.json'
];

// Instalação
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_VERSION).then((cache) => cache.addAll(STATIC_CACHE))
  );
  self.skipWaiting();
});

// Ativação
self.addEventListener('activate', (event) => {
  event.waitUntil(clients.claim());
});

// Push notifications
self.addEventListener('push', (event) => {
  const data = event.data?.json() || {
    title: 'Zion está com saudades',
    body: 'Faz um tempo que não conversamos. Como você está?',
    icon: '/icons/icon-192.png',
    badge: '/icons/badge-72.png',
    data: { url: '/chat' }
  };

  event.waitUntil(
    self.registration.showNotification(data.title, {
      body: data.body,
      icon: data.icon,
      badge: data.badge,
      vibrate: [200, 100, 200],
      data: data.data,
      actions: [
        { action: 'open', title: 'Conversar agora' },
        { action: 'later', title: 'Mais tarde' }
      ]
    })
  );
});

// Clique na notificação
self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  
  if (event.action === 'later') return;
  
  event.waitUntil(
    clients.matchAll({ type: 'window' }).then((clientList) => {
      for (const client of clientList) {
        if (client.url.includes('/chat') && 'focus' in client) {
          return client.focus();
        }
      }
      return clients.openWindow(event.notification.data?.url || '/chat');
    })
  );
});
```

---

## 3. Migração SQL - Tabela de Subscrições Push

```sql
-- Criar tabela para armazenar subscrições push
CREATE TABLE public.push_subscriptions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  endpoint text NOT NULL,
  p256dh text NOT NULL,
  auth text NOT NULL,
  device_info jsonb DEFAULT '{}',
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  is_active boolean DEFAULT true,
  UNIQUE(user_id, endpoint)
);

-- Adicionar campo last_active_at na tabela profiles
ALTER TABLE public.profiles 
ADD COLUMN IF NOT EXISTS last_active_at timestamptz DEFAULT now();

-- Índice para busca de usuários inativos
CREATE INDEX idx_profiles_last_active 
ON public.profiles(last_active_at) 
WHERE last_active_at IS NOT NULL;

-- RLS para push_subscriptions
ALTER TABLE public.push_subscriptions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage own subscriptions"
ON public.push_subscriptions FOR ALL
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Service can read all subscriptions"
ON public.push_subscriptions FOR SELECT
USING (true);
```

---

## 4. Hook usePushNotifications.ts

```typescript
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
      const isSupported = 'serviceWorker' in navigator && 
                          'PushManager' in window && 
                          'Notification' in window;
      
      if (!isSupported) {
        setState(s => ({ ...s, isSupported: false, isLoading: false }));
        return;
      }

      const permission = Notification.permission;
      
      // Verificar se já está inscrito
      let isSubscribed = false;
      if (userId && permission === 'granted') {
        const registration = await navigator.serviceWorker.ready;
        const subscription = await registration.pushManager.getSubscription();
        isSubscribed = !!subscription;
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

    setState(s => ({ ...s, isLoading: true }));

    try {
      // Solicitar permissão
      const permission = await Notification.requestPermission();
      if (permission !== 'granted') {
        setState(s => ({ ...s, permission, isLoading: false }));
        return false;
      }

      // Registrar service worker
      const registration = await navigator.serviceWorker.register('/sw.js');
      await navigator.serviceWorker.ready;

      // Buscar VAPID public key do backend
      const { data: vapidKey } = await supabase.functions.invoke('get-vapid-key');
      
      // Criar subscrição push
      const subscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: vapidKey.publicKey,
      });

      // Salvar no banco
      const subscriptionJson = subscription.toJSON();
      await supabase.from('push_subscriptions').upsert({
        user_id: userId,
        endpoint: subscription.endpoint,
        p256dh: subscriptionJson.keys?.p256dh || '',
        auth: subscriptionJson.keys?.auth || '',
        device_info: {
          userAgent: navigator.userAgent,
          platform: navigator.platform,
        },
        is_active: true,
        updated_at: new Date().toISOString(),
      }, {
        onConflict: 'user_id,endpoint',
      });

      setState({
        isSupported: true,
        isSubscribed: true,
        isLoading: false,
        permission: 'granted',
      });

      return true;
    } catch (error) {
      console.error('Push subscription failed:', error);
      setState(s => ({ ...s, isLoading: false }));
      return false;
    }
  }, [userId, state.isSupported]);

  // Cancelar subscrição
  const unsubscribe = useCallback(async () => {
    if (!userId) return;

    try {
      const registration = await navigator.serviceWorker.ready;
      const subscription = await registration.pushManager.getSubscription();
      
      if (subscription) {
        await subscription.unsubscribe();
        await supabase.from('push_subscriptions')
          .delete()
          .eq('user_id', userId)
          .eq('endpoint', subscription.endpoint);
      }

      setState(s => ({ ...s, isSubscribed: false }));
    } catch (error) {
      console.error('Unsubscribe failed:', error);
    }
  }, [userId]);

  return { ...state, subscribe, unsubscribe };
}
```

---

## 5. Edge Function: send-push-reminder

```typescript
import { createClient } from 'jsr:@supabase/supabase-js@2';
import webpush from 'npm:web-push@3.6.7';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  );

  // Configurar VAPID
  webpush.setVapidDetails(
    'mailto:contato@zion.app',
    Deno.env.get('VAPID_PUBLIC_KEY')!,
    Deno.env.get('VAPID_PRIVATE_KEY')!
  );

  // Buscar usuários inativos há 48h com subscrição push ativa
  const cutoffTime = new Date(Date.now() - 48 * 60 * 60 * 1000).toISOString();
  
  const { data: inactiveUsers, error } = await supabase
    .from('profiles')
    .select(`
      id,
      nome,
      last_active_at,
      push_subscriptions!inner(endpoint, p256dh, auth, is_active)
    `)
    .lt('last_active_at', cutoffTime)
    .eq('push_subscriptions.is_active', true);

  if (error) {
    console.error('Error fetching inactive users:', error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  const results = {
    sent: 0,
    failed: 0,
    errors: [] as string[],
  };

  // Enviar notificações
  for (const user of inactiveUsers || []) {
    for (const sub of user.push_subscriptions) {
      try {
        const payload = JSON.stringify({
          title: 'Zion está com saudades 💚',
          body: user.nome 
            ? `Oi ${user.nome}, faz um tempo que não conversamos. Como você está?`
            : 'Faz um tempo que não conversamos. Como você está?',
          icon: '/icons/icon-192.png',
          badge: '/icons/badge-72.png',
          data: { url: '/chat' },
        });

        await webpush.sendNotification(
          {
            endpoint: sub.endpoint,
            keys: { p256dh: sub.p256dh, auth: sub.auth },
          },
          payload
        );

        results.sent++;
      } catch (err: any) {
        results.failed++;
        results.errors.push(`User ${user.id}: ${err.message}`);

        // Se endpoint inválido, desativar subscrição
        if (err.statusCode === 410 || err.statusCode === 404) {
          await supabase
            .from('push_subscriptions')
            .update({ is_active: false })
            .eq('endpoint', sub.endpoint);
        }
      }
    }
  }

  console.log('Push reminder results:', results);

  return new Response(JSON.stringify(results), {
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
});
```

---

## 6. Edge Function: get-vapid-key

```typescript
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  return new Response(
    JSON.stringify({ publicKey: Deno.env.get('VAPID_PUBLIC_KEY') }),
    { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
  );
});
```

---

## 7. Atualizar last_active_at ao Interagir

No `Chat.tsx`, após enviar mensagem:

```typescript
// Atualizar última atividade do usuário
if (user?.id) {
  supabase.from('profiles')
    .update({ last_active_at: new Date().toISOString() })
    .eq('id', user.id)
    .then(() => {});
}
```

---

## 8. Componente PushNotificationPrompt

```tsx
import { Bell, BellOff } from "lucide-react";
import { Button } from "@/components/ui/button";
import { usePushNotifications } from "@/hooks/usePushNotifications";

interface Props {
  userId: string | null;
}

export function PushNotificationPrompt({ userId }: Props) {
  const { isSupported, isSubscribed, isLoading, permission, subscribe, unsubscribe } = 
    usePushNotifications(userId);

  if (!isSupported || permission === 'denied') return null;

  if (isSubscribed) {
    return (
      <Button 
        variant="ghost" 
        size="sm" 
        onClick={unsubscribe}
        className="text-muted-foreground"
      >
        <Bell className="h-4 w-4 mr-2 text-emerald-500" />
        Notificações ativas
      </Button>
    );
  }

  return (
    <Button
      variant="outline"
      size="sm"
      onClick={subscribe}
      disabled={isLoading}
      className="border-emerald-500/50 hover:border-emerald-500 hover:bg-emerald-50 dark:hover:bg-emerald-950/30"
    >
      <BellOff className="h-4 w-4 mr-2" />
      Ativar lembretes
    </Button>
  );
}
```

---

## 9. Modificações no index.html

```html
<!doctype html>
<html lang="pt-BR">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0, viewport-fit=cover" />
    
    <!-- PWA Meta Tags -->
    <meta name="theme-color" content="#10b981" />
    <meta name="apple-mobile-web-app-capable" content="yes" />
    <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
    <meta name="apple-mobile-web-app-title" content="Zion" />
    
    <title>Zion - Companheiro Espiritual</title>
    <meta name="description" content="Seu companheiro de jornada espiritual" />
    
    <!-- Manifest -->
    <link rel="manifest" href="/manifest.json" />
    
    <!-- Ícones Apple -->
    <link rel="apple-touch-icon" href="/icons/icon-192.png" />
    
    <!-- Favicon -->
    <link rel="icon" href="/favicon.ico" type="image/x-icon" />
    
    <!-- OG Tags -->
    <meta property="og:title" content="Zion - Companheiro Espiritual" />
    <meta property="og:description" content="Seu companheiro de jornada espiritual" />
    <meta property="og:type" content="website" />
    <meta property="og:image" content="/icons/icon-512.png" />
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="/src/main.tsx"></script>
  </body>
</html>
```

---

## 10. Registrar Service Worker (main.tsx)

```typescript
import React from "react";
import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";

// Registrar Service Worker para PWA
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js')
      .then((registration) => {
        console.log('SW registered:', registration.scope);
      })
      .catch((error) => {
        console.log('SW registration failed:', error);
      });
  });
}

createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
```

---

## 11. CRON Job para Enviar Lembretes

Executar SQL para agendar o job (roda a cada 6 horas):

```sql
SELECT cron.schedule(
  'push-reminder-48h',
  '0 */6 * * *',
  $$
  SELECT net.http_post(
    url := 'https://nqbagdwufarytluhaaas.supabase.co/functions/v1/send-push-reminder',
    headers := '{"Authorization": "Bearer <ANON_KEY>", "Content-Type": "application/json"}'::jsonb,
    body := '{}'::jsonb
  ) AS request_id;
  $$
);
```

---

## Secrets Necessários

| Secret | Descrição |
|--------|-----------|
| `VAPID_PUBLIC_KEY` | Chave pública VAPID para Web Push |
| `VAPID_PRIVATE_KEY` | Chave privada VAPID para Web Push |

**Nota**: As chaves VAPID podem ser geradas com `npx web-push generate-vapid-keys`.

---

## Resumo de Arquivos

| Arquivo | Ação |
|---------|------|
| `public/manifest.json` | Criar |
| `public/sw.js` | Criar |
| `public/icons/icon-192.png` | Criar (gerar do logo) |
| `public/icons/icon-512.png` | Criar (gerar do logo) |
| `public/icons/badge-72.png` | Criar (ícone monocromático) |
| `index.html` | Modificar |
| `src/main.tsx` | Modificar |
| `src/hooks/usePushNotifications.ts` | Criar |
| `src/components/PushNotificationPrompt.tsx` | Criar |
| `src/pages/Chat.tsx` | Modificar (atualizar last_active_at) |
| `supabase/functions/send-push-reminder/index.ts` | Criar |
| `supabase/functions/get-vapid-key/index.ts` | Criar |
| `supabase/config.toml` | Modificar |
| Migração SQL | Criar (tabela + campo) |

---

## Fluxo Completo

```text
1. Usuário acessa o app
   ↓
2. Service Worker é registrado
   ↓
3. Prompt de notificação aparece
   ↓
4. Usuário aceita → Subscrição salva no DB
   ↓
5. Cada interação atualiza last_active_at
   ↓
6. CRON roda a cada 6h:
   - Busca usuários com last_active_at < 48h atrás
   - Envia push notification
   ↓
7. Usuário recebe notificação no celular/desktop
   ↓
8. Clique abre o app direto no /chat
```

---

## Resultado Esperado

- **Instalável**: Botão "Adicionar à tela inicial" disponível
- **Offline-capable**: Cache básico para carregamento inicial
- **Notificações**: Lembrete automático após 48h de inatividade
- **Personalizado**: Mensagem com nome do usuário
- **Baixo consumo**: Service Worker leve (~2KB), sem impacto na bateria
