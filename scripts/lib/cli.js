'use strict';

/**
 * lib/cli.js — shared argv parsing and child-process runners for the
 * `scripts/` tooling.
 */

const { spawnSync } = require('child_process');

/**
 * Reads a CLI flag as `--name value` or `--name=value`.
 *
 * @param {string} name      Flag name, including the leading dashes.
 * @param {*} def            Value returned when the flag is absent.
 * @param {string[]} [argv]  Argument list; defaults to `process.argv`.
 */
function arg(name, def, argv = process.argv) {
  const eq = argv.find((a) => a.startsWith(`${name}=`));
  if (eq) return eq.split('=').slice(1).join('=');
  const i = argv.indexOf(name);
  if (i !== -1 && argv[i + 1]) return argv[i + 1];
  return def;
}

/**
 * Runs a command with inherited stdio, throwing on a non-zero exit code.
 *
 * `npm` is a .cmd shim on Windows and needs a shell; everything else (uv,
 * python, tar, node, rcedit, makensis) is a real exe and must NOT go through a
 * shell, or arguments like `-r <path>` get mangled.
 */
function commandFailed(res, cmd, args) {
  if (res.error) {
    return new Error(`Command failed (${res.error.code}): ${cmd} ${args.join(' ')}`);
  }
  if (res.status !== 0) {
    const why = res.signal ? `signal ${res.signal}` : res.status;
    return new Error(`Command failed (${why}): ${cmd} ${args.join(' ')}`);
  }
  return null;
}

function run(cmd, args, opts = {}) {
  const shell = opts.shell === true || cmd === 'npm';
  const res = spawnSync(cmd, args, { stdio: 'inherit', shell, ...opts });
  const err = commandFailed(res, cmd, args);
  if (err) throw err;
  return res;
}

/** Runs a command and returns its trimmed stdout, throwing on a non-zero exit code. */
function runCapture(cmd, args, opts = {}) {
  const res = spawnSync(cmd, args, { encoding: 'utf8', ...opts });
  const err = commandFailed(res, cmd, args);
  if (err) throw err;
  return (res.stdout || '').trim();
}

module.exports = { arg, run, runCapture };
