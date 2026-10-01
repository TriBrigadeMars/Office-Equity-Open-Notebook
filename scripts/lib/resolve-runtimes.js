'use strict';

const { execFileSync } = require('child_process');
const fs = require('fs');
const path = require('path');

function findOnPath(command) {
  try {
    const result = execFileSync('where', [command], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] });
    const first = result.split('\n').find((line) => line.trim());
    return first ? first.trim() : null;
  } catch (_) {
    return null;
  }
}

function resolveInterpreter(name, runtimePath, dependencies = {}) {
  const interpreters = {
    python: { directory: 'python', executable: 'python.exe' },
    node: { directory: 'node', executable: 'node.exe' },
  };
  const interpreter = interpreters[name];
  if (!interpreter) throw new Error(`Unsupported runtime: ${name}`);

  const existsSync = dependencies.existsSync || fs.existsSync;
  const run = dependencies.execFileSync || execFileSync;
  const lookup = dependencies.findOnPath || findOnPath;
  const bundled = path.join(runtimePath, interpreter.directory, interpreter.executable);
  if (existsSync(bundled)) return { path: bundled, source: 'bundled' };

  const system = lookup(`${name}.exe`) || lookup(name);
  if (!system) return null;

  try {
    const out = run(system, ['--version'], { encoding: 'utf8' }).trim();
    if (name === 'python') {
      const match = out.match(/Python (\d+)\.(\d+)/);
      if (!match) return null;
      const major = parseInt(match[1], 10);
      const minor = parseInt(match[2], 10);
      if (major !== 3 || minor < 11 || minor >= 13) {
        return { path: system, source: 'system', invalidVersion: `${major}.${minor}` };
      }
      return { path: system, source: 'system' };
    }

    const match = out.match(/v(\d+)/);
    if (!match) return null;
    const major = parseInt(match[1], 10);
    if (major < 18) return { path: system, source: 'system', invalidVersion: major };
    return { path: system, source: 'system' };
  } catch (_) {
    return null;
  }
}

function resolvePython(runtimePath) {
  return resolveInterpreter('python', runtimePath);
}

function resolveNode(runtimePath) {
  return resolveInterpreter('node', runtimePath);
}

function resolveRuntimes(runtimePath) {
  const python = resolvePython(runtimePath);
  if (!python) {
    throw new Error(
      'Python 3.11/3.12 was not found. Either install the bundled Python runtime, ' +
        'or ensure python.exe for Python 3.11 or 3.12 is on your PATH.'
    );
  }
  if (python.invalidVersion) {
    throw new Error(
      `Python ${python.invalidVersion} was found at ${python.path}, but the backend requires Python 3.11 or 3.12. ` +
        'Install the bundled Python runtime or a supported system Python.'
    );
  }

  const node = resolveNode(runtimePath);
  if (!node) {
    throw new Error(
      'Node.js was not found. Either install the bundled Node.js runtime, ' +
        'or ensure node.exe (v18+) is on your PATH.'
    );
  }
  if (node.invalidVersion) {
    throw new Error(
      `Node.js ${node.invalidVersion} was found at ${node.path}, but the frontend server requires Node.js v18+. ` +
        'Install the bundled Node.js runtime or upgrade your system Node.js.'
    );
  }
  return { python, node };
}

module.exports = { findOnPath, resolvePython, resolveNode, resolveInterpreter, resolveRuntimes };
