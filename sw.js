// Minimal service worker that won't cause errors
const CACHE_NAME = 'watches-lq-v1';

// Only cache essential files that definitely exist
const urlsToCache = [
  '/', // Root
  '/index.html', // Main HTML
  '/css/style.css', // Styles
  '/js/app.js', // Main app
  '/js/auth.js', // Auth manager
  '/js/game.js', // Game manager
  '/js/config.js', // Config
  '/js/leaderboard.js',
  '/data/easy.json',
  '/data/medium.json',
  '/data/hard.json'
];

// Install event - cache only existing files
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => {
        // Try to cache each file individually, don't fail if one doesn't exist
        return Promise.all(
          urlsToCache.map(url => {
            return cache.add(url).catch(err => {
              console.warn(`Failed to cache ${url}:`, err);
              // Continue even if one file fails
              return Promise.resolve();
            });
          })
        );
      })
  );
});

// Fetch event - return cached or fetch from network
self.addEventListener('fetch', event => {
  event.respondWith(
    caches.match(event.request)
      .then(response => {
        // Return cached version or fetch from network
        return response || fetch(event.request);
      })
      .catch(err => {
        // If both cache and network fail, return a basic response
        console.warn('Fetch failed:', err);
        return new Response('Offline - cached content not available');
      })
  );
});

// Activate event - clean up old caches
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(cacheNames => {
      return Promise.all(
        cacheNames.map(cacheName => {
          if (cacheName !== CACHE_NAME) {
            return caches.delete(cacheName);
          }
        })
      );
    })
  );
});
