/* Service worker: caches the app and the model so it works with no internet after the first visit. */
const CACHE = 'noodle-classifier-v6';
const ASSETS = [
  './', 'index.html', 'styles.css', 'app.js', 'classifier.js', 'nutrition.js', 'log.js', 'tf.min.js', 'manifest.webmanifest',
  'icon-192.png', 'icon-512.png', 'apple-touch-icon.png',
  'model.json',
  'group1-shard1of4.bin', 'group1-shard2of4.bin', 'group1-shard3of4.bin', 'group1-shard4of4.bin'
];
self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(ASSETS)).then(() => self.skipWaiting()));
});
self.addEventListener('activate', (e) => {
  e.waitUntil(caches.keys().then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
    .then(() => self.clients.claim()));
});
self.addEventListener('fetch', (e) => {
  if (e.request.method !== 'GET') return;
  e.respondWith(caches.match(e.request, { ignoreSearch: true }).then((hit) => hit || fetch(e.request)));
});
