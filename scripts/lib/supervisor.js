'use strict';

const { spawn } = require('child_process');
const fs = require('fs');
const net = require('net');
const path = require('path');
const { getLogTail } = require('./problem-report');

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
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function createReadinessError(summary, getErrorContext) {
  const context = getErrorContext ? getErrorContext() : '';
  const error = new Error(context ? `${summary}\n\n${context}` : summary);
  if (context) {
    error.summary = summary;
    error.logTail = context;
  }
  return error;
}

async function waitForPort(port, timeoutMs = 60000, label = String(port), childProcess = null, getErrorContext = null) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    if (childProcess && childProcess.exitCode !== null) {
      const exitMsg = `${label} process exited prematurely with code ${childProcess.exitCode} (signal: ${childProcess.signalCode || 'none'}) before port ${port} became ready.`;
      throw createReadinessError(exitMsg, getErrorContext);
    }
    if (await isPortOpen(port)) return true;
    await sleep(500);
  }
  if (childProcess && childProcess.exitCode !== null) {
    const exitMsg = `${label} process exited with code ${childProcess.exitCode} before port ${port} became ready.`;
    throw createReadinessError(exitMsg, getErrorContext);
  }
  const timeoutMsg = `Timed out waiting for ${label} on port ${port} after ${Math.round(timeoutMs / 1000)}s.`;
  throw createReadinessError(timeoutMsg, getErrorContext);
}

async function supervise(table, options = {}) {
  const {
    waitReady = true,
    timeouts = {},
    onCriticalExit,
    env = process.env,
    logsDir = process.cwd(),
  } = options;
  const children = [];
  const logStreams = new Map();
  const recentLogs = new Map();

  function appendRecentLog(name, line) {
    if (!recentLogs.has(name)) recentLogs.set(name, []);
    const buffer = recentLogs.get(name);
    buffer.push(line);
    if (buffer.length > 25) buffer.shift();
  }

  function getServiceLogTail(name, maxLines = 15) {
    const file = path.join(logsDir, `${name}.log`);
    return getLogTail(file, recentLogs.get(name) || [], maxLines);
  }

  function getLogStream(name) {
    if (!logStreams.has(name)) {
      const stream = fs.createWriteStream(path.join(logsDir, `${name}.log`), { flags: 'a' });
      logStreams.set(name, stream);
    }
    return logStreams.get(name);
  }

  function logLine(name, stream, data) {
    const line = String(data).trimEnd();
    if (!line) return;
    const formatted = `${new Date().toISOString()} [${name}:${stream}] ${line}\n`;
    appendRecentLog(name, formatted.trimEnd());
    getLogStream(name).write(formatted);
    if (stream === 'err') console.error(formatted.trimEnd());
    else console.log(formatted.trimEnd());
  }

  function spawnService(service) {
    const child = spawn(service.cmd, service.args, {
      cwd: service.cwd || process.cwd(),
      env: service.env || env,
      windowsHide: true,
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    child.stdout.on('data', (data) => logLine(service.name, 'out', data));
    child.stderr.on('data', (data) => logLine(service.name, 'err', data));
    child.on('error', (error) => console.error(`[${service.name}] spawn error: ${error.message}`));
    child.on('exit', (code, signal) => {
      logLine(service.name, 'out', `[${service.name}] exited (code=${code}, signal=${signal})`);
      if (service.critical && code !== 0 && code !== null && !child.killed) {
        const details = {
          name: service.name,
          code,
          signal,
          logFile: path.join(logsDir, `${service.name}.log`),
        };
        if (onCriticalExit) {
          try {
            onCriticalExit(details);
          } catch (error) {
            console.error(`[${service.name}] critical-exit handler failed: ${error.message}`);
          }
        } else {
          console.error(`CRITICAL: ${service.name} exited unexpectedly. Check ${details.logFile}`);
        }
      }
    });
    children.push(child);
    return child;
  }

  async function stop() {
    for (const child of [...children].reverse()) {
      try {
        if (!child.killed && child.exitCode === null) child.kill();
      } catch (_) {
        // Continue stopping the remaining children.
      }
    }
    await sleep(1500);
    for (const child of children) {
      try {
        if (child.exitCode === null && child.signalCode === null) child.kill('SIGKILL');
      } catch (_) {
        // Continue closing streams even if a process could not be killed.
      }
    }
    for (const stream of logStreams.values()) {
      try {
        stream.end();
      } catch (_) {
        // Best-effort stream cleanup.
      }
    }
  }

  const ports = {};
  try {
    for (const service of table) {
      const child = spawnService(service);
      if (service.readyPort !== null && service.readyPort !== undefined) {
        ports[service.portKey || service.name] = service.readyPort;
        if (service.readiness !== 'optional' || waitReady !== false) {
          const timeoutMs = Object.prototype.hasOwnProperty.call(timeouts, service.timeoutKey)
            ? timeouts[service.timeoutKey]
            : service.timeoutMs;
          await waitForPort(
            service.readyPort,
            timeoutMs,
            service.label || service.name,
            child,
            () => getServiceLogTail(service.name)
          );
        }
      }
    }
    return { children, ports, stop };
  } catch (error) {
    await stop();
    throw error;
  }
}

module.exports = { supervise, isPortOpen, sleep, waitForPort };
