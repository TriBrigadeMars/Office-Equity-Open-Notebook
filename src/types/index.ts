/**
 * Office of Equity Open Notebook — Boundary Contracts & Interfaces
 *
 * Explicit TypeScript definitions for wrapper infrastructure, services,
 * runtimes, problem reports, process handles, and lifecycle boundaries.
 */

// ============================================================================
// Service & Process Boundary Contracts
// ============================================================================

export type ServiceName = 'surrealdb' | 'api' | 'worker' | 'frontend' | (string & {});

export type PortName = 'surreal' | 'api' | 'frontend';

export type ServicePorts = Record<PortName, number>;

export interface ServiceReadinessPolicy {
  type: 'port' | 'process' | 'none';
  port?: number | undefined;
  timeoutMs?: number | undefined;
  label?: string | undefined;
}

export interface ServiceDefinition {
  name: ServiceName;
  command: string;
  args: readonly string[];
  cwd?: string | undefined;
  env?: Record<string, string | undefined> | undefined;
  readinessPolicy?: ServiceReadinessPolicy | undefined;
}

export interface ServiceHandle {
  name: ServiceName;
  pid?: number | undefined;
  killed: boolean;
  exitCode: number | null;
  signal?: string | null | undefined;
}

export interface ServiceExitEvent {
  serviceName: ServiceName;
  exitCode: number | null;
  signal: string | null;
  unexpected: boolean;
  timestamp: string;
}

export interface ServiceTable {
  version: string;
  defaultPorts: ServicePorts;
  services: readonly ServiceDefinition[];
}

export interface StartServicesConfig {
  runtimePath: string;
  dataDir: string;
  encryptionKey: string;
  waitReady?: boolean | undefined;
  customPorts?: Partial<ServicePorts> | undefined;
}

export interface StartServicesResult {
  children: readonly ServiceHandle[];
  ports: ServicePorts;
  stop: () => Promise<ShutdownResult>;
}

export interface ShutdownResult {
  success: boolean;
  stoppedServices: readonly ServiceName[];
  errors?: readonly string[] | undefined;
  durationMs?: number | undefined;
}

// ============================================================================
// Process Identity & Resource Management Contracts
// ============================================================================

export interface ProcessIdentity {
  pid: number;
  name: string;
  commandLine?: string | undefined;
  parentPid?: number | undefined;
  startTime?: string | undefined;
}

export type ProcessOwnershipClassification =
  | 'current_app'
  | 'orphaned_app'
  | 'external_process'
  | 'unknown';

export interface ProcessHandle {
  identity: ProcessIdentity;
  ownership: ProcessOwnershipClassification;
}

// ============================================================================
// Runtime & Resolution Contracts
// ============================================================================

export interface RuntimePaths {
  runtimePath: string;
  backendPath: string;
  surrealExe: string;
  frontendDir: string;
  tiktokenCache: string;
  pythonExe: string;
  nodeExe: string;
}

export interface PythonResolution {
  path: string;
  source: 'bundled' | 'system';
  invalidVersion?: string | undefined;
}

export interface NodeResolution {
  path: string;
  source: 'bundled' | 'system';
  invalidVersion?: string | number | undefined;
}

export interface RuntimeComponent {
  name: string;
  path: string;
  version?: string | undefined;
  status: 'present' | 'missing' | 'invalid';
}

export interface RuntimeManifest {
  upstreamCommit: string;
  buildTimestamp?: string | undefined;
  version?: string | undefined;
  components?: Record<string, RuntimeComponent> | undefined;
}

export interface RuntimeVerificationResult {
  valid: boolean;
  missingPaths: readonly string[];
  invalidComponents?: readonly string[] | undefined;
}

export interface BackendEnvironment extends Record<string, string | undefined> {
  PYTHONPATH: string;
  PYTHONUNBUFFERED: string;
  PYTHONUTF8: string;
  DATA_FOLDER: string;
  SURREAL_URL: string;
  SURREAL_USER: string;
  SURREAL_PASSWORD: string;
  SURREAL_NAMESPACE: string;
  SURREAL_DATABASE: string;
  OPEN_NOTEBOOK_ENCRYPTION_KEY: string;
  OPEN_NOTEBOOK_ENABLE_DOCLING: string;
  TIKTOKEN_CACHE_DIR: string;
  API_HOST: string;
  API_PORT: string;
}

// ============================================================================
// Problem Reporting & Diagnostics Contracts
// ============================================================================

export type ProblemSeverity = 'fatal' | 'error' | 'warning' | 'info';

export interface ProblemReport {
  code: string;
  title: string;
  message: string;
  severity: ProblemSeverity;
  timestamp: string;
  details?: Record<string, unknown> | undefined;
  suggestedAction?: string | undefined;
}

// ============================================================================
// Port Conflict & Recovery Contracts
// ============================================================================

export interface PortConflict {
  port: number;
  serviceName: ServiceName;
  occupyingProcess?: ProcessIdentity | undefined;
}

export type PortConflictResolutionStrategy = 'fail' | 'rebind' | 'terminate_orphan';

export interface PortConflictResolutionResult {
  resolved: boolean;
  strategyUsed: PortConflictResolutionStrategy;
  boundPort: number;
  error?: string | undefined;
}

export interface StartupRetryPolicy {
  maxAttempts: number;
  initialDelayMs: number;
  maxDelayMs: number;
  backoffFactor: number;
}

// ============================================================================
// Window Policy & Security Contracts
// ============================================================================

export type NavigationAction = 'allow' | 'deny' | 'external';

export interface NavigationDecision {
  action: NavigationAction;
  targetUrl: string;
  reason?: string | undefined;
}

// ============================================================================
// Compatibility Harness Contracts
// ============================================================================

export interface TestResultDetail {
  id: string;
  category: 'service-table' | 'runtime-manifest' | 'runtime-resolution' | 'window-policy' | 'process-manager' | 'supervision-scenario' | 'property-case';
  description: string;
  passed: boolean;
  error?: string | undefined;
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

// ============================================================================
// Performance Harness Contracts
// ============================================================================

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


