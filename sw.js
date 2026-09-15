// Service worker: navigations are network-first (fresh shell per deploy —
// cache is the offline fallback); vendor bytes cache-first (P1 pattern),
// versioned per deploy. Base path is derived from the SW's own URL so the
// same file works at apex (/) and subpath (/astrology.ir-dev/) deploys.
const VERSION = 'manual-95d8a87cba3e99f51ac28b3a3f2d6abd5cac76eb-apex';
const BASE = new URL('.', self.location).pathname;
const SHELL = [BASE, `${BASE}index.html`, `${BASE}manifest.webmanifest`, `${BASE}favicon.svg`];
const VENDOR = [`${BASE}vendor/swe.wasm`, `${BASE}vendor/sepl_18.se1`, `${BASE}vendor/semo_18.se1`, `${BASE}vendor/seas_18.se1`];
const VENDOR_PREFIX = `${BASE}vendor/`;

self.addEventListener('install', (ev) => {
  ev.waitUntil(
    caches.open(VERSION).then((c) => c.addAll([...SHELL, ...VENDOR]).catch(() => c.addAll(SHELL))),
  );
});

self.addEventListener('activate', (ev) => {
  ev.waitUntil(
    caches.keys().then((ks) => Promise.all(ks.filter((k) => k !== VERSION).map((k) => caches.delete(k)))),
  );
});

self.addEventListener('fetch', (ev) => {
  const url = new URL(ev.request.url);
  if (url.origin !== location.origin) return;
  // Navigations: NETWORK-FIRST. A deploy replaces hashed chunks, so a
  // cache-first shell would pair stale HTML with 404'd imports (dead
  // page, deploy-skew). Cache answers only when offline.
  if (ev.request.mode === 'navigate') {
    ev.respondWith(
      fetch(ev.request)
        .then((res) => {
          const copy = res.clone();
          caches.open(VERSION).then((c) => c.put(ev.request, copy));
          return res;
        })
        .catch(() =>
          caches.match(ev.request).then((hit) => hit || caches.match(`${BASE}index.html`)),
        ),
    );
    return;
  }
  ev.respondWith(
    caches.match(ev.request).then((hit) => {
      if (hit) return hit;
      return fetch(ev.request).then((res) => {
        if (url.pathname.startsWith(VENDOR_PREFIX) && res.ok) {
          const copy = res.clone();
          caches.open(VERSION).then((c) => c.put(ev.request, copy));
        }
        return res;
      });
    }),
  );
});
