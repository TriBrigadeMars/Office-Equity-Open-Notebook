'use strict';

/**
 * scripts/build-static-client.js
 *
 * Assembles the parallel static/client frontend proof of concept build artifact
 * under `.artifacts/static-client-poc/` without modifying the Next.js standalone
 * production build target.
 */

const fs = require('fs');
const path = require('path');

const PROJECT_ROOT = path.resolve(__dirname, '..');
const OUTPUT_DIR = path.join(PROJECT_ROOT, '.artifacts/static-client-poc');

function buildStaticClientPoc() {
  console.log('=== Building Parallel Static/Client Frontend Proof of Concept ===');

  if (!fs.existsSync(OUTPUT_DIR)) {
    fs.mkdirSync(OUTPUT_DIR, { recursive: true });
  }

  // 1. Generate client-safe runtime config script
  const envConfig = `// Client-safe runtime environment configuration
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
`;
  fs.writeFileSync(path.join(OUTPUT_DIR, 'env-config.js'), envConfig, 'utf8');

  // 2. Generate static HTML entry shell
  const indexHtml = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Office Equity Open Notebook (Static Client POC)</title>
  <script src="./env-config.js"></script>
</head>
<body>
  <div id="root">
    <div style="font-family: system-ui, sans-serif; padding: 2rem;">
      <h1>Office Equity Open Notebook</h1>
      <p>Static / Client Frontend Proof of Concept (L3.3)</p>
    </div>
  </div>
</body>
</html>
`;
  fs.writeFileSync(path.join(OUTPUT_DIR, 'index.html'), indexHtml, 'utf8');

  // 3. Generate SPA fallback rules manifest
  const spaFallbackRules = {
    version: '1.0.0',
    fallbackDestination: '/index.html',
    rules: [
      { matchPattern: '/', destination: '/index.html', isDynamic: false },
      { matchPattern: '/notebooks/*', destination: '/index.html', isDynamic: true },
      { matchPattern: '/notes/*', destination: '/index.html', isDynamic: true },
      { matchPattern: '/sources/*', destination: '/index.html', isDynamic: true },
      { matchPattern: '/settings', destination: '/settings.html', isDynamic: false },
      { matchPattern: '/models', destination: '/models.html', isDynamic: false },
      { matchPattern: '/podcasts', destination: '/podcasts.html', isDynamic: false }
    ]
  };
  fs.writeFileSync(
    path.join(OUTPUT_DIR, 'spa-fallback.json'),
    JSON.stringify(spaFallbackRules, null, 2),
    'utf8'
  );

  // 4. Generate static route pages
  for (const page of ['settings', 'models', 'podcasts']) {
    const pageHtml = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>${page.charAt(0).toUpperCase() + page.slice(1)} — Open Notebook</title>
  <script src="./env-config.js"></script>
</head>
<body>
  <div id="root"><h1>${page.charAt(0).toUpperCase() + page.slice(1)}</h1></div>
</body>
</html>
`;
    fs.writeFileSync(path.join(OUTPUT_DIR, `${page}.html`), pageHtml, 'utf8');
  }

  // 5. Generate build manifest
  const manifest = {
    buildTarget: 'parallel-static-client-poc',
    timestamp: new Date().toISOString(),
    files: [
      'index.html',
      'env-config.js',
      'spa-fallback.json',
      'settings.html',
      'models.html',
      'podcasts.html'
    ],
    nextStandaloneIntact: true
  };
  fs.writeFileSync(
    path.join(OUTPUT_DIR, 'build-manifest.json'),
    JSON.stringify(manifest, null, 2),
    'utf8'
  );

  console.log(`✓ Static/client POC successfully built at: ${OUTPUT_DIR}`);
  return manifest;
}

if (require.main === module) {
  buildStaticClientPoc();
}

module.exports = { buildStaticClientPoc };
