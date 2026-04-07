// Service Worker for AI Speech Translator PWA
const CACHE_NAME = "translator-v1";
const ASSETS = [
    "/",
    "/index.html",
    "/style.css",
    "/app.js",
    "/manifest.json",
];

// Install — cache core assets
self.addEventListener("install", (event) => {
    event.waitUntil(
        caches.open(CACHE_NAME).then((cache) => cache.addAll(ASSETS))
    );
    self.skipWaiting();
});

// Activate — clean old caches
self.addEventListener("activate", (event) => {
    event.waitUntil(
        caches.keys().then((keys) =>
            Promise.all(
                keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k))
            )
        )
    );
    self.clients.claim();
});

// Fetch — network first, cache fallback for static assets
self.addEventListener("fetch", (event) => {
    const url = new URL(event.request.url);

    // Don't cache API calls
    if (url.pathname === "/translate" || url.pathname === "/languages" || url.pathname === "/health") {
        return;
    }

    event.respondWith(
        fetch(event.request)
            .then((response) => {
                // Update cache
                const clone = response.clone();
                caches.open(CACHE_NAME).then((cache) => cache.put(event.request, clone));
                return response;
            })
            .catch(() => caches.match(event.request))
    );
});
