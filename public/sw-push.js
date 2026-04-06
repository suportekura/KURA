// Push notification service worker
// This file handles incoming push events and shows native notifications

self.addEventListener('push', function(event) {
  if (!event.data) return;

  let notification;
  try {
    notification = event.data.json();
  } catch (e) {
    notification = {
      title: 'Kura',
      body: event.data.text(),
    };
  }

  const options = {
    body: notification.body || '',
    icon: notification.icon || '/pwa-192x192.png',
    badge: notification.badge || '/pwa-192x192.png',
    tag: notification.tag || 'default',
    data: notification.data || {},
    vibrate: [200, 100, 200],
    actions: [],
    renotify: true,
  };

  // Add action based on notification type
  const type = notification.data?.type || notification.tag;
  if (type === 'message') {
    options.actions = [
      { action: 'open', title: 'Abrir conversa' },
    ];
  } else if (type === 'offer') {
    options.actions = [
      { action: 'open', title: 'Ver oferta' },
    ];
  } else if (type === 'order_update') {
    options.actions = [
      { action: 'open', title: 'Ver pedido' },
    ];
  }

  event.waitUntil(
    self.registration.showNotification(notification.title || 'Kura', options)
  );
});

self.addEventListener('notificationclick', function(event) {
  event.notification.close();

  const data = event.notification.data || {};
  let url = '/';

  // Route based on notification type
  const type = data.type || event.notification.tag;
  switch (type) {
    case 'message':
      url = data.conversation_id ? `/chat/${data.conversation_id}` : '/messages';
      break;
    case 'offer':
      url = data.conversation_id ? `/chat/${data.conversation_id}` : '/messages';
      break;
    case 'order_update':
      url = '/my-purchases';
      break;
    case 'favorite_sold':
      url = data.product_id ? `/product/${data.product_id}` : '/favorites';
      break;
    default:
      url = '/notifications';
      break;
  }

  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then(function(clientList) {
      // Try to focus an existing window
      for (const client of clientList) {
        if (client.url.includes(self.location.origin) && 'focus' in client) {
          client.navigate(url);
          return client.focus();
        }
      }
      // Open new window if none found
      if (clients.openWindow) {
        return clients.openWindow(url);
      }
    })
  );
});
