/**
 * Pure wrapper module for parsing and verifying runtime manifests and paths.
 */

import {
  RuntimeManifest,
  RuntimeVerificationResult,
} from '../types';

export const REQUIRED_RUNTIME_PATHS = [
  'surreal/surreal.exe',
  'backend/open_notebook',
  'frontend/server.js',
] as const;

export const OPTIONAL_BUNDLE_PATHS = [
  'python/python.exe',
  'node/node.exe',
  'tiktoken-cache',
] as const;

export interface ManifestValidationResult {
  valid: boolean;
  errors: readonly string[];
  manifest?: RuntimeManifest | undefined;
}

/**
 * Validates whether an object matches the RuntimeManifest contract structure.
 */
export function validateRuntimeManifest(data: unknown): ManifestValidationResult {
  const errors: string[] = [];

  if (data === null || typeof data !== 'object') {
    return { valid: false, errors: ['Manifest data must be a non-null object'] };
  }

  const obj = data as Record<string, unknown>;

  if (typeof obj['upstreamCommit'] !== 'string' || obj['upstreamCommit'].trim() === '') {
    errors.push('Manifest missing valid upstreamCommit string');
  }

  if (obj['buildTimestamp'] !== undefined && typeof obj['buildTimestamp'] !== 'string') {
    errors.push('Manifest buildTimestamp must be a string if provided');
  }

  if (obj['version'] !== undefined && typeof obj['version'] !== 'string') {
    errors.push('Manifest version must be a string if provided');
  }

  if (obj['wrapperCommit'] !== undefined && typeof obj['wrapperCommit'] !== 'string') {
    errors.push('Manifest wrapperCommit must be a string if provided');
  }

  if (obj['targetArchitecture'] !== undefined && typeof obj['targetArchitecture'] !== 'string') {
    errors.push('Manifest targetArchitecture must be a string if provided');
  }

  if (errors.length > 0) {
    return { valid: false, errors };
  }

  const manifest: RuntimeManifest = {
    upstreamCommit: String(obj['upstreamCommit']),
    ...(typeof obj['buildTimestamp'] === 'string' ? { buildTimestamp: obj['buildTimestamp'] } : {}),
    ...(typeof obj['version'] === 'string' ? { version: obj['version'] } : {}),
  };

  return { valid: true, errors: [], manifest };
}

/**
 * Parses JSON or an existing object into a typed RuntimeManifest.
 */
export function parseRuntimeManifest(input: string | unknown): RuntimeManifest {
  let parsed: unknown;
  if (typeof input === 'string') {
    try {
      parsed = JSON.parse(input);
    } catch (err) {
      throw new Error(`Failed to parse runtime manifest JSON: ${err instanceof Error ? err.message : String(err)}`);
    }
  } else {
    parsed = input;
  }

  const validation = validateRuntimeManifest(parsed);
  if (!validation.valid || !validation.manifest) {
    throw new Error(`Invalid runtime manifest format: ${validation.errors.join('; ')}`);
  }

  return validation.manifest;
}

/**
 * Verifies that required runtime files and directories exist under runtimePath.
 */
export function verifyRuntimePaths(
  runtimePath: string,
  fileExistsFn: (filePath: string) => boolean
): RuntimeVerificationResult {
  const missingPaths: string[] = [];

  for (const relPath of REQUIRED_RUNTIME_PATHS) {
    const fullPath = `${runtimePath}/${relPath}`.replace(/\/+/g, '/');
    if (!fileExistsFn(fullPath)) {
      missingPaths.push(relPath);
    }
  }

  return {
    valid: missingPaths.length === 0,
    missingPaths,
  };
}
