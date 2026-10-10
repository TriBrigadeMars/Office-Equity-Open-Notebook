/**
 * Pure wrapper module for resolving Python and Node.js executables.
 */

import { PythonResolution, NodeResolution } from '../types';

export interface ResolutionOptions {
  fileExists: (filePath: string) => boolean;
  findOnPath: (command: string) => string | null;
  getVersion: (cmdPath: string, args: readonly string[]) => string | null;
  pathJoin?: (...parts: string[]) => string;
}

const defaultJoin = (...parts: string[]): string =>
  parts.join('/').replace(/\/+/g, '/');

/**
 * Parses Python version string (e.g. "Python 3.12.2" or "3.11.4").
 */
export function parsePythonVersion(versionString: string): { major: number; minor: number } | null {
  const match = versionString.match(/(?:Python\s+)?(\d+)\.(\d+)/i);
  if (!match || !match[1] || !match[2]) return null;
  const major = parseInt(match[1], 10);
  const minor = parseInt(match[2], 10);
  if (isNaN(major) || isNaN(minor)) return null;
  return { major, minor };
}

/**
 * Parses Node version string (e.g. "v22.14.0" or "v18.20.1" or "20.0.0").
 */
export function parseNodeVersion(versionString: string): { major: number } | null {
  const match = versionString.match(/v?(\d+)/i);
  if (!match || !match[1]) return null;
  const major = parseInt(match[1], 10);
  if (isNaN(major)) return null;
  return { major };
}

/**
 * Pure resolution logic for Python. Checks bundled path first, then system PATH.
 */
export function resolvePython(
  runtimePath: string,
  opts: ResolutionOptions
): PythonResolution | null {
  const join = opts.pathJoin || defaultJoin;
  const bundled = join(runtimePath, 'python', 'python.exe');

  if (opts.fileExists(bundled)) {
    return { path: bundled, source: 'bundled' };
  }

  const system = opts.findOnPath('python.exe') || opts.findOnPath('python');
  if (!system) {
    return null;
  }

  const versionOut = opts.getVersion(system, ['--version']);
  if (!versionOut) {
    return null;
  }

  const parsed = parsePythonVersion(versionOut);
  if (!parsed) {
    return null;
  }

  const { major, minor } = parsed;
  if (major !== 3 || minor < 11 || minor >= 13) {
    return { path: system, source: 'system', invalidVersion: `${major}.${minor}` };
  }

  return { path: system, source: 'system' };
}

/**
 * Pure resolution logic for Node.js. Checks bundled path first, then system PATH.
 */
export function resolveNode(
  runtimePath: string,
  opts: ResolutionOptions
): NodeResolution | null {
  const join = opts.pathJoin || defaultJoin;
  const bundled = join(runtimePath, 'node', 'node.exe');

  if (opts.fileExists(bundled)) {
    return { path: bundled, source: 'bundled' };
  }

  const system = opts.findOnPath('node.exe') || opts.findOnPath('node');
  if (!system) {
    return null;
  }

  const versionOut = opts.getVersion(system, ['--version']);
  if (!versionOut) {
    return null;
  }

  const parsed = parseNodeVersion(versionOut);
  if (!parsed) {
    return null;
  }

  const { major } = parsed;
  if (major < 18) {
    return { path: system, source: 'system', invalidVersion: major };
  }

  return { path: system, source: 'system' };
}
