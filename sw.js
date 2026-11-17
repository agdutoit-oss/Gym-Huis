// Gym Huis offline cache. Put this file in the same folder as the app's HTML on the web host.
// The page: always tries the internet first (so updates arrive), and falls back to the
// last saved copy when there is no signal. Demo photos are kept once seen.
const PAGE_CACHE = "gymhuis-page-v1";
const IMG_CACHE = "gymhuis-img-v1";

self.addEventListener("install", e => {
  e.waitUntil(caches.open(PAGE_CACHE).then(c => c.add(new Request(self.registration.scope, {cache: "reload"})).catch(() => {})));
  self.skipWaiting();
});
self.addEventListener("activate", e => e.waitUntil(self.clients.claim()));

function withTimeout(p, ms) {
  return new Promise((res, rej) => { const t = setTimeout(() => rej(new Error("timeout")), ms); p.then(v => { clearTimeout(t); res(v); }, err => { clearTimeout(t); rej(err); }); });
}

self.addEventListener("fetch", e => {
  const req = e.request;
  if (req.method !== "GET") return;                      // Claude lookups etc. go straight to the internet
  const url = new URL(req.url);

  // The app page itself: internet first (4 s), else the saved copy
  if (req.mode === "navigate" || (url.origin === location.origin && /\.html?$/.test(url.pathname))) {
    e.respondWith((async () => {
      const cache = await caches.open(PAGE_CACHE);
      const key = url.origin + url.pathname;             // ignore ?query so one copy serves all
      try {
        const net = await withTimeout(fetch(req, {cache: "no-store"}), 4000);
        if (net && net.ok) cache.put(key, net.clone());
        return net;
      } catch (err) {
        return (await cache.match(key)) || (await cache.match(self.registration.scope)) ||
               (await cache.match(req, {ignoreSearch: true})) || Response.error();
      }
    })());
    return;
  }

  // Exercise demo photos: saved copy first, refresh in the background
  if (url.hostname === "raw.githubusercontent.com") {
    e.respondWith((async () => {
      const cache = await caches.open(IMG_CACHE);
      const hit = await cache.match(req);
      const net = fetch(req).then(r => { if (r && (r.ok || r.type === "opaque")) cache.put(req, r.clone()); return r; }).catch(() => null);
      return hit || (await net) || Response.error();
    })());
  }
});
