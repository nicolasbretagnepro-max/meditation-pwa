// ─── Respire PWA — service-worker.js V1.1 ────────────────────────────────────
// V1.1 : ajout du support des notifications locales (SHOW_NOTIFICATION + click).
// Cache offline inchangé.

const CACHE_NAME  = "respire-v1.1";
const CACHED_URLS = [
  "./",
  "./index.html",
  "./app.js",
  "./styles.css",
  "./manifest.webmanifest",
  "./data/sessions.json"
];

// ─── Install : mise en cache des ressources ───────────────────────────────────
self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(CACHED_URLS))
  );
  self.skipWaiting();
});

// ─── Activate : suppression des anciens caches ────────────────────────────────
self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k)))
    )
  );
  self.clients.claim();
});

// ─── Fetch : cache-first pour les ressources locales ─────────────────────────
self.addEventListener("fetch", (event) => {
  // Ne pas intercepter les requêtes cross-origin
  if (!event.request.url.startsWith(self.location.origin)) return;

  event.respondWith(
    caches.match(event.request).then((cached) => cached || fetch(event.request))
  );
});

// ─── Messages depuis l'app : affichage de notification ───────────────────────
self.addEventListener("message", (event) => {
  if (event.data?.type !== "SHOW_NOTIFICATION") return;

  event.waitUntil(
    self.registration.showNotification(event.data.title || "Respire", {
      body:     event.data.body || "Ta séance du jour t'attend.",
      icon:     "./assets/icons/apple-touch-icon.png",
      badge:    "./assets/icons/apple-touch-icon.png",
      tag:      "daily-reminder",   // remplace la notif précédente si non lue
      renotify: false,
      silent:   false,
      data:     { url: self.location.origin }
    })
  );
});

// ─── Clic sur la notification : rouvre l'app ─────────────────────────────────
self.addEventListener("notificationclick", (event) => {
  event.notification.close();

  event.waitUntil(
    clients
      .matchAll({ type: "window", includeUncontrolled: true })
      .then((clientList) => {
        // Si l'app est déjà ouverte, la mettre au premier plan
        const existingClient = clientList.find((c) => c.url.startsWith(self.location.origin));
        if (existingClient) return existingClient.focus();
        // Sinon ouvrir une nouvelle fenêtre
        return clients.openWindow(event.notification.data?.url || "./");
      })
  );
});
