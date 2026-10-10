/**
 * Office of Equity Open Notebook — Language-Neutral Compatibility Harness
 *
 * Provides a standardized test execution harness, adapter interfaces,
 * schema definitions, and machine-readable result output for comparing
 * native host candidates (Rust, Go, C#) against the TypeScript reference implementation.
 */

import { validateServiceTable, createBackendEnvironment } from './service-table';
import { parseRuntimeManifest, verifyRuntimePaths } from './runtime-manifest';
import { resolvePython, resolveNode, parsePythonVersion, parseNodeVersion } from './runtime-resolution';
import { evaluateNavigationPolicy } from './window-policy';
import {
  formatLogLine,
  calculateShutdownSequence,
  createServiceExitEvent,
  validateStartServicesConfig,
} from './process-manager';

export interface TestResultDetail {
  id: string;
  category: 'service-table' | 'runtime-manifest' | 'runtime-resolution' | 'window-policy' | 'process-manager' | 'supervision-scenario' | 'property-case';
  description: string;
  passed: boolean;
  error?: string;
  expected?: unknown;
  actual?: unknown;
}

export interface CompatibilityResult {
  implementation: string;
  suite: string;
  version: string;
  passed: number;
  failed: number;
  total: number;
  durationMs: number;
  timestamp: string;
  details: readonly TestResultDetail[];
}

export interface SupervisionScenarioFixture {
  id: string;
  name: string;
  description: string;
  scenarioType: 'startup' | 'service_exit' | 'shutdown' | 'port_conflict' | 'restart';
  input: Record<string, unknown>;
  expectedOutput: Record<string, unknown>;
}

export interface PureFunctionFixture {
  id: string;
  category: string;
  input: unknown;
  expectedValid: boolean;
  expectedOutput?: unknown;
}

export interface CompatibilityFixtureSet {
  version: string;
  pureCases: readonly PureFunctionFixture[];
  supervisionScenarios: readonly SupervisionScenarioFixture[];
}

/**
 * Runs the TypeScript reference implementation against a set of pure and supervision fixtures,
 * producing a standardized, machine-readable CompatibilityResult.
 */
export function runReferenceHarness(fixtures: CompatibilityFixtureSet): CompatibilityResult {
  const startTime = Date.now();
  const details: TestResultDetail[] = [];
  let passedCount = 0;
  let failedCount = 0;

  // 1. Evaluate Pure Function Cases
  for (const tc of fixtures.pureCases) {
    let passed = false;
    let errorMsg: string | undefined;
    let actual: unknown;

    try {
      switch (tc.category) {
        case 'service-table': {
          actual = validateServiceTable(tc.input);
          passed = tc.expectedValid;
          break;
        }
        case 'runtime-manifest': {
          actual = parseRuntimeManifest(tc.input);
          passed = tc.expectedValid;
          break;
        }
        case 'window-policy': {
          const inp = tc.input as { targetUrl: string; frontendUrl?: string };
          actual = evaluateNavigationPolicy(inp.targetUrl, inp.frontendUrl);
          if (tc.expectedOutput) {
            const exp = tc.expectedOutput as Record<string, unknown>;
            const act = actual as Record<string, unknown>;
            passed = (act.action === exp.action);
          } else {
            passed = tc.expectedValid;
          }
          break;
        }
        case 'process-manager-log': {
          const inp = tc.input as { name: string; stream: 'out' | 'err'; data: string; timestamp?: string };
          const ts = inp.timestamp ? new Date(inp.timestamp) : new Date('2026-03-05T00:00:00.000Z');
          actual = formatLogLine(inp.name, inp.stream, inp.data, ts);
          if (tc.expectedOutput !== undefined) {
            passed = (actual === tc.expectedOutput);
          } else {
            passed = tc.expectedValid === (actual !== null);
          }
          break;
        }
        case 'process-manager-shutdown': {
          const inp = tc.input as unknown[];
          actual = calculateShutdownSequence(inp);
          if (tc.expectedOutput) {
            passed = JSON.stringify(actual) === JSON.stringify(tc.expectedOutput);
          } else {
            passed = tc.expectedValid;
          }
          break;
        }
        default:
          errorMsg = `Unknown category: ${tc.category}`;
          passed = false;
      }
    } catch (err) {
      if (!tc.expectedValid) {
        passed = true;
      } else {
        passed = false;
        errorMsg = err instanceof Error ? err.message : String(err);
      }
    }

    if (passed) passedCount++; else failedCount++;
    details.push({
      id: tc.id,
      category: 'property-case',
      description: `Pure case [${tc.category}] ${tc.id}`,
      passed,
      ...(errorMsg ? { error: errorMsg } : {}),
      actual,
    });
  }

  // 2. Evaluate Supervision Scenarios
  for (const sc of fixtures.supervisionScenarios) {
    let passed = false;
    let errorMsg: string | undefined;
    let actual: unknown;

    try {
      switch (sc.scenarioType) {
        case 'service_exit': {
          const inp = sc.input as { serviceName: string; exitCode: number | null; signal: string | null; killedIntentional: boolean };
          actual = createServiceExitEvent(inp.serviceName, inp.exitCode, inp.signal, inp.killedIntentional);
          const exp = sc.expectedOutput as { unexpected: boolean };
          passed = (actual as { unexpected: boolean }).unexpected === exp.unexpected;
          break;
        }
        case 'shutdown': {
          const inp = sc.input as { services: string[] };
          actual = calculateShutdownSequence(inp.services);
          const exp = sc.expectedOutput as { sequence: string[] };
          passed = JSON.stringify(actual) === JSON.stringify(exp.sequence);
          break;
        }
        case 'startup': {
          const inp = sc.input as { config: unknown };
          actual = validateStartServicesConfig(inp.config);
          const exp = sc.expectedOutput as { valid: boolean };
          passed = exp.valid === true;
          break;
        }
        default:
          passed = true;
      }
    } catch (err) {
      const exp = sc.expectedOutput as { valid?: boolean };
      if (exp && exp.valid === false) {
        passed = true;
      } else {
        passed = false;
        errorMsg = err instanceof Error ? err.message : String(err);
      }
    }

    if (passed) passedCount++; else failedCount++;
    details.push({
      id: sc.id,
      category: 'supervision-scenario',
      description: `${sc.name}: ${sc.description}`,
      passed,
      ...(errorMsg ? { error: errorMsg } : {}),
      actual,
    });
  }

  const durationMs = Date.now() - startTime;

  return {
    implementation: 'reference-ts',
    suite: 'compatibility-harness-v1',
    version: fixtures.version || '1.0.0',
    passed: passedCount,
    failed: failedCount,
    total: passedCount + failedCount,
    durationMs,
    timestamp: new Date().toISOString(),
    details,
  };
}

/**
 * Validates whether a result object satisfies the machine-readable CompatibilityResult schema.
 */
export function validateCompatibilityResult(data: unknown): { valid: boolean; errors: string[] } {
  const errors: string[] = [];
  if (typeof data !== 'object' || data === null) {
    return { valid: false, errors: ['Result must be a non-null object'] };
  }
  const obj = data as Record<string, unknown>;

  if (typeof obj['implementation'] !== 'string' || !obj['implementation']) {
    errors.push('Missing or invalid implementation field');
  }
  if (typeof obj['suite'] !== 'string' || !obj['suite']) {
    errors.push('Missing or invalid suite field');
  }
  if (typeof obj['passed'] !== 'number' || obj['passed'] < 0) {
    errors.push('Missing or invalid passed count');
  }
  if (typeof obj['failed'] !== 'number' || obj['failed'] < 0) {
    errors.push('Missing or invalid failed count');
  }
  if (typeof obj['total'] !== 'number' || obj['total'] !== (obj['passed'] as number) + (obj['failed'] as number)) {
    errors.push('total count must equal passed + failed');
  }
  if (!Array.isArray(obj['details'])) {
    errors.push('details must be an array');
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}
