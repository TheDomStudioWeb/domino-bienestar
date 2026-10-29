const CACHE_NAME = 'domino-bienestar-v4'; // único por app: las tres apps comparten el mismo dominio
const urlsToCache = [
    './',
    'index.html',
    'style.css',
    'hub.css',
    'app.js',
    'tenant.js',
    'hub.js',
    'pdfunif.js',
    'modulos.js',
    'actividades-datos.js',
    'bienestar.js',
    'proximamente.js',
    'manifest.json',
    'imagenes/domino-d.png',
    'imagenes/medallon-dom-192.webp'
];

self.addEventListener('install', (event) => {
    event.waitUntil(caches.open(CACHE_NAME).then((cache) => cache.addAll(urlsToCache)));
    self.skipWaiting();
});

self.addEventListener('activate', (event) => {
    event.waitUntil(
        caches.keys().then((keys) => Promise.all(keys.filter((k) => k.startsWith('domino-bienestar-') && k !== CACHE_NAME).map((k) => caches.delete(k))))
    );
    self.clients.claim();
});

// Red primero (siempre la versión nueva); si no hay conexión, la copia guardada.
// Los datos de Firebase no se guardan: solo archivos propios de la app.
self.addEventListener('fetch', (event) => {
    const url = new URL(event.request.url);
    if (event.request.method !== 'GET' || url.origin !== self.location.origin) return;
    event.respondWith(
        fetch(event.request)
            .then((resp) => {
                const copia = resp.clone();
                caches.open(CACHE_NAME).then((c) => c.put(event.request, copia));
                return resp;
            })
            .catch(() => caches.match(event.request))
    );
});
