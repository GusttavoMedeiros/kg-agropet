// Service Worker — KG Agropet PWA
// IMPORTANTE: incrementar versão a cada atualização para forçar refresh
const CACHE = 'kg-agropet-v3';

self.addEventListener('install', e => {
  // Pula direto para ativar, sem esperar
  self.skipWaiting();
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.map(k => caches.delete(k)))  // Limpa TODOS os caches antigos
    ).then(() => self.clients.claim())
  );
});

// Estratégia: SEMPRE buscar online, cache só como fallback offline
self.addEventListener('fetch', e => {
  // Requisições ao Supabase: sempre online
  if (e.request.url.includes('supabase.co')) {
    e.respondWith(
      fetch(e.request).catch(() => new Response('offline', { status: 503 }))
    );
    return;
  }

  // App shell: network-first com fallback para cache
  e.respondWith(
    fetch(e.request)
      .then(response => {
        // Salva no cache para uso offline futuro
        const responseClone = response.clone();
        caches.open(CACHE).then(cache => {
          cache.put(e.request, responseClone);
        });
        return response;
      })
      .catch(() => caches.match(e.request))
  );
});
