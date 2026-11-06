// Service Worker for Khel Galli Mobile Notifications

self.addEventListener('install', (event) => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(self.clients.claim());
});

// Listen for messages from web application to display mobile status bar notification
self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SHOW_NOTIFICATION') {
    const { title, body, icon, badge, data, tag } = event.data;
    
    const options = {
      body: body || 'You have a new update from Khel Galli',
      icon: icon || '/icon.svg',
      badge: badge || '/icon.svg',
      vibrate: [200, 100, 200, 100, 200],
      tag: tag || 'khel-galli-' + Date.now(),
      renotify: true,
      requireInteraction: false,
      data: data || {},
      actions: [
        { action: 'open', title: 'Open App' },
        { action: 'dismiss', title: 'Dismiss' }
      ]
    };

    self.registration.showNotification(title || 'Khel Galli Alert', options);
  }
});

// Handle push events (for background push notifications)
self.addEventListener('push', (event) => {
  let notifData = {
    title: 'Khel Galli Notification',
    body: 'New match update available',
    icon: '/icon.svg',
    badge: '/icon.svg',
    data: {}
  };

  if (event.data) {
    try {
      const parsed = event.data.json();
      notifData = { ...notifData, ...parsed };
    } catch (e) {
      notifData.body = event.data.text();
    }
  }

  event.waitUntil(
    self.registration.showNotification(notifData.title, {
      body: notifData.body,
      icon: notifData.icon || '/icon.svg',
      badge: notifData.badge || '/icon.svg',
      vibrate: [200, 100, 200],
      tag: notifData.tag || 'khel-galli-push',
      renotify: true,
      data: notifData.data || {}
    })
  );
});

// When user taps the notification in mobile notification bar
self.addEventListener('notificationclick', (event) => {
  event.notification.close();

  if (event.action === 'dismiss') {
    return;
  }

  const targetUrl = (event.notification.data && event.notification.data.url) || '/';

  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
      // If a window is already open, focus it
      for (const client of clientList) {
        if ('focus' in client) {
          if (event.notification.data && event.notification.data.actionPage) {
            client.postMessage({
              type: 'NAVIGATE_FROM_NOTIFICATION',
              actionPage: event.notification.data.actionPage,
              targetMatchId: event.notification.data.targetMatchId
            });
          }
          return client.focus();
        }
      }
      // Otherwise open a new window
      if (self.clients.openWindow) {
        return self.clients.openWindow(targetUrl);
      }
    })
  );
});
