/* Service worker — offline-friendly app shell caching.
 * Bump CACHE version whenever you change cached files. */
const CACHE = "ayusree-v11";

const ASSETS = [
  "./",
  "./index.html",
  "./manifest.json",
  "./css/styles.css",
  "./js/app.js",
  "./js/i18n.js",
  "./js/i18n.strings.js",
  "./js/store.js",
  "./js/screens.js",
  "./js/components.js",
  "./js/api.js",
  "./config/clinic.config.js",
  "./config/libraries.js",
  "./config/supabase.config.js",
  "./assets/logo.svg",
  "./assets/icons/icon-192.png",
  "./assets/icons/icon-512.png",
];

self.addEventListener("install", (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(ASSETS)).then(() => self.skipWaiting()));
});

self.addEventListener("activate", (e) => {
  e.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)))
    ).then(() => self.clients.claim())
  );
});

/* Cache-first for app shell, network fallback; runtime-cache new GETs.
 * Only same-origin GETs are handled — never cache the Supabase API
 * (cross-origin) or the admin console (always fresh). */
self.addEventListener("fetch", (e) => {
  if (e.request.method !== "GET") return;
  const url = new URL(e.request.url);
  if (url.origin !== self.location.origin) return;      // skip Supabase & CDNs
  if (url.pathname.includes("/admin")) return;          // admin always from network
  e.respondWith(
    caches.match(e.request).then((cached) =>
      cached ||
      fetch(e.request).then((res) => {
        const copy = res.clone();
        caches.open(CACHE).then((c) => c.put(e.request, copy)).catch(() => {});
        return res;
      }).catch(() => cached)
    )
  );
});
