const CACHE = "jice-20261119-mwpnawmr";
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

// —— Web Push：关掉网页也能收到卖出提醒
self.addEventListener("push", (e) => {
  let d = {};
  try { d = e.data ? e.data.json() : {}; } catch (_) { d = { body: (e.data && e.data.text && e.data.text()) || "" }; }
  const title = d.title || "季策";
  const body = d.body || "有新的卖出信号，打开看看";
  e.waitUntil(self.registration.showNotification(title, {
    body,
    icon: "./icon.svg",
    badge: "./icon.svg",
    tag: "jice-push",
    renotify: true,
    data: { url: d.url || "./" },
  }));
});
self.addEventListener("notificationclick", (e) => {
  e.notification.close();
  const target = (e.notification.data && e.notification.data.url) || "./";
  e.waitUntil((async () => {
    const list = await self.clients.matchAll({ type: "window", includeUncontrolled: true });
    for (const c of list) {
      if (c.url.includes("jice") || c.url.includes(":4173")) return c.focus();
    }
    return self.clients.openWindow(target);
  })());
});