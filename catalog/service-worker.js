/* Tommy's Labs — Catalog service worker (app shell + runtime cache)
   Same shape as the main store's SW so the phone app feels identical. */
const VERSION = 'tommylabs-catalog-v1';
const PRECACHE = VERSION + '-precache';
const RUNTIME = VERSION + '-runtime';

/* App shell — the whole single-page app is index.html + the 3D vendor lib.
   Product images and cross-origin GLB models are fetched at runtime and
   cached on first use (never precached — they are multi-MB). */
const SHELL = [
  '/',
  '/index.html',
  '/vendor/model-viewer.min.js',
  '/manifest.webmanifest',
  '/icon-192.png',
  '/icon-512.png',
  '/icon-maskable-512.png',
  '/apple-touch-icon.png',
  '/favicon.ico',
  '/assets/img/logo.webp',
  '/assets/img/tommy-portrait.webp'
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
  if (req.method !== 'GET') return;
  const url = new URL(req.url);

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

  // Same-origin static assets: stale-while-revalidate so installed apps see
  // new images/headers on the next view without a version bump.
  if (url.origin === self.location.origin) {
    event.respondWith(
      caches.match(req).then((cached) => {
        const refresh = fetch(req).then((resp) => {
          if (resp && resp.status === 200 && resp.type === 'basic') {
            const copy = resp.clone();
            caches.open(RUNTIME).then((c) => c.put(req, copy));
          }
          return resp;
        }).catch(() => null);
        return cached || refresh;
      })
    );
  }
  // Cross-origin (store GLBs) — let the browser handle it normally.
});
