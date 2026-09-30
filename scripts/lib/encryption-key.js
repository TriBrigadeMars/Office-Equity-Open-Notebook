'use strict';

/**
 * lib/encryption-key.js — reads (or creates) the locally-generated key that
 * encrypts stored provider API keys.
 *
 * Shared by the Electron main process and the headless `run-services` CLI so
 * both resolve the same user-data directory to the same key.
 */

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const KEY_FILENAME = 'encryption-key.txt';

/**
 * Returns the persisted encryption key for `dataDir`, generating a 32-byte
 * random key on first use.
 *
 * @param {string} dataDir Directory holding the app's user data.
 */
function ensureEncryptionKey(dataDir) {
  const keyFile = path.join(dataDir, KEY_FILENAME);
  if (fs.existsSync(keyFile)) {
    return fs.readFileSync(keyFile, 'utf8').trim();
  }
  const key = crypto.randomBytes(32).toString('hex');
  fs.mkdirSync(dataDir, { recursive: true });
  fs.writeFileSync(keyFile, key, 'utf8');
  return key;
}

module.exports = { ensureEncryptionKey, KEY_FILENAME };
