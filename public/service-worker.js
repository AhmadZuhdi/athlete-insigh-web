const CACHE_NAME = 'fit-share-cache-v1';

self.addEventListener('install', (event) => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(clients.claim());
});

self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);

  if (event.request.method === 'POST' && url.pathname.endsWith('/import')) {
    event.respondWith(
      (async () => {
        try {
          const formData = await event.request.formData();
          const files = formData.getAll('file');

          const cache = await caches.open(CACHE_NAME);

          for (const file of files) {
            if (file instanceof File && file.name.toLowerCase().endsWith('.fit')) {
              const response = new Response(file, {
                headers: { 'Content-Type': 'application/octet-stream' },
              });
              const cacheKey = `/fit-share/${file.name}`;
              cache.put(cacheKey, response);
            }
          }

          const clientUrl = url.origin + '/#/import?shared=true';
          return Response.redirect(clientUrl, 303);
        } catch (error) {
          console.error('Share target handler error:', error);
          const clientUrl = url.origin + '/#/import';
          return Response.redirect(clientUrl, 303);
        }
      })()
    );
  }
});
