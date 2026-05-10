// Service Worker — KG Agropet PWA
const CACHE = 'kg-agropet-v1';
const ARQUIVOS = [
  '/', '/index.html', '/css/style.css',
  '/js/supabase.js', '/js/app.js', '/manifest.json'
];

self.addEventListener('install', e => {
  e.waitUntil(
    caches.open(CACHE).then(c => c.addAll(ARQUIVOS))
  );
  self.skipWaiting();
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)))
    )
  );
  self.clients.claim();
});

self.addEventListener('fetch', e => {
  // Requisições ao Supabase: sempre online, sem cache
  if (e.request.url.includes('supabase.co')) {
    e.respondWith(fetch(e.request).catch(() => new Response('offline', { status: 503 })));
    return;
  }
  // App shell: cache primeiro
  e.respondWith(
    caches.match(e.request).then(cached => cached || fetch(e.request))
  );
});
