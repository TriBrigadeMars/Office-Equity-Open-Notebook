'use strict';

const assert = require('assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { resolveInterpreter } = require('../lib/resolve-runtimes');

const fixtures = [];
let passed = 0;

function test(name, fn) {
  fn();
  passed++;
  console.log(`  ok - ${name}`);
}

function makeTempDir() {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'onb-runtime-resolver-'));
  fixtures.push(directory);
  return directory;
}

function addFile(filePath) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, '');
}

try {
  test('prefers the standard bundled interpreter layout', () => {
    const runtimePath = makeTempDir();
    const pythonPath = path.join(runtimePath, 'python', 'python.exe');
    addFile(pythonPath);

    assert.deepStrictEqual(resolveInterpreter('python', { runtimePath }), {
      path: pythonPath,
      source: 'bundled',
    });
  });

  test('resolves the older nested bundled interpreter layout', () => {
    const runtimePath = makeTempDir();
    const pythonPath = path.join(runtimePath, 'python', 'python', 'python.exe');
    addFile(pythonPath);

    assert.deepStrictEqual(resolveInterpreter('python', { runtimePath }), {
      path: pythonPath,
      source: 'bundled',
    });
  });

  test('uses a version-gated PATH fallback when no bundled runtime exists', () => {
    const runtimePath = makeTempDir();
    const fakePathLookup = (command) => command === 'python.exe' ? 'C:\\fixture\\python.exe' : null;
    const python = resolveInterpreter('python', { runtimePath }, {
      findOnPath: fakePathLookup,
      execFileSync: () => 'Python 3.12.1',
    });

    assert.deepStrictEqual(python, { path: 'C:\\fixture\\python.exe', source: 'system' });
  });

  test('reports unsupported Python 3.10 and 3.13 versions', () => {
    const runtimePath = makeTempDir();
    const fakePathLookup = (command) => command === 'python.exe' ? 'C:\\fixture\\python.exe' : null;

    for (const version of ['Python 3.10.0', 'Python 3.13.0']) {
      const python = resolveInterpreter('python', { runtimePath }, {
        findOnPath: fakePathLookup,
        execFileSync: () => version,
      });
      const minor = version.match(/3\.(\d+)/)[1];
      assert.deepStrictEqual(python, {
        path: 'C:\\fixture\\python.exe',
        source: 'system',
        invalidVersion: `3.${minor}`,
      });
    }
  });

  test('reports an unsupported Node.js major version', () => {
    const runtimePath = makeTempDir();
    const node = resolveInterpreter('node', { runtimePath }, {
      findOnPath: (command) => command === 'node.exe' ? 'C:\\fixture\\node.exe' : null,
      execFileSync: () => 'v16.20.0',
    });

    assert.deepStrictEqual(node, {
      path: 'C:\\fixture\\node.exe',
      source: 'system',
      invalidVersion: 16,
    });
  });

  test('prefers the uv-managed Python when requested', () => {
    const runtimePath = makeTempDir();
    const uvPath = 'C:\\fixture\\uv-python\\python.exe';
    let captured;
    const python = resolveInterpreter('python', { runtimePath, prefer: 'uv' }, {
      runCapture: (command, args) => {
        captured = { command, args };
        return uvPath;
      },
    });

    assert.deepStrictEqual(captured, { command: 'uv', args: ['python', 'find', '3.12'] });
    assert.deepStrictEqual(python, { path: uvPath, source: 'uv' });
  });

  console.log(`\n${passed} runtime resolver tests passed.`);
} finally {
  for (const directory of fixtures) fs.rmSync(directory, { recursive: true, force: true });
}
