// Zion Service Worker - PWA + Push Notifications
// Versão com timestamp para forçar atualização
const CACHE_VERSION = 'zion-v3-' + '20260201';

// Apenas cachear assets estáticos essenciais
const STATIC_CACHE = [
  '/manifest.json',
  '/icons/icon-192.png',
  '/icons/icon-512.png',
  '/icons/badge-72.png'
];

// Instalação - cachear recursos estáticos
self.addEventListener('install', (event) => {
  console.log('[SW] Installing version:', CACHE_VERSION);
  event.waitUntil(
    caches.open(CACHE_VERSION)
      .then((cache) => cache.addAll(STATIC_CACHE))
      .catch((err) => console.warn('[SW] Cache install failed:', err))
  );
  // Forçar ativação imediata
  self.skipWaiting();
});

// Ativação - limpar caches antigos
self.addEventListener('activate', (event) => {
  console.log('[SW] Activating version:', CACHE_VERSION);
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames
          .filter((name) => name.startsWith('zion-') && name !== CACHE_VERSION)
          .map((name) => {
            console.log('[SW] Deleting old cache:', name);
            return caches.delete(name);
          })
      );
    })
  );
  // Tomar controle imediato de todas as páginas
  self.clients.claim();
});

// Fetch - network first, fallback to cache
// Não cachear HTML dinamicamente para evitar versões desatualizadas
self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);
  
  // Skip non-GET requests
  if (event.request.method !== 'GET') {
    return;
  }
  
  // Skip chrome-extension and other non-http
  if (!url.protocol.startsWith('http')) {
    return;
  }
  
  // Skip API calls e edge functions
  if (url.pathname.startsWith('/functions/') || 
      url.pathname.startsWith('/rest/') ||
      url.pathname.includes('supabase')) {
    return;
  }

  // CRITICAL: Bypass cache for video files (WebM/MP4)
  // Videos use Range Requests (206 Partial Content) which don't work well with simple cache
  if (url.pathname.endsWith('.mp4') || url.pathname.endsWith('.webm')) {
    return; // Let the browser handle it directly (network-only)
  }

  // CRITICAL: Bypass cache for Range Requests (partial content)
  // This is essential for proper video/audio streaming
  if (event.request.headers.get('range')) {
    return; // Let the browser handle it directly (network-only)
  }

  // Para navegação (HTML), sempre buscar da rede
  if (event.request.mode === 'navigate') {
    event.respondWith(
      fetch(event.request)
        .catch(() => {
          // Fallback para cache apenas se offline
          return caches.match('/') || caches.match('/chat');
        })
    );
    return;
  }

  // Para assets estáticos (JS/CSS com hash, imagens), usar cache first
  const isHashedAsset = /\.[a-f0-9]{8,}\.(js|css)$/.test(url.pathname);
  const isStaticAsset = /\.(png|jpg|jpeg|gif|svg|ico|woff2?|webp)$/.test(url.pathname);
  
  if (isHashedAsset || isStaticAsset) {
    event.respondWith(
      caches.match(event.request)
        .then((cached) => {
          if (cached) {
            return cached;
          }
          return fetch(event.request).then((response) => {
            if (response.ok) {
              const responseClone = response.clone();
              caches.open(CACHE_VERSION).then((cache) => {
                cache.put(event.request, responseClone);
              });
            }
            return response;
          });
        })
    );
    return;
  }

  // Para tudo mais, network first
  event.respondWith(
    fetch(event.request)
      .then((response) => {
        return response;
      })
      .catch(() => {
        return caches.match(event.request);
      })
  );
});

// Push notifications
self.addEventListener('push', (event) => {
  console.log('[SW] Push received');
  
  let data = {
    title: 'Zion está com saudades 💚',
    body: 'Faz um tempo que não conversamos. Como você está?',
    icon: '/icons/icon-192.png',
    badge: '/icons/badge-72.png',
    data: { url: '/chat' }
  };

  try {
    if (event.data) {
      data = event.data.json();
    }
  } catch (e) {
    console.warn('[SW] Push data parse error:', e);
  }

  const options = {
    body: data.body,
    icon: data.icon || '/icons/icon-192.png',
    badge: data.badge || '/icons/badge-72.png',
    vibrate: [200, 100, 200],
    data: data.data || { url: '/chat' },
    tag: 'zion-reminder',
    renotify: true,
    actions: [
      { action: 'open', title: 'Conversar agora' },
      { action: 'later', title: 'Mais tarde' }
    ]
  };

  event.waitUntil(
    self.registration.showNotification(data.title, options)
  );
});

// Clique na notificação
self.addEventListener('notificationclick', (event) => {
  console.log('[SW] Notification clicked');
  event.notification.close();

  // Se clicou em "Mais tarde", apenas fecha
  if (event.action === 'later') {
    return;
  }

  const targetUrl = event.notification.data?.url || '/chat';

  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true })
      .then((clientList) => {
        // Procurar janela existente
        for (const client of clientList) {
          if (client.url.includes('/chat') && 'focus' in client) {
            return client.focus();
          }
        }
        // Abrir nova janela
        return self.clients.openWindow(targetUrl);
      })
  );
});

// Mensagem do cliente (para forçar atualização)
self.addEventListener('message', (event) => {
  if (event.data === 'skipWaiting') {
    console.log('[SW] Received skipWaiting message');
    self.skipWaiting();
  }
});
