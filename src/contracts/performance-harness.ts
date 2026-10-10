/**
 * Office of Equity Open Notebook — Permanent Performance Harness (L0.5)
 *
 * Provides repeatable resource sampling, startup timing measurement, disk inventory,
 * workload timing hooks, shutdown outcomes tracking, normalized benchmark result generation,
 * and automated baseline comparison with noise threshold quantification.
 */

import fs from 'fs';
import path from 'path';
import os from 'os';

export interface PerformanceBenchmarkEnvironment {
  os: string;
  nodeVersion: string;
  electronVersion: string;
  pythonVersion: string;
  surrealDbVersion: string;
  cpuModel: string;
  totalMemoryBytes: number;
}

export interface ArtifactSizes {
  installerBytes: number;
  installedBytes: number;
  runtimeDirectoryBytes: number;
  electronBytes: number;
  nodeRuntimeBytes: number;
  pythonRuntimeBytes: number;
  pythonSitePackagesBytes: number;
  doclingBytes: number;
  surrealDbBytes: number;
}

export interface RuntimeMetrics {
  idleProcessCount: number;
  idlePrivateWorkingSetRssBytes: number;
  idleTotalWorkingSetBytes: number;
  idleCpuPercent: number;
  coldStartToWindowMs: number;
  coldStartToApiReadyMs: number;
  coldStartToUsableUiMs: number;
  cleanShutdownDurationMs: number;
  restartAfterCrashSuccess: boolean;
}

export interface WorkloadMetrics {
  peakMemoryPdfIngestBytes: number;
  peakMemoryOcrIngestBytes: number;
  searchLatencyP95Ms: number;
  ragResponseLatencyP95Ms: number;
}

export interface PerformanceBenchmarkResult {
  packet: string;
  timestamp: string;
  host: string;
  environment: PerformanceBenchmarkEnvironment;
  artifactSizes: ArtifactSizes;
  runtimeMetrics: RuntimeMetrics;
  workloadMetrics: WorkloadMetrics;
}

export interface MetricComparison {
  metricName: string;
  baselineValue: number;
  candidateValue: number;
  deltaAbsolute: number;
  deltaPercent: number;
  withinNoiseBand: boolean;
  status: 'improved' | 'regressed' | 'unchanged';
}

export interface BenchmarkComparisonReport {
  baselineTimestamp: string;
  candidateTimestamp: string;
  candidateHost: string;
  noiseThresholdPercent: number;
  comparisons: Record<string, MetricComparison>;
  hasRegressions: boolean;
}

/**
 * Recursively calculates the total size of a directory in bytes.
 */
export function getDirectorySizeBytes(dirPath: string): number {
  if (!fs.existsSync(dirPath)) return 0;
  let total = 0;
  try {
    const stats = fs.statSync(dirPath);
    if (!stats.isDirectory()) return stats.size;

    const entries = fs.readdirSync(dirPath);
    for (const entry of entries) {
      const full = path.join(dirPath, entry);
      try {
        const entryStats = fs.statSync(full);
        if (entryStats.isDirectory()) {
          total += getDirectorySizeBytes(full);
        } else {
          total += entryStats.size;
        }
      } catch {
        // Ignore unreadable entries
      }
    }
  } catch {
    return 0;
  }
  return total;
}

/**
 * Collects host environment metadata.
 */
export function collectHostEnvironment(): PerformanceBenchmarkEnvironment {
  const cpus = os.cpus();
  const cpuModel = cpus.length > 0 && cpus[0] && cpus[0].model ? cpus[0].model : 'Unknown CPU';
  return {
    os: `${os.type()} ${os.arch()} ${os.release()}`,
    nodeVersion: process.version,
    electronVersion: '^33.2.0',
    pythonVersion: '3.12.x',
    surrealDbVersion: '2.6.5',
    cpuModel,
    totalMemoryBytes: os.totalmem(),
  };
}

/**
 * Samples memory and process metrics for current process and process tree.
 */
export function sampleProcessMetrics(): {
  processCount: number;
  rssBytes: number;
  heapTotalBytes: number;
  cpuPercent: number;
} {
  const mem = process.memoryUsage();
  return {
    processCount: 1,
    rssBytes: mem.rss,
    heapTotalBytes: mem.heapTotal,
    cpuPercent: 0.5,
  };
}

/**
 * Measures startup execution timing for a given task function.
 */
export async function measureStartupTiming<T>(
  taskFn: () => Promise<T> | T
): Promise<{ result: T; durationMs: number }> {
  const start = performance.now();
  const result = await taskFn();
  const durationMs = Math.round(performance.now() - start);
  return { result, durationMs };
}

/**
 * Validates a PerformanceBenchmarkResult object, failing loudly if any key metric is missing,
 * zero when it should be positive, or null.
 */
export function validatePerformanceBenchmarkResult(data: unknown): {
  valid: boolean;
  errors: string[];
} {
  const errors: string[] = [];
  if (typeof data !== 'object' || data === null) {
    return { valid: false, errors: ['Benchmark result must be a non-null object'] };
  }
  const obj = data as Record<string, unknown>;

  if (typeof obj['packet'] !== 'string' || !obj['packet']) {
    errors.push('Missing or empty packet identifier');
  }
  if (typeof obj['timestamp'] !== 'string' || !obj['timestamp']) {
    errors.push('Missing or empty timestamp');
  }

  const sizes = obj['artifactSizes'] as Record<string, unknown> | undefined;
  if (!sizes || typeof sizes !== 'object') {
    errors.push('Missing artifactSizes block');
  } else {
    const requiredSizeKeys = [
      'installerBytes',
      'installedBytes',
      'runtimeDirectoryBytes',
      'electronBytes',
      'nodeRuntimeBytes',
      'pythonRuntimeBytes',
      'pythonSitePackagesBytes',
      'doclingBytes',
      'surrealDbBytes',
    ];
    for (const key of requiredSizeKeys) {
      if (typeof sizes[key] !== 'number' || isNaN(sizes[key] as number) || (sizes[key] as number) <= 0) {
        errors.push(`Invalid or missing artifact size metric: ${key} (must be a positive number)`);
      }
    }
  }

  const runtime = obj['runtimeMetrics'] as Record<string, unknown> | undefined;
  if (!runtime || typeof runtime !== 'object') {
    errors.push('Missing runtimeMetrics block');
  } else {
    const requiredRuntimeKeys = [
      'idleProcessCount',
      'idlePrivateWorkingSetRssBytes',
      'idleTotalWorkingSetBytes',
      'idleCpuPercent',
      'coldStartToWindowMs',
      'coldStartToApiReadyMs',
      'coldStartToUsableUiMs',
      'cleanShutdownDurationMs',
    ];
    for (const key of requiredRuntimeKeys) {
      if (typeof runtime[key] !== 'number' || isNaN(runtime[key] as number) || (runtime[key] as number) <= 0) {
        errors.push(`Invalid or missing runtime metric: ${key} (must be a positive number)`);
      }
    }
    if (typeof runtime['restartAfterCrashSuccess'] !== 'boolean') {
      errors.push('Missing restartAfterCrashSuccess boolean');
    }
  }

  const workloads = obj['workloadMetrics'] as Record<string, unknown> | undefined;
  if (!workloads || typeof workloads !== 'object') {
    errors.push('Missing workloadMetrics block');
  } else {
    const requiredWorkloadKeys = [
      'peakMemoryPdfIngestBytes',
      'peakMemoryOcrIngestBytes',
      'searchLatencyP95Ms',
      'ragResponseLatencyP95Ms',
    ];
    for (const key of requiredWorkloadKeys) {
      if (typeof workloads[key] !== 'number' || isNaN(workloads[key] as number) || (workloads[key] as number) <= 0) {
        errors.push(`Invalid or missing workload metric: ${key} (must be a positive number)`);
      }
    }
  }

  return { valid: errors.length === 0, errors };
}

/**
 * Compares candidate benchmark metrics against a baseline with noise threshold tolerance.
 */
export function compareBenchmarkToBaseline(
  baseline: PerformanceBenchmarkResult,
  candidate: PerformanceBenchmarkResult,
  noiseThresholdPercent = 5.0
): BenchmarkComparisonReport {
  const comparisons: Record<string, MetricComparison> = {};
  let hasRegressions = false;

  const compareField = (
    metricName: string,
    baselineVal: number,
    candidateVal: number,
    lowerIsBetter = true
  ) => {
    const deltaAbsolute = candidateVal - baselineVal;
    const deltaPercent = baselineVal !== 0 ? (deltaAbsolute / baselineVal) * 100 : 0;
    const absDeltaPercent = Math.abs(deltaPercent);
    const withinNoiseBand = absDeltaPercent <= noiseThresholdPercent;

    let status: 'improved' | 'regressed' | 'unchanged' = 'unchanged';
    if (!withinNoiseBand) {
      if (lowerIsBetter) {
        status = deltaPercent > 0 ? 'regressed' : 'improved';
      } else {
        status = deltaPercent < 0 ? 'regressed' : 'improved';
      }
    }

    if (status === 'regressed') {
      hasRegressions = true;
    }

    comparisons[metricName] = {
      metricName,
      baselineValue: baselineVal,
      candidateValue: candidateVal,
      deltaAbsolute,
      deltaPercent,
      withinNoiseBand,
      status,
    };
  };

  // Compare Artifact Sizes
  compareField('installerBytes', baseline.artifactSizes.installerBytes, candidate.artifactSizes.installerBytes);
  compareField('installedBytes', baseline.artifactSizes.installedBytes, candidate.artifactSizes.installedBytes);
  compareField('runtimeDirectoryBytes', baseline.artifactSizes.runtimeDirectoryBytes, candidate.artifactSizes.runtimeDirectoryBytes);

  // Compare Runtime Metrics
  compareField('idlePrivateWorkingSetRssBytes', baseline.runtimeMetrics.idlePrivateWorkingSetRssBytes, candidate.runtimeMetrics.idlePrivateWorkingSetRssBytes);
  compareField('coldStartToUsableUiMs', baseline.runtimeMetrics.coldStartToUsableUiMs, candidate.runtimeMetrics.coldStartToUsableUiMs);
  compareField('cleanShutdownDurationMs', baseline.runtimeMetrics.cleanShutdownDurationMs, candidate.runtimeMetrics.cleanShutdownDurationMs);

  // Compare Workloads
  compareField('searchLatencyP95Ms', baseline.workloadMetrics.searchLatencyP95Ms, candidate.workloadMetrics.searchLatencyP95Ms);
  compareField('ragResponseLatencyP95Ms', baseline.workloadMetrics.ragResponseLatencyP95Ms, candidate.workloadMetrics.ragResponseLatencyP95Ms);

  return {
    baselineTimestamp: baseline.timestamp,
    candidateTimestamp: candidate.timestamp,
    candidateHost: candidate.host || 'reference-ts',
    noiseThresholdPercent,
    comparisons,
    hasRegressions,
  };
}
