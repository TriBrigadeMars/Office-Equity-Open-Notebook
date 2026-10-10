/**
 * Office of Equity Open Notebook — Process Manager & Supervision Contracts
 *
 * Strict TypeScript implementation of process management, port polling,
 * service lifecycle handling, log formatting, and graceful shutdown semantics.
 */

import net from 'net';
import {
  ServicePorts,
  ServiceName,
  ServiceExitEvent,
  StartServicesConfig,
} from '../types';

export const DEFAULT_SERVICE_PORTS: ServicePorts = Object.freeze({
  surreal: 8000,
  api: 5055,
  frontend: 8502,
});

export function isPortOpen(port: number, host = '127.0.0.1'): Promise<boolean> {
  return new Promise((resolve) => {
    const socket = new net.Socket();
    const onDone = (ok: boolean) => {
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

export function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

export async function waitForPort(
  port: number,
  timeoutMs = 60000,
  label: string = String(port),
  host = '127.0.0.1',
  portCheckFn: (p: number, h?: string) => Promise<boolean> = isPortOpen
): Promise<boolean> {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    if (await portCheckFn(port, host)) return true;
    await sleep(500);
  }
  throw new Error(`Timed out waiting for ${label} on port ${port}`);
}

export function formatLogLine(
  name: string,
  stream: 'out' | 'err',
  data: string | Buffer,
  timestamp: Date = new Date()
): string | null {
  const line = String(data).trimEnd();
  if (!line) return null;
  const tag = `[${name}:${stream}]`;
  const formattedTimestamp = timestamp.toISOString();
  return `${formattedTimestamp} ${tag} ${line}\n`;
}

export function calculateShutdownSequence<T>(items: readonly T[]): T[] {
  return [...items].reverse();
}

export function createServiceExitEvent(
  serviceName: ServiceName,
  exitCode: number | null,
  signal: string | null,
  killedIntentional: boolean
): ServiceExitEvent {
  const unexpected = !killedIntentional && exitCode !== 0 && exitCode !== null;
  return {
    serviceName,
    exitCode,
    signal,
    unexpected,
    timestamp: new Date().toISOString(),
  };
}

export function validateStartServicesConfig(cfg: unknown): StartServicesConfig {
  if (typeof cfg !== 'object' || cfg === null) {
    throw new TypeError('StartServicesConfig must be an object');
  }
  const c = cfg as Record<string, unknown>;
  if (typeof c['runtimePath'] !== 'string' || c['runtimePath'].trim() === '') {
    throw new TypeError('StartServicesConfig.runtimePath must be a non-empty string');
  }
  if (typeof c['dataDir'] !== 'string' || c['dataDir'].trim() === '') {
    throw new TypeError('StartServicesConfig.dataDir must be a non-empty string');
  }
  if (typeof c['encryptionKey'] !== 'string' || c['encryptionKey'].trim() === '') {
    throw new TypeError('StartServicesConfig.encryptionKey must be a non-empty string');
  }
  return {
    runtimePath: c['runtimePath'],
    dataDir: c['dataDir'],
    encryptionKey: c['encryptionKey'],
    waitReady: typeof c['waitReady'] === 'boolean' ? c['waitReady'] : undefined,
    customPorts: typeof c['customPorts'] === 'object' && c['customPorts'] !== null
      ? (c['customPorts'] as Partial<ServicePorts>)
      : undefined,
  };
}
