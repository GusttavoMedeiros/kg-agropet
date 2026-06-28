// Service Worker — KG Agropet PWA
// IMPORTANTE: incrementar versão a cada atualização para forçar refresh
const CACHE = 'kg-agropet-v15';

self.addEventListener('install', e => {
  self.skipWaiting();
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.map(k => caches.delete(k)))
    ).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', e => {
  const { request } = e;

  // 1. Requisições ao Supabase: sempre online, nunca cachear
  if (request.url.includes('supabase.co')) {
    e.respondWith(
      fetch(request).catch(() =>
        new Response(
          JSON.stringify({ error: 'offline', message: 'Sem conexão com o banco de dados.' }),
          { status: 503, headers: { 'Content-Type': 'application/json' } }
        )
      )
    );
    return;
  }

  // 2. Só processar requisições GET para o App Shell
  // Métodos POST/PATCH/DELETE nunca devem ser cacheados
  if (request.method !== 'GET') return;

  // 3. App Shell: Network-First com fallback para cache
  e.respondWith(
    fetch(request)
      .then(response => {
        // Só cachear respostas válidas (status 200 e tipo básico ou cors)
        // Evita cachear erros 404, 429, 500 ou respostas opacas
        const cacheavel =
          response.status === 200 &&
          (response.type === 'basic' || response.type === 'cors');

        if (cacheavel) {
          const responseClone = response.clone();
          caches.open(CACHE).then(cache => cache.put(request, responseClone));
        }

        return response;
      })
      .catch(() => caches.match(request))
  );
});
