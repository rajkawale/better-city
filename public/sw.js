self.addEventListener("install", (event) => {
  event.waitUntil(caches.open("better-city-shell").then((cache) => cache.addAll(["/field", "/icon.svg"])));
});

self.addEventListener("fetch", (event) => {
  if (event.request.method !== "GET") return;
  event.respondWith(
    fetch(event.request).catch(() => caches.match(event.request).then((hit) => hit || caches.match("/field"))),
  );
});
