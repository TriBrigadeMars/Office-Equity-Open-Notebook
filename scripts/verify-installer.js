'use strict';

/**
 * verify-installer.js - detects truncated or corrupt NSIS installers before
 * they are released.
 *
 * NSIS embeds the total installer length in its first header and checks it at
 * startup; a file cut short during build or upload fails with "Installer
 * integrity check has failed". This script performs the same length check
 * locally and can also compare the local file against a published GitHub
 * release asset (size and SHA-256).
 *
 * Usage:
 *   node scripts/verify-installer.js [installer.exe] [--release <tag>] [--repo <owner/repo>]
 */

const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const { arg, runCapture } = require('./lib/cli');
const { PRODUCT_NAME, VERSION, DIST_DIR } = require('./lib/paths');

const DEFAULT_REPO = 'oe-marscruz/Office-Equity-Open-Notebook';
// NSIS firstheader: flags(4) | siginfo(4) | "NullsoftInst"(12) | header length(4) | following-data length(4)
const NSIS_SIGNATURE = Buffer.concat([Buffer.from([0xef, 0xbe, 0xad, 0xde]), Buffer.from('NullsoftInst')]);
const FIRSTHEADER_LENGTH_OFFSET = 20;
const STUB_SEARCH_BYTES = 8 * 1024 * 1024;

/** Returns the byte length the NSIS header says the installer should have, or null if none is found. */
function readNsisExpectedSize(file) {
  const fd = fs.openSync(file, 'r');
  try {
    const buf = Buffer.alloc(STUB_SEARCH_BYTES);
    const read = fs.readSync(fd, buf, 0, buf.length, 0);
    const sigOffset = buf.subarray(0, read).indexOf(NSIS_SIGNATURE);
    if (sigOffset < 4 || sigOffset + FIRSTHEADER_LENGTH_OFFSET + 4 > read) return null;
    const headerStart = sigOffset - 4;
    return headerStart + buf.readUInt32LE(sigOffset + FIRSTHEADER_LENGTH_OFFSET);
  } finally {
    fs.closeSync(fd);
  }
}

function sha256(file) {
  return new Promise((resolve, reject) => {
    const hash = crypto.createHash('sha256');
    fs.createReadStream(file)
      .on('data', (chunk) => hash.update(chunk))
      .on('error', reject)
      .on('end', () => resolve(hash.digest('hex')));
  });
}

/** Checks the installer's on-disk size against the length recorded in its NSIS header. */
function verifyInstaller(file) {
  if (!fs.existsSync(file)) return [`Installer not found: ${file}`];
  const actual = fs.statSync(file).size;
  const expected = readNsisExpectedSize(file);
  if (expected == null) return [`${file} has no NSIS header; it is not a valid NSIS installer`];
  if (actual !== expected) {
    const state = actual < expected ? 'truncated' : 'oversized';
    return [`${state}: NSIS header expects ${expected} bytes, file is ${actual} bytes (${expected - actual} difference)`];
  }
  return [];
}

/** Compares the local installer's size and SHA-256 with the published release asset of the same name. */
async function verifyRelease(file, tag, repo) {
  const json = runCapture('gh', ['release', 'view', tag, '-R', repo, '--json', 'assets']);
  const name = path.basename(file);
  const assets = JSON.parse(json).assets;
  // GitHub replaces spaces in uploaded asset names with dots.
  const asset = assets.find((a) => a.name === name || a.name === name.replace(/ /g, '.'));
  if (!asset) return [`Release ${tag} has no asset named ${name} (found: ${assets.map((a) => a.name).join(', ') || 'none'})`];

  const problems = [];
  const localSize = fs.statSync(file).size;
  if (asset.size !== localSize) problems.push(`Published size ${asset.size} != local size ${localSize}`);
  const localHash = `sha256:${await sha256(file)}`;
  if (asset.digest !== localHash) problems.push(`Published digest ${asset.digest} != local ${localHash}`);
  return problems;
}

module.exports = { verifyInstaller, verifyRelease };

if (require.main === module) {
  (async () => {
    const positional = process.argv.slice(2).find((a, i, all) => !a.startsWith('--') && !all[i - 1]?.startsWith('--'));
    const file = path.resolve(positional || path.join(DIST_DIR, `${PRODUCT_NAME}-${VERSION}-Setup.exe`));
    const tag = arg('--release', null);
    const repo = arg('--repo', DEFAULT_REPO);

    let problems = verifyInstaller(file);
    if (problems.length === 0 && tag) problems = await verifyRelease(file, tag, repo);

    if (problems.length > 0) {
      console.error(`Installer check FAILED for ${file}:`);
      problems.forEach((p) => console.error(`  - ${p}`));
      process.exit(1);
    }
    console.log(`Installer check passed for ${file}${tag ? ` (matches release ${tag})` : ''}`);
  })().catch((err) => {
    console.error(err.message);
    process.exit(1);
  });
}
