'use strict';

/**
 * lib/fsx.js — shared filesystem helpers for the `scripts/` tooling.
 */

const fs = require('fs');
const path = require('path');

function rmrf(p) {
  if (fs.existsSync(p)) fs.rmSync(p, { recursive: true, force: true });
}

/**
 * Recursive copy that always creates the destination's parent directory.
 *
 * `dereference: true` follows symlinks (uv-managed Pythons are symlinked),
 * which avoids EPERM on Windows when trying to recreate a symlink.
 */
function cp(src, dest, opts = {}) {
  fs.mkdirSync(path.dirname(dest), { recursive: true });
  fs.cpSync(src, dest, { recursive: true, dereference: true, ...opts });
}

/** Depth-first search for a file named `name` anywhere under `dir`. */
function findFile(dir, name) {
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    const full = path.join(dir, entry.name);
    if (entry.isFile() && entry.name === name) return full;
    if (entry.isDirectory()) {
      const found = findFile(full, name);
      if (found) return found;
    }
  }
  return null;
}

/** Depth-first visit of every file (not directory) under `dir`. */
function walk(dir, visit) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) walk(full, visit);
    else visit(full);
  }
}

module.exports = { rmrf, cp, findFile, walk };
