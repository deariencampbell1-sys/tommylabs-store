/* Tommy's Labs — service worker (app shell + runtime cache) */
const VERSION = 'tommylabs-v11';
const PRECACHE = VERSION + '-precache';
const RUNTIME = VERSION + '-runtime';

/* App shell — the whole single-page app is index.html + the 3D vendor lib.
   Product/lab images and .glb models are fetched at runtime and cached on first use. */
const SHELL = [
  '/',
  '/index.html',
  '/success.html',
  '/vendor/model-viewer.min.js',
  '/manifest.webmanifest',
  '/icon-192.png',
  '/icon-512.png',
  '/icon-maskable-512.png',
  '/apple-touch-icon.png',
  '/favicon.ico'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(PRECACHE)
      .then((cache) => cache.addAll(SHELL))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(
        keys.filter((k) => !k.startsWith(VERSION)).map((k) => caches.delete(k))
      ))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;               // never touch checkout POSTs
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return; // same-origin only

  // Navigations: network first, offline falls back to the app shell.
  if (req.mode === 'navigate') {
    event.respondWith(
      fetch(req)
        .then((resp) => {
          const copy = resp.clone();
          caches.open(PRECACHE).then((c) => c.put('/index.html', copy));
          return resp;
        })
        .catch(() => caches.match('/index.html'))
    );
    return;
  }

  // Static assets (img/, models/, vendor/): stale-while-revalidate —
  // served instantly from cache, refreshed in the background on every
  // view so a deploy's new images/models reach installed apps without
  // a version bump. (Cache-first here is what stuck the old sideways
  // photos to phones forever.)
  event.respondWith(
    caches.match(req).then((cached) => {
      const refresh = fetch(req).then((resp) => {
        if (resp && resp.status === 200 && (resp.type === 'basic' || resp.type === 'cors')) {
          const copy = resp.clone();
          caches.open(RUNTIME).then((c) => c.put(req, copy));
        }
        return resp;
      }).catch(() => null);
      return cached || refresh;
    })
  );
});
