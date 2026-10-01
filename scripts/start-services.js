'use strict';

const fs = require('fs');
const path = require('path');
const { PORTS } = require('./lib/paths');
const { resolveRuntimes } = require('./lib/resolve-runtimes');
const { buildBackendEnv, serviceTable, STARTUP_TIMEOUTS } = require('./lib/service-table');
const { supervise, isPortOpen, waitForPort } = require('./lib/supervisor');

async function startServices(cfg) {
  const { runtimePath, dataDir, encryptionKey } = cfg;
  const backendPath = path.join(runtimePath, 'backend');
  const tiktokenCache = path.join(runtimePath, 'tiktoken-cache');
  const { python, node } = resolveRuntimes(runtimePath);

  for (const directory of [backendPath, dataDir, path.join(dataDir, 'surrealdb'), path.join(dataDir, 'logs')]) {
    fs.mkdirSync(directory, { recursive: true });
  }

  for (const [name, port] of Object.entries(PORTS)) {
    if (await isPortOpen(port)) {
      throw new Error(
        `Port ${port} is already in use (${name}). Another Open Notebook instance or another service is running. Close it and try again.`
      );
    }
  }

  const dataFolder = path.join(dataDir, 'data');
  fs.mkdirSync(dataFolder, { recursive: true });
  const env = cfg.env || process.env;
  const backendEnv = buildBackendEnv({ dataDir, encryptionKey, tiktokenCache, backendPath, env });
  const table = serviceTable({ runtimePath, dataDir, backendPath, pythonExe: python.path, nodeExe: node.path, env, backendEnv });
  const logsDir = path.join(dataDir, 'logs');

  return supervise(table, {
    waitReady: cfg.waitReady !== false,
    timeouts: { ...STARTUP_TIMEOUTS, ...(cfg.timeouts || {}) },
    onCriticalExit: cfg.onCriticalExit,
    env,
    logsDir,
  });
}

module.exports = { startServices, PORTS, STARTUP_TIMEOUTS, isPortOpen, waitForPort };
