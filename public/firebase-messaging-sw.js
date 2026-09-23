// Firebase Cloud Messaging Service Worker
importScripts('https://www.gstatic.com/firebasejs/10.13.0/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/10.13.0/firebase-messaging-compat.js');

const firebaseConfig = {
  apiKey: "AIzaSyDeFjTXI-LEUmMPWsq9ii8HdyWSXhGiLIQ",
  authDomain: "substantial-mender-0mn89.firebaseapp.com",
  projectId: "substantial-mender-0mn89",
  storageBucket: "substantial-mender-0mn89.firebasestorage.app",
  messagingSenderId: "1047868075419",
  appId: "1:1047868075419:web:c1fb7fbffc0a356f8f853e"
};

firebase.initializeApp(firebaseConfig);

let messaging = null;
try {
  messaging = firebase.messaging();
} catch (e) {
  console.warn('[FCM SW] Failed to initialize messaging in service worker:', e);
}

if (messaging) {
  messaging.onBackgroundMessage((payload) => {
    console.log('[FCM SW] Received background message:', payload);
    const title = payload.notification?.title || payload.data?.title || '⚾ ¡Carrera Anotada! - Baseball Hub';
    const body = payload.notification?.body || payload.data?.body || 'Un equipo ha anotado una carrera en vivo.';
    const icon = payload.notification?.icon || payload.data?.icon || '/favicon.ico';

    const notificationOptions = {
      body: body,
      icon: icon,
      badge: '/favicon.ico',
      tag: payload.data?.gameId || 'score-alert',
      renotify: true,
      data: payload.data || {},
      actions: [
        { action: 'open', title: 'Ver Partido en Vivo' }
      ]
    };

    return self.registration.showNotification(title, notificationOptions);
  });
}

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const urlToOpen = '/';

  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((windowClients) => {
      for (let i = 0; i < windowClients.length; i++) {
        const client = windowClients[i];
        if (client.url === urlToOpen && 'focus' in client) {
          return client.focus();
        }
      }
      if (clients.openWindow) {
        return clients.openWindow(urlToOpen);
      }
    })
  );
});
