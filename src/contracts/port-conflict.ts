/**
 * Office of Equity Open Notebook — Port Conflict & Safe Recovery Contract
 *
 * Implements language-neutral conflict structures, process inspection,
 * ownership classification (app-owned vs external), user confirmation gating,
 * pre-kill TOCTOU verification, and bounded retry recovery.
 */

import net from 'net';
import {
  ServiceName,
  ProcessIdentity,
  ProcessOwnershipClassification,
  PortConflict,
  PortConflictResolutionResult,
  PortConflictResolutionStrategy,
  StartupRetryPolicy,
  ProblemReport,
} from '../types';

export interface ProcessInspectorOptions {
  getProcessForPort?: (port: number) => Promise<ProcessIdentity | null>;
  isProcessAlive?: (pid: number) => boolean;
  getProcessCommandLine?: (pid: number) => string | null;
  killProcess?: (pid: number, signal?: string) => boolean;
}

export interface DetailedPortConflict extends PortConflict {
  ownership: ProcessOwnershipClassification;
  isRecoverable: boolean;
  diagnostic: string;
}

export interface InteractiveRecoveryOptions {
  confirmTermination: (conflict: DetailedPortConflict) => Promise<boolean>;
  inspector?: ProcessInspectorOptions;
  retryPolicy?: StartupRetryPolicy;
}

export const DEFAULT_RETRY_POLICY: StartupRetryPolicy = Object.freeze({
  maxAttempts: 3,
  initialDelayMs: 200,
  maxDelayMs: 2000,
  backoffFactor: 2,
});

/**
 * Classify process ownership based on command line and executable context.
 */
export function classifyProcessOwnership(
  identity: ProcessIdentity | null | undefined,
  appMarkers: readonly string[] = [
    'office-of-equity-open-notebook',
    'open-notebook',
    'surreal_commands',
    'api.main:app',
    'surreal',
  ]
): ProcessOwnershipClassification {
  if (!identity) {
    return 'unknown';
  }

  const textToScan = `${identity.name} ${identity.commandLine || ''}`.toLowerCase();

  const isAppOwned = appMarkers.some((marker) =>
    textToScan.includes(marker.toLowerCase())
  );

  if (isAppOwned) {
    return 'orphaned_app';
  }

  return 'external_process';
}

/**
 * Inspect a specific port and categorize any occupant.
 */
export async function detectPortConflict(
  port: number,
  serviceName: ServiceName,
  inspector: ProcessInspectorOptions = {}
): Promise<DetailedPortConflict | null> {
  const isOccupied = await checkPortOccupied(port);
  if (!isOccupied) {
    return null;
  }

  let identity: ProcessIdentity | null = null;
  if (inspector.getProcessForPort) {
    identity = await inspector.getProcessForPort(port);
  }

  const ownership = classifyProcessOwnership(identity);
  const isRecoverable = ownership === 'orphaned_app';

  const diagnostic = redactSensitivePathInfo(
    identity
      ? `Port ${port} (${serviceName}) occupied by PID ${identity.pid} (${identity.name}) [${ownership}]`
      : `Port ${port} (${serviceName}) occupied by unidentified process [${ownership}]`
  );

  return {
    port,
    serviceName,
    occupyingProcess: identity ?? undefined,
    ownership,
    isRecoverable,
    diagnostic,
  };
}

/**
 * Safe termination with TOCTOU pre-validation and user confirmation gating.
 */
export async function safelyRecoverPortConflict(
  conflict: DetailedPortConflict,
  options: InteractiveRecoveryOptions
): Promise<PortConflictResolutionResult> {
  // Rule 1: Never auto-kill external or ambiguous processes. Fail closed.
  if (conflict.ownership !== 'orphaned_app' || !conflict.occupyingProcess) {
    return {
      resolved: false,
      strategyUsed: 'fail',
      boundPort: conflict.port,
      error: `Port ${conflict.port} is occupied by an external or ambiguous process (${conflict.ownership}). Failing closed.`,
    };
  }

  // Rule 2: Explicit user confirmation required.
  const confirmed = await options.confirmTermination(conflict);
  if (!confirmed) {
    return {
      resolved: false,
      strategyUsed: 'fail',
      boundPort: conflict.port,
      error: `User declined termination of orphan process PID ${conflict.occupyingProcess.pid}.`,
    };
  }

  // Rule 3: TOCTOU check — revalidate PID and ownership immediately prior to signal.
  const pid = conflict.occupyingProcess.pid;
  const inspector = options.inspector || {};

  if (inspector.isProcessAlive && !inspector.isProcessAlive(pid)) {
    // Process already exited
    return {
      resolved: true,
      strategyUsed: 'terminate_orphan',
      boundPort: conflict.port,
    };
  }

  if (inspector.getProcessCommandLine) {
    const currentCmd = inspector.getProcessCommandLine(pid);
    const recheckedOwnership = classifyProcessOwnership({
      pid,
      name: conflict.occupyingProcess.name,
      commandLine: currentCmd || undefined,
    });
    if (recheckedOwnership !== 'orphaned_app') {
      return {
        resolved: false,
        strategyUsed: 'fail',
        boundPort: conflict.port,
        error: `TOCTOU safety violation: Process PID ${pid} ownership changed before kill. Aborting.`,
      };
    }
  }

  // Execute kill
  let killed = false;
  if (inspector.killProcess) {
    killed = inspector.killProcess(pid, 'SIGTERM');
  } else {
    try {
      process.kill(pid, 'SIGTERM');
      killed = true;
    } catch (_) {
      killed = false;
    }
  }

  return {
    resolved: killed,
    strategyUsed: 'terminate_orphan',
    boundPort: conflict.port,
    error: killed ? undefined : `Failed to terminate orphan PID ${pid}`,
  };
}

/**
 * Redact sensitive file paths and user tokens from logs/diagnostics.
 */
export function redactSensitivePathInfo(text: string): string {
  // Redact home directory usernames: /home/username or C:\Users\username
  return text
    .replace(/(?:file:\/\/\/|\/home\/)[a-zA-Z0-9._-]+/gi, '/home/[REDACTED_USER]')
    .replace(/[a-zA-Z]:\\Users\\[a-zA-Z0-9._-]+/gi, 'C:\\Users\\[REDACTED_USER]')
    .replace(/((?:key|token|secret|password)=)[^\s&]+/gi, '$1[REDACTED]');
}

/**
 * Helper to check if a local port is currently occupied.
 */
function checkPortOccupied(port: number, host = '127.0.0.1'): Promise<boolean> {
  return new Promise((resolve) => {
    const socket = new net.Socket();
    const finish = (used: boolean) => {
      socket.destroy();
      resolve(used);
    };
    socket.setTimeout(400);
    socket.once('connect', () => finish(true));
    socket.once('timeout', () => finish(false));
    socket.once('error', () => finish(false));
    socket.connect(port, host);
  });
}
