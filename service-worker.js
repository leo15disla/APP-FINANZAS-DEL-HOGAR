/*
 * Service worker de la versión 1.1 para "Finanzas del Hogar".
 *
 * Implementa caché diferenciada para recursos estáticos (shell) y
 * dinámicos. Los recursos estáticos incluyen tanto las versiones
 * minificadas como las no minificadas de la aplicación para garantizar
 * compatibilidad con index.html. Se añade una política de "network-first"
 * para activos dinámicos con control de tamaño y un mecanismo de
 * activación inmediata para nuevas versiones.
 */

const STATIC_CACHE = 'finanzas-static-v3';
const DYNAMIC_CACHE = 'finanzas-dynamic-v2';
const MAX_DYNAMIC_ENTRIES = 50;

// Archivos estáticos que se precargarán. Incluye versiones minificadas
// y no minificadas para asegurar funcionamiento offline desde index.html.
const STATIC_ASSETS = [
  '/',
  '/index.html',
  '/style.css',
  '/style.min.css',
  '/app.js',
  '/app.min.js',
  '/manifest.json',
  '/assets/icons/icon-192x192.png',
  '/assets/icons/icon-256x256.png',
  '/assets/icons/icon-384x384.png',
  '/assets/icons/icon-512x512.png'
];

async function trimCache(cacheName, maxItems) {
  const cache = await caches.open(cacheName);
  const keys = await cache.keys();
  if (keys.length <= maxItems) return;
  await cache.delete(keys[0]);
  return trimCache(cacheName, maxItems);
}

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(STATIC_CACHE).then((cache) => cache.addAll(STATIC_ASSETS)).then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys.map((key) => {
          if (key !== STATIC_CACHE && key !== DYNAMIC_CACHE) {
            return caches.delete(key);
          }
        })
      );
    })
  );
  return self.clients.claim();
});

self.addEventListener('message', (event) => {
  if (event.data === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});

self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);

  if (url.origin !== self.location.origin) {
    return;
  }

  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request).catch(() => caches.match('/index.html'))
    );
    return;
  }

  if (STATIC_ASSETS.includes(url.pathname)) {
    event.respondWith(
      caches.match(request).then((cached) => {
        if (cached) return cached;
        return fetch(request).then((resp) => {
          return caches.open(STATIC_CACHE).then((cache) => {
            cache.put(request, resp.clone());
            return resp;
          });
        });
      })
    );
    return;
  }

  event.respondWith(
    fetch(request)
      .then((resp) => {
        return caches.open(DYNAMIC_CACHE).then((cache) => {
          cache.put(request, resp.clone());
          return trimCache(DYNAMIC_CACHE, MAX_DYNAMIC_ENTRIES).catch(() => null).then(() => resp);
        });
      })
      .catch(() => caches.match(request))
  );
});
