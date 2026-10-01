'use strict';

/**
 * lib/runtime-manifest.js — canonical description of the assembled runtime.
 *
 * Single source of truth for "is this runtime complete?": the required file
 * list and the top-level `verifyRuntime()` check. Everything else (packaging,
 * the Electron launcher, the deep frontend verifier) consumes this module so a
 * runtime layout change only touches one file.
 */

const fs = require('fs');
const path = require('path');

/**
 * Runtime files that must exist (relative to the runtime dir) for the app to
 * launch. Superset of the lists previously duplicated in scripts/package.js
 * and main.js — both call sites used to check subsets of this.
 */
const REQUIRED_RUNTIME_FILES = [
  'python/python.exe',
  'backend/open_notebook',
  'surreal/surreal.exe',
  'node/node.exe',
  'frontend/server.js',
];

/**
 * Check that every required runtime file exists.
 *
 * @param {string} runtimeDir  Path to the assembled runtime directory.
 * @returns {{check: string, file: string, message: string}[]} Structured
 *   problems (empty array = healthy). `file` is relative to `runtimeDir`
 *   with forward slashes; `message` embeds the absolute path.
 */
function verifyRuntimeFiles(runtimeDir) {
  return REQUIRED_RUNTIME_FILES
    .map((file) => path.join(runtimeDir, ...file.split('/')))
    .filter((abs) => !fs.existsSync(abs))
    .map((abs) => ({
      check: 'file-exists',
      file: path.relative(runtimeDir, abs).split(path.sep).join('/'),
      message: `Runtime file missing: ${abs}`,
    }));
}

module.exports = { REQUIRED_RUNTIME_FILES, verifyRuntimeFiles };
