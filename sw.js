const CACHE = "jice-20261119-mwphowzj";
// 联网优先：更新后立刻生效；断网时回退到缓存，离线仍可用
self.addEventListener("install", (e) => e.waitUntil(self.skipWaiting()));
self.addEventListener("activate", (e) => {
  e.waitUntil((async () => {
    const ks = await caches.keys();
    await Promise.all(ks.filter((k) => k !== CACHE).map((k) => caches.delete(k)));
    await self.clients.claim();
  })());
});
self.addEventListener("fetch", (e) => {
  if (e.request.method !== "GET") return;
  const accept = e.request.headers.get("accept") || "";
  const isDoc = e.request.mode === "navigate" || accept.includes("text/html");
  if (!isDoc) return;
  e.respondWith(
    fetch(e.request)
      .then((res) => {
        const copy = res.clone();
        caches.open(CACHE).then((c) => c.put("./index.html", copy));
        return res;
      })
      .catch(() => caches.match("./index.html"))
  );
});