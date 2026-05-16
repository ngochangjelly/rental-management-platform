const CACHE_NAME = 'rental-hub-v3';
const RUNTIME_CACHE = 'rental-hub-runtime-v3';

// ... (lines 4-78 omitted)

async function networkFirstStrategy(request) {
  try {
    const response = await fetch(request);
    // Return response regardless of status (200, 401, 500, etc.)
    // We only want to fall back to cache on actual network failures (exceptions)
    return response;
  } catch (error) {
    console.log('Network request failed, trying cache');
    const cachedResponse = await caches.match(request);
    return cachedResponse || new Response('Network unavailable', { status: 503 });
  }
}

async function cacheFirstStrategy(request, cacheName) {
  const cachedResponse = await caches.match(request);
  if (cachedResponse) {
    return cachedResponse;
  }

  try {
    const response = await fetch(request);
    if (response.ok) {
      const cache = await caches.open(cacheName);
      cache.put(request, response.clone());
      return response;
    }
  } catch (error) {
    console.error('Cache first strategy failed:', error);
  }

  return new Response('Resource unavailable', { status: 404 });
}

async function staleWhileRevalidateStrategy(request) {
  const cachedResponse = await caches.match(request);

  const fetchPromise = fetch(request).then(response => {
    if (response.ok) {
      const cache = caches.open(CACHE_NAME);
      cache.then(c => c.put(request, response.clone()));
    }
    return response;
  }).catch(error => {
    console.error('Revalidation failed:', error);
    return cachedResponse;
  });

  return cachedResponse || fetchPromise;
}

async function getOfflineFallback(request) {
  if (request.destination === 'document') {
    return await caches.match('/dashboard.html') ||
      new Response('Offline', { status: 503 });
  }

  return new Response('Offline', { status: 503 });
}

// Activate event - clean up old caches and take control
self.addEventListener('activate', event => {
  console.log('Service Worker activating...');

  event.waitUntil(
    Promise.all([
      // Clean up old caches
      caches.keys().then(cacheNames => {
        return Promise.all(
          cacheNames.map(cacheName => {
            if (cacheName !== CACHE_NAME && cacheName !== RUNTIME_CACHE) {
              console.log('Deleting old cache:', cacheName);
              return caches.delete(cacheName);
            }
          })
        );
      }),
      // Take control of all clients immediately
      self.clients.claim()
    ])
  );
});

// Handle background sync
self.addEventListener('sync', event => {
  if (event.tag === 'background-sync') {
    event.waitUntil(doBackgroundSync());
  }
});

function doBackgroundSync() {
  // Handle any queued API requests when back online
  console.log('Background sync triggered');
}

// Handle push notifications
self.addEventListener('push', event => {
  const options = {
    body: event.data ? event.data.text() : 'New notification from Rental Hub',
    icon: 'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 192 192"><rect width="192" height="192" fill="%23667eea"/><path fill="white" d="M96 48L48 96h16v48h64V96h16L96 48zm0 16l32 32v40h-16v-16H80v16H64V96l32-32z"/></svg>',
    badge: 'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 192 192"><rect width="192" height="192" fill="%23667eea"/><path fill="white" d="M96 48L48 96h16v48h64V96h16L96 48zm0 16l32 32v40h-16v-16H80v16H64V96l32-32z"/></svg>',
    vibrate: [100, 50, 100],
    data: {
      dateOfArrival: Date.now(),
      primaryKey: 1
    }
  };

  event.waitUntil(
    self.registration.showNotification('Rental Hub', options)
  );
});

// Handle notification clicks
self.addEventListener('notificationclick', event => {
  event.notification.close();

  event.waitUntil(
    clients.openWindow('/dashboard.html')
  );
});