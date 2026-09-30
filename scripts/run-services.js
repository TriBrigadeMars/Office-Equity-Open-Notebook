'use strict';

/**
 * run-services.js — headless CLI to start/stop the bundled Open Notebook
 * services without launching the Electron window. Useful for testing and
 * debugging the runtime.
 *
 * Usage:
 *   node scripts/run-services.js --runtime <path> --data <dir> [--key <key>]
 */

const path = require('path');
const { startServices, PORTS } = require('./start-services');
const { arg } = require('./lib/cli');
const { ensureEncryptionKey } = require('./lib/encryption-key');
const { FRONTEND_URL, PROJECT_DIR, RUNTIME_DIR } = require('./lib/paths');

async function main() {
  const runtime = arg('--runtime', RUNTIME_DIR);
  const data = arg('--data', path.join(PROJECT_DIR, 'resources', '.testdata'));
  const key = arg('--key', null) || ensureEncryptionKey(data);

  console.log('Starting services...');
  const services = await startServices({ runtimePath: runtime, dataDir: data, encryptionKey: key, waitReady: true });
  console.log('All services are up.');
  console.log(`  Frontend: ${FRONTEND_URL}`);
  console.log(`  API:      http://127.0.0.1:${PORTS.api}/docs`);
  console.log(`  Database: ws://127.0.0.1:${PORTS.surreal}`);
  console.log('Press Ctrl+C to stop.');

  const stop = async () => {
    console.log('Stopping services...');
    await services.stop();
    process.exit(0);
  };
  process.on('SIGINT', stop);
  process.on('SIGTERM', stop);
}

main().catch((err) => {
  console.error('Failed to start services:', err && err.message);
  process.exit(1);
});
