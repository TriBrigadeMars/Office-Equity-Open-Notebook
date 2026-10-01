'use strict';

/**
 * start-services.js
 *
 * Spawns the four Open Notebook services (SurrealDB, FastAPI backend,
 * background worker, Next.js frontend) as child processes and exposes a
 * single `stop()` to tear them all down.
 *
 * This module is used both by the Electron main process (dev + packaged) and
 * by the standalone `scripts/run-services.js` CLI for headless verification.
 */

const { spawn, execFileSync } = require('child_process');
const net = require('net');
const path = require('path');
const fs = require('fs');
const { PORTS, SURREAL_URL } = require('./lib/paths');

const STARTUP_TIMEOUTS = {
  surreal: 120000,
  api: 300000,
  frontend: 180000,
};

/**
 * Resolve a bundled executable, falling back to a command on PATH.
 * Returns the absolute path or null if not found.
 */
function findOnPath(command) {
  try {
    const result = execFileSync('where', [command], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] });
    const first = result.split('\n').find((line) => line.trim());
    return first ? first.trim() : null;
  } catch (_) {
    return null;
  }
}

function resolvePython(runtimePath) {
  const bundled = path.join(runtimePath, 'python', 'python.exe');
  if (fs.existsSync(bundled)) return { path: bundled, source: 'bundled' };

  const system = findOnPath('python.exe') || findOnPath('python');
  if (!system) return null;

  // The backend requires Python >=3.11 and <3.13.
  try {
    const out = execFileSync(system, ['--version'], { encoding: 'utf8' }).trim();
    const m = out.match(/Python (\d+)\.(\d+)/);
    if (!m) return null;
    const major = parseInt(m[1], 10);
    const minor = parseInt(m[2], 10);
    if (major !== 3 || minor < 11 || minor >= 13) {
      return { path: system, source: 'system', invalidVersion: `${major}.${minor}` };
    }
    return { path: system, source: 'system' };
  } catch (_) {
    return null;
  }
}

function resolveNode(runtimePath) {
  const bundled = path.join(runtimePath, 'node', 'node.exe');
  if (fs.existsSync(bundled)) return { path: bundled, source: 'bundled' };

  const system = findOnPath('node.exe') || findOnPath('node');
  if (!system) return null;

  try {
    const out = execFileSync(system, ['--version'], { encoding: 'utf8' }).trim();
    const m = out.match(/v(\d+)/);
    if (!m) return null;
    const major = parseInt(m[1], 10);
    if (major < 18) {
      return { path: system, source: 'system', invalidVersion: major };
    }
    return { path: system, source: 'system' };
  } catch (_) {
    return null;
  }
}

function isPortOpen(port, host = '127.0.0.1') {
  return new Promise((resolve) => {
    const socket = new net.Socket();
    const onDone = (ok) => {
      socket.destroy();
      resolve(ok);
    };
    socket.setTimeout(1000);
    socket.once('connect', () => onDone(true));
    socket.once('timeout', () => onDone(false));
    socket.once('error', () => onDone(false));
    socket.connect(port, host);
  });
}

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

async function waitForPort(port, timeoutMs = 60000, label = String(port), childProcess = null, getErrorContext = null) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    if (childProcess && childProcess.exitCode !== null) {
      const exitMsg = `${label} process exited prematurely with code ${childProcess.exitCode} (signal: ${childProcess.signalCode || 'none'}) before port ${port} became ready.`;
      const context = getErrorContext ? getErrorContext() : '';
      throw new Error(context ? `${exitMsg}\n\n${context}` : exitMsg);
    }
    if (await isPortOpen(port)) return true;
    await sleep(500);
  }
  if (childProcess && childProcess.exitCode !== null) {
    const exitMsg = `${label} process exited with code ${childProcess.exitCode} before port ${port} became ready.`;
    const context = getErrorContext ? getErrorContext() : '';
    throw new Error(context ? `${exitMsg}\n\n${context}` : exitMsg);
  }
  const timeoutMsg = `Timed out waiting for ${label} on port ${port} after ${Math.round(timeoutMs / 1000)}s.`;
  const context = getErrorContext ? getErrorContext() : '';
  throw new Error(context ? `${timeoutMsg}\n\n${context}` : timeoutMsg);
}

/**
 * Start all services.
 * @param {object} cfg
 * @param {string} cfg.runtimePath  Path to the assembled runtime folder.
 * @param {string} cfg.dataDir      Directory for user data (db, uploads, logs).
 * @param {string} cfg.encryptionKey OPEN_NOTEBOOK_ENCRYPTION_KEY value.
 * @param {boolean} cfg.waitReady   Wait for the frontend to be reachable.
 */
async function startServices(cfg) {
  const { runtimePath, dataDir, encryptionKey } = cfg;
  const backendPath = path.join(runtimePath, 'backend');
  const surrealExe = path.join(runtimePath, 'surreal', 'surreal.exe');
  const frontendDir = path.join(runtimePath, 'frontend');
  const tiktokenCache = path.join(runtimePath, 'tiktoken-cache');

  // Resolve Python and Node: bundled runtime first, then system PATH.
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

  const pythonExe = python.path;
  const nodeExe = node.path;

  for (const p of [backendPath, dataDir]) {
    fs.mkdirSync(p, { recursive: true });
  }
  fs.mkdirSync(path.join(dataDir, 'surrealdb'), { recursive: true });
  const logsDir = path.join(dataDir, 'logs');
  fs.mkdirSync(logsDir, { recursive: true });

  // Check for port conflicts before starting anything.
  for (const [name, port] of Object.entries(PORTS)) {
    if (await isPortOpen(port)) {
      throw new Error(
        `Port ${port} is already in use (${name}). Another Open Notebook instance or another service is running. Close it and try again.`
      );
    }
  }

  // The backend resolves the database migrations and DATA_FOLDER relative to
  // its working directory. We run it from the backend dir so the migrations
  // resolve, and point DATA_FOLDER at the user-data directory so all user data
  // (uploads, sqlite, podcasts) lives outside the read-only app resources.
  const dataFolder = path.join(dataDir, 'data');
  fs.mkdirSync(dataFolder, { recursive: true });

  const backendEnv = {
    ...process.env,
    PYTHONPATH: backendPath,
    PYTHONUNBUFFERED: '1',
    PYTHONUTF8: '1',
    DATA_FOLDER: dataFolder,
    SURREAL_URL,
    SURREAL_USER: 'root',
    SURREAL_PASSWORD: 'root',
    SURREAL_NAMESPACE: 'open_notebook',
    SURREAL_DATABASE: 'open_notebook',
    OPEN_NOTEBOOK_ENCRYPTION_KEY: encryptionKey,
    // Docling is pre-installed into the bundled runtime by prepare-runtime.js,
    // so it is always enabled in the desktop app.
    OPEN_NOTEBOOK_ENABLE_DOCLING: 'true',
    TIKTOKEN_CACHE_DIR: tiktokenCache,
    API_HOST: '127.0.0.1',
    API_PORT: String(PORTS.api),
  };

  const timeouts = { ...STARTUP_TIMEOUTS, ...(cfg.timeouts || {}) };
  const children = [];
  const logStreams = new Map();
  const recentLogs = new Map();

  function appendRecentLog(name, line) {
    if (!recentLogs.has(name)) {
      recentLogs.set(name, []);
    }
    const buf = recentLogs.get(name);
    buf.push(line);
    if (buf.length > 25) {
      buf.shift();
    }
  }

  function getLogTail(name, maxLines = 15) {
    const file = path.join(logsDir, `${name}.log`);
    const inMem = recentLogs.get(name) || [];
    if (inMem.length > 0) {
      const tail = inMem.slice(-maxLines).join('\n');
      return `Log file: ${file}\nRecent log output:\n${tail}`;
    }
    try {
      if (fs.existsSync(file)) {
        const content = fs.readFileSync(file, 'utf8');
        const lines = content.trim().split(/\r?\n/).filter(Boolean);
        const tail = lines.slice(-maxLines).join('\n');
        return `Log file: ${file}\nRecent log output:\n${tail}`;
      }
    } catch (_) {
      /* ignore */
    }
    return `Log file: ${file}`;
  }

  function getLogStream(name) {
    if (!logStreams.has(name)) {
      const file = path.join(logsDir, `${name}.log`);
      const stream = fs.createWriteStream(file, { flags: 'a' });
      logStreams.set(name, stream);
    }
    return logStreams.get(name);
  }

  function logLine(name, stream, data) {
    const line = String(data).trimEnd();
    if (!line) return;
    const tag = `[${name}:${stream}]`;
    const timestamp = new Date().toISOString();
    const formatted = `${timestamp} ${tag} ${line}\n`;
    appendRecentLog(name, formatted.trimEnd());
    const outStream = getLogStream(name);
    outStream.write(formatted);
    // Also mirror to the parent console for dev/debug visibility.
    if (stream === 'err') {
      console.error(formatted.trimEnd());
    } else {
      console.log(formatted.trimEnd());
    }
  }

  function spawnService(name, cmd, args, opts) {
    const child = spawn(cmd, args, {
      cwd: opts.cwd || dataDir,
      env: opts.env || backendEnv,
      windowsHide: true,
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    child.stdout.on('data', (d) => logLine(name, 'out', d));
    child.stderr.on('data', (d) => logLine(name, 'err', d));
    child.on('error', (err) => console.error(`[${name}] spawn error: ${err.message}`));
    child.on('exit', (code, signal) => {
      const msg = `[${name}] exited (code=${code}, signal=${signal})`;
      logLine(name, 'out', msg);
      // If a critical service exits unexpectedly, surface it.
      if (code !== 0 && code !== null && !child.killed) {
        console.error(`CRITICAL: ${name} exited unexpectedly. Check ${path.join(logsDir, `${name}.log`)}`);
      }
    });
    children.push(child);
    return child;
  }

  async function stopServices() {
    // Kill in reverse order (frontend, worker, api, surreal)
    for (const child of [...children].reverse()) {
      try {
        if (!child.killed && child.exitCode === null) {
          child.kill();
        }
      } catch (_) {
        /* ignore */
      }
    }
    // Give them a moment to exit gracefully, then force-kill anything left.
    await sleep(1500);
    for (const child of children) {
      try {
        if (child.exitCode === null && !child.killed) {
          child.kill('SIGKILL');
        }
      } catch (_) {
        /* ignore */
      }
    }
    // Close log file streams.
    for (const stream of logStreams.values()) {
      try {
        stream.end();
      } catch (_) {
        /* ignore */
      }
    }
  }

  try {
    // 1. SurrealDB
    const surrealDbFile = path.join(dataDir, 'surrealdb', 'mydatabase.db');
    const surrealChild = spawnService(
      'surrealdb',
      surrealExe,
      ['start', '--log', 'info', '--user', 'root', '--pass', 'root', '--bind', `127.0.0.1:${PORTS.surreal}`, `rocksdb:${surrealDbFile}`],
      { cwd: dataDir, env: backendEnv }
    );
    await waitForPort(PORTS.surreal, timeouts.surreal, 'SurrealDB', surrealChild, () => getLogTail('surrealdb'));

    // 2. FastAPI backend
    const apiChild = spawnService(
      'api',
      pythonExe,
      ['-m', 'uvicorn', 'api.main:app', '--host', '127.0.0.1', '--port', String(PORTS.api)],
      { cwd: backendPath, env: backendEnv }
    );
    await waitForPort(PORTS.api, timeouts.api, 'API', apiChild, () => getLogTail('api'));

    // 3. Background worker
    spawnService(
      'worker',
      pythonExe,
      ['-m', 'surreal_commands.cli.worker', '--import-modules', 'commands', '--max-tasks', '5'],
      { cwd: backendPath, env: backendEnv }
    );

    // 4. Next.js frontend (standalone server)
    const frontendEnv = {
      ...process.env,
      NODE_ENV: 'production',
      PORT: String(PORTS.frontend),
      HOSTNAME: '127.0.0.1',
      INTERNAL_API_URL: `http://127.0.0.1:${PORTS.api}`,
    };
    const frontendChild = spawnService('frontend', nodeExe, ['server.js'], { cwd: frontendDir, env: frontendEnv });

    if (cfg.waitReady !== false) {
      await waitForPort(PORTS.frontend, timeouts.frontend, 'Frontend', frontendChild, () => getLogTail('frontend'));
    }

    return {
      children,
      ports: { ...PORTS },
      stop: stopServices,
    };
  } catch (err) {
    // Clean up all spawned children so no orphan processes lock ports or resources
    await stopServices();
    throw err;
  }
}

module.exports = { startServices, PORTS, STARTUP_TIMEOUTS, isPortOpen, waitForPort };
