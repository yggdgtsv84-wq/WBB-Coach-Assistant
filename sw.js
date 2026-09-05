// Service worker intentionally disabled for the current web version.
// This prevents an old cached build from interfering with the app.
self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', event => event.waitUntil(self.registration.unregister()));
