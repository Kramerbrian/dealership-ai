// Service Worker for DealershipAI PWA
// This provides offline functionality, caching, and background sync

const CACHE_NAME = 'dealershipai-v1.2.0';
const OFFLINE_URL = '/offline';

// Resources to cache immediately
const STATIC_RESOURCES = [
  '/',
  '/dashboard',
  '/analytics',
  '/ai-chat',
  '/offline',
  '/manifest.json',

  // Core styles and scripts
  '/_next/static/css/',
  '/_next/static/js/',

  // Icons and images
  '/icons/icon-192x192.png',
  '/icons/icon-512x512.png',
  '/icons/dashboard-96x96.png',
  '/icons/analytics-96x96.png',
  '/icons/ai-chat-96x96.png',

  // Fonts (if any)
  // Add font URLs here
];

// API endpoints to cache with network-first strategy
const API_CACHE_ENDPOINTS = [
  '/api/dashboard/enhanced',
  '/api/analytics/predictions',
  '/api/pilot/toyota-naples',
  '/api/pilot/business-impact'
];

// Install event - cache static resources
self.addEventListener('install', (event) => {
  console.log('DealershipAI Service Worker installing...');

  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => {
        console.log('Caching static resources...');
        return cache.addAll(STATIC_RESOURCES);
      })
      .then(() => {
        // Skip waiting to activate immediately
        return self.skipWaiting();
      })
      .catch((error) => {
        console.error('Cache installation failed:', error);
      })
  );
});

// Activate event - clean up old caches
self.addEventListener('activate', (event) => {
  console.log('DealershipAI Service Worker activating...');

  event.waitUntil(
    caches.keys()
      .then((cacheNames) => {
        return Promise.all(
          cacheNames.map((cacheName) => {
            if (cacheName !== CACHE_NAME) {
              console.log('Deleting old cache:', cacheName);
              return caches.delete(cacheName);
            }
          })
        );
      })
      .then(() => {
        // Take control of all pages immediately
        return self.clients.claim();
      })
  );
});

// Fetch event - implement caching strategies
self.addEventListener('fetch', (event) => {
  const request = event.request;
  const url = new URL(request.url);

  // Skip cross-origin requests
  if (request.url.startsWith(self.location.origin)) {
    event.respondWith(handleFetch(request));
  }
});

async function handleFetch(request: Request): Promise<Response> {
  const url = new URL(request.url);
  const pathname = url.pathname;

  try {
    // API requests - Network first with cache fallback
    if (pathname.startsWith('/api/')) {
      return await networkFirstStrategy(request);
    }

    // Dashboard and analytics pages - Stale while revalidate
    if (['/dashboard', '/analytics', '/ai-chat'].includes(pathname)) {
      return await staleWhileRevalidateStrategy(request);
    }

    // Static assets - Cache first
    if (pathname.startsWith('/_next/static/') || pathname.startsWith('/icons/')) {
      return await cacheFirstStrategy(request);
    }

    // All other requests - Network first
    return await networkFirstStrategy(request);

  } catch (error) {
    console.error('Fetch error:', error);

    // Return offline page for navigation requests
    if (request.destination === 'document') {
      const cache = await caches.open(CACHE_NAME);
      return cache.match(OFFLINE_URL) || new Response('Offline', { status: 503 });
    }

    // Return empty response for other requests
    return new Response('Service Unavailable', { status: 503 });
  }
}

// Network First Strategy (for APIs and dynamic content)
async function networkFirstStrategy(request: Request): Promise<Response> {
  const cache = await caches.open(CACHE_NAME);

  try {
    // Try network first
    const networkResponse = await fetch(request);

    if (networkResponse.ok) {
      // Cache successful responses
      cache.put(request, networkResponse.clone());
    }

    return networkResponse;
  } catch (error) {
    // Network failed, try cache
    console.log('Network failed, trying cache for:', request.url);

    const cachedResponse = await cache.match(request);
    if (cachedResponse) {
      return cachedResponse;
    }

    throw error;
  }
}

// Cache First Strategy (for static assets)
async function cacheFirstStrategy(request: Request): Promise<Response> {
  const cache = await caches.open(CACHE_NAME);
  const cachedResponse = await cache.match(request);

  if (cachedResponse) {
    return cachedResponse;
  }

  try {
    const networkResponse = await fetch(request);
    if (networkResponse.ok) {
      cache.put(request, networkResponse.clone());
    }
    return networkResponse;
  } catch (error) {
    console.error('Cache first strategy failed:', error);
    throw error;
  }
}

// Stale While Revalidate Strategy (for pages)
async function staleWhileRevalidateStrategy(request: Request): Promise<Response> {
  const cache = await caches.open(CACHE_NAME);
  const cachedResponse = await cache.match(request);

  // Start fetch in background
  const fetchPromise = fetch(request).then((networkResponse) => {
    if (networkResponse.ok) {
      cache.put(request, networkResponse.clone());
    }
    return networkResponse;
  }).catch((error) => {
    console.error('Background fetch failed:', error);
  });

  // Return cached response immediately if available
  if (cachedResponse) {
    return cachedResponse;
  }

  // Wait for network if no cache available
  return fetchPromise;
}

// Background Sync for offline actions
self.addEventListener('sync', (event) => {
  console.log('Background sync triggered:', event.tag);

  if (event.tag === 'background-sync-analytics') {
    event.waitUntil(syncAnalyticsData());
  }

  if (event.tag === 'background-sync-chat') {
    event.waitUntil(syncChatMessages());
  }
});

// Sync analytics data when back online
async function syncAnalyticsData() {
  try {
    // Get pending analytics data from IndexedDB
    const pendingData = await getPendingAnalytics();

    for (const data of pendingData) {
      try {
        await fetch('/api/analytics/offline-sync', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(data)
        });

        // Remove from pending queue
        await removePendingAnalytics(data.id);
      } catch (error) {
        console.error('Failed to sync analytics data:', error);
      }
    }
  } catch (error) {
    console.error('Background analytics sync failed:', error);
  }
}

// Sync chat messages when back online
async function syncChatMessages() {
  try {
    // Get pending chat messages from IndexedDB
    const pendingMessages = await getPendingChatMessages();

    for (const message of pendingMessages) {
      try {
        await fetch('/api/ai/chat', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(message)
        });

        // Remove from pending queue
        await removePendingChatMessage(message.id);
      } catch (error) {
        console.error('Failed to sync chat message:', error);
      }
    }
  } catch (error) {
    console.error('Background chat sync failed:', error);
  }
}

// Push notification handling
self.addEventListener('push', (event) => {
  if (!event.data) return;

  const data = event.data.json();

  const options = {
    body: data.body || 'New update available',
    icon: '/icons/icon-192x192.png',
    badge: '/icons/badge-72x72.png',
    tag: data.tag || 'dealershipai-notification',
    data: data.data || {},
    actions: data.actions || [
      {
        action: 'view',
        title: 'View',
        icon: '/icons/view-24x24.png'
      },
      {
        action: 'dismiss',
        title: 'Dismiss',
        icon: '/icons/dismiss-24x24.png'
      }
    ],
    requireInteraction: data.requireInteraction || false,
    silent: data.silent || false
  };

  event.waitUntil(
    self.registration.showNotification(data.title || 'DealershipAI', options)
  );
});

// Notification click handling
self.addEventListener('notificationclick', (event) => {
  event.notification.close();

  if (event.action === 'view') {
    const urlToOpen = event.notification.data?.url || '/dashboard';

    event.waitUntil(
      self.clients.matchAll({ type: 'window', includeUncontrolled: true })
        .then((clients) => {
          // Check if there's already a window open
          for (const client of clients) {
            if (client.url === urlToOpen && 'focus' in client) {
              return client.focus();
            }
          }

          // Open new window
          if (self.clients.openWindow) {
            return self.clients.openWindow(urlToOpen);
          }
        })
    );
  }
});

// Placeholder functions for IndexedDB operations
// These would be implemented with a library like Dexie.js in production

async function getPendingAnalytics(): Promise<any[]> {
  // Implementation would use IndexedDB to get pending analytics data
  return [];
}

async function removePendingAnalytics(id: string): Promise<void> {
  // Implementation would remove item from IndexedDB
}

async function getPendingChatMessages(): Promise<any[]> {
  // Implementation would use IndexedDB to get pending chat messages
  return [];
}

async function removePendingChatMessage(id: string): Promise<void> {
  // Implementation would remove item from IndexedDB
}

// Export for TypeScript compilation
export {};