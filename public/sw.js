// Zion Service Worker - PWA + Push Notifications
const CACHE_VERSION = 'zion-v1';
const STATIC_CACHE = [
  '/',
  '/chat',
  '/manifest.json'
];

// Instalação - cachear recursos estáticos
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_VERSION)
      .then((cache) => cache.addAll(STATIC_CACHE))
      .catch((err) => console.warn('Cache install failed:', err))
  );
  self.skipWaiting();
});

// Ativação - limpar caches antigos
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames
          .filter((name) => name !== CACHE_VERSION)
          .map((name) => caches.delete(name))
      );
    })
  );
  self.clients.claim();
});

// Fetch - network first, fallback to cache
self.addEventListener('fetch', (event) => {
  // Skip non-GET requests and chrome-extension
  if (event.request.method !== 'GET' || event.request.url.startsWith('chrome-extension')) {
    return;
  }

  event.respondWith(
    fetch(event.request)
      .then((response) => {
        // Cache successful responses
        if (response.ok) {
          const responseClone = response.clone();
          caches.open(CACHE_VERSION).then((cache) => {
            cache.put(event.request, responseClone);
          });
        }
        return response;
      })
      .catch(() => {
        // Fallback to cache
        return caches.match(event.request);
      })
  );
});

// Push notifications
self.addEventListener('push', (event) => {
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
    console.warn('Push data parse error:', e);
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
