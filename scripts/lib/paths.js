'use strict';

/**
 * lib/paths.js — single source of truth for the app's identity, layout, and
 * service ports.
 *
 * `package.json` owns the name and version; everything else derives from it so
 * a rename or port change cannot drift between the Electron shell, the
 * packaging scripts, and the installer.
 */

const path = require('path');

const pkg = require('../../package.json');

const PRODUCT_NAME = pkg.productName;
const VERSION = pkg.version;

const PROJECT_DIR = path.join(__dirname, '..', '..');
const RUNTIME_DIR = path.join(PROJECT_DIR, 'resources', 'runtime');
const CACHE_DIR = path.join(PROJECT_DIR, 'resources', '.cache');
const OUT_DIR = path.join(PROJECT_DIR, 'out');
const APP_DIR = path.join(OUT_DIR, PRODUCT_NAME);
const DIST_DIR = path.join(PROJECT_DIR, 'dist');

const PORTS = {
  surreal: 8000,
  api: 5055,
  frontend: 8502,
};

const FRONTEND_URL = `http://127.0.0.1:${PORTS.frontend}`;
const API_URL = `http://127.0.0.1:${PORTS.api}`;
const SURREAL_URL = `ws://127.0.0.1:${PORTS.surreal}/rpc`;

module.exports = {
  PRODUCT_NAME,
  VERSION,
  PROJECT_DIR,
  RUNTIME_DIR,
  CACHE_DIR,
  OUT_DIR,
  APP_DIR,
  DIST_DIR,
  PORTS,
  FRONTEND_URL,
  API_URL,
  SURREAL_URL,
};
