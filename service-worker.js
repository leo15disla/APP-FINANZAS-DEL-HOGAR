/*
 * Service worker de la versión 1.0 para "Finanzas del Hogar".
 *
 * Esta implementación utiliza cachés separadas para recursos estáticos y
 * dinámicos. Los recursos estáticos se precargan durante la instalación
 * para garantizar el funcionamiento offline inmediato. Las solicitudes
 * de recursos dinámicos (p. ej. datos JSON generados por la app) se
 * almacenan en un caché diferente con una política "network‑first".
 * También se implementa un fallback para navegación offline: si el
 * usuario está sin conexión y solicita una página navegable, se sirve
 * el archivo index.html desde la caché estática.
 */

const STATIC_CACHE = 'finanzas-static-v2';
const DYNAMIC_CACHE = 'finanzas-dynamic-v1';

// Archivos estáticos que se precargarán. Incluye versiones minificadas
// para mejorar el rendimiento.
const STATIC_ASSETS = [
  '/',
  '/index.html',
  '/style.min.css',
  '/app.min.js',
  '/manifest.json',
  '/assets/icons/icon-192x192.png',
  '/assets/icons/icon-256x256.png',
  '/assets/icons/icon-384x384.png',
  '/assets/icons/icon-512x512.png'
];

// Al instalar el service worker se precargan los recursos estáticos.
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(STATIC_CACHE).then((cache) => {
      return cache.addAll(STATIC_ASSETS);
    })
  );
});

// Al activar se eliminan cachés antiguas.
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

// Estrategia de recuperación para todas las solicitudes
self.addEventListener('fetch', (event) => {
  const { request } = event;
  // Para solicitudes de navegación (HTML) usar cache fallback
  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request).catch(() => caches.match('/index.html'))
    );
    return;
  }
  // Para solicitudes de archivos estáticos usar cache-first
  if (STATIC_ASSETS.includes(new URL(request.url).pathname)) {
    event.respondWith(
      caches.match(request).then((cached) => {
        return (
          cached ||
          fetch(request).then((resp) => {
            return caches.open(STATIC_CACHE).then((cache) => {
              cache.put(request, resp.clone());
              return resp;
            });
          })
        );
      })
    );
    return;
  }
  // Para otros recursos usar network‑first con caché dinámico
  event.respondWith(
    fetch(request)
      .then((resp) => {
        return caches.open(DYNAMIC_CACHE).then((cache) => {
          cache.put(request, resp.clone());
          return resp;
        });
      })
      .catch(() => caches.match(request))
  );
});