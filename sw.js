// Guarda la app en el teléfono para que abra sin señal.
// Si cambias algún archivo, sube este número para que los teléfonos tomen la versión nueva.
const VERSION = 'pa-v5';
const ARCHIVOS = ['./', 'index.html', 'styles.css', 'app.js', 'calc.js', 'config.js', 'manifest.json', 'icon.svg',
  'icon-192.png', 'icon-512.png', 'icon-maskable-192.png', 'icon-maskable-512.png', 'apple-touch-icon.png',
  'fonts/baloo-2-latin-600-normal.woff2', 'fonts/baloo-2-latin-700-normal.woff2', 'fonts/baloo-2-latin-800-normal.woff2'];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(VERSION).then(c => c.addAll(ARCHIVOS)).then(() => self.skipWaiting()));
});
self.addEventListener('activate', e => {
  e.waitUntil(caches.keys().then(ks => Promise.all(ks.filter(k => k !== VERSION).map(k => caches.delete(k)))).then(() => self.clients.claim()));
});
self.addEventListener('fetch', e => {
  const url = new URL(e.request.url);
  if (e.request.method !== 'GET' || url.origin !== location.origin) return; // la API va directo a la red
  // Red primero (para tomar cambios), caché si no hay señal
  e.respondWith(
    fetch(e.request).then(r => {
      const copia = r.clone(); caches.open(VERSION).then(c => c.put(e.request, copia)); return r;
    }).catch(() => caches.match(e.request, { ignoreSearch: true }).then(r => r || caches.match('index.html')))
  );
});
// Al tocar la notificación de "terminó el tiempo", abrir la app
self.addEventListener('notificationclick', e => {
  e.notification.close();
  e.waitUntil(self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then(cs => {
    const c = cs.find(x => 'focus' in x);
    return c ? c.focus() : self.clients.openWindow('./');
  }));
});
