// Client-safe runtime environment configuration
window.__CONFIG__ = {
  apiBaseUrl: 'http://127.0.0.1:5055',
  proxyBasePath: '/api',
  spaFallbackRoute: '/index.html',
  routes: [
    '/',
    '/notebooks/[id]',
    '/notes/[id]',
    '/sources/[id]',
    '/settings',
    '/models',
    '/podcasts'
  ],
  envSource: 'client-runtime-config',
  isStaticExport: true
};
