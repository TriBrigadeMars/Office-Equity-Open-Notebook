/**
 * Modular Runtime Packaging Contract Module (L5.1).
 *
 * Defines packaging units, component manifests, allowlist path validation,
 * and packaging graph structure.
 */

import {
  RuntimeComponent,
  AllowlistValidationResult,
  ModularPackagingGraph,
  RuntimeVerificationResult,
} from '../types';

export const ALLOWLISTED_PATH_PREFIXES = [
  'frontend/',
  'surreal/',
  'python/',
  'backend/',
  'tiktoken-cache/',
  'manifest.json',
  'component_manifest.json',
  'modular_packaging_graph.json',
] as const;

export interface ComponentDefinition {
  id: string;
  name: string;
  category: 'required' | 'optional';
  description: string;
  relativePaths: readonly string[];
  defaultProvenance: string;
}

export const MODULAR_COMPONENT_DEFINITIONS: Record<string, ComponentDefinition> = {
  core_host_frontend: {
    id: 'core_host_frontend',
    name: 'Core Host & Frontend',
    category: 'required',
    description: 'Native host binary and static client frontend assets',
    relativePaths: ['frontend/static'],
    defaultProvenance: 'Native Tauri static client build',
  },
  surrealdb: {
    id: 'surrealdb',
    name: 'SurrealDB',
    category: 'required',
    description: 'SurrealDB v2.6.5 embedded graph/document database engine',
    relativePaths: ['surreal/surreal.exe'],
    defaultProvenance: 'SurrealDB official Windows release binary',
  },
  python_backend: {
    id: 'python_backend',
    name: 'Python Core Backend',
    category: 'required',
    description: 'Standalone CPython 3.12 runtime and Open Notebook Python API code',
    relativePaths: ['python/python.exe', 'backend/open_notebook', 'backend/api'],
    defaultProvenance: 'uv CPython 3.12 standalone distribution + upstream commit',
  },
  docling: {
    id: 'docling',
    name: 'Docling Extraction Engine',
    category: 'optional',
    description: 'Docling table and document extraction module (content-core[docling])',
    relativePaths: ['python/Lib/site-packages/docling', 'python/Lib/site-packages/content_core'],
    defaultProvenance: 'uv PyPI optional dependency extra',
  },
  tiktoken_cache: {
    id: 'tiktoken_cache',
    name: 'Tiktoken Encoding Cache',
    category: 'optional',
    description: 'Pre-cached tiktoken o200k_base encoding for offline RAG token counting',
    relativePaths: ['tiktoken-cache'],
    defaultProvenance: 'tiktoken pre-downloaded offline cache',
  },
};

/**
 * Validates that all files under runtime path match allowlisted path prefixes.
 */
export function validateRuntimeAllowlist(runtimeFiles: readonly string[]): AllowlistValidationResult {
  const unallowlistedPaths: string[] = [];

  for (const relPath of runtimeFiles) {
    const normalized = relPath.replace(/\\/g, '/').replace(/^\.\//, '');
    if (!normalized || normalized === '.') continue;

    const matched = ALLOWLISTED_PATH_PREFIXES.some((prefix) =>
      prefix.endsWith('/') ? normalized.startsWith(prefix) : normalized === prefix
    );

    if (!matched) {
      unallowlistedPaths.push(normalized);
    }
  }

  return {
    valid: unallowlistedPaths.length === 0,
    unallowlistedPaths,
  };
}

/**
 * Checks that all required components are present.
 */
export function verifyComponentRequirements(presentComponentIds: readonly string[]): {
  valid: boolean;
  missingRequired: string[];
} {
  const presentSet = new Set(presentComponentIds);
  const missingRequired: string[] = [];

  for (const [id, def] of Object.entries(MODULAR_COMPONENT_DEFINITIONS)) {
    if (def.category === 'required' && !presentSet.has(id)) {
      missingRequired.push(id);
    }
  }

  return {
    valid: missingRequired.length === 0,
    missingRequired,
  };
}

/**
 * Builds a typed ModularPackagingGraph given metadata and component statuses.
 */
export function generateModularPackagingGraph(opts: {
  upstreamCommit: string;
  wrapperCommit: string;
  buildTimestamp: string;
  targetArchitecture: string;
  variant: 'full' | 'core_minimal' | 'custom';
  components: Record<string, RuntimeComponent>;
  runtimeFiles: readonly string[];
}): ModularPackagingGraph {
  const allowlistResult = validateRuntimeAllowlist(opts.runtimeFiles);

  let totalSizeBytes = 0;
  for (const comp of Object.values(opts.components)) {
    if (comp.sizeBytes) {
      totalSizeBytes += comp.sizeBytes;
    }
  }

  return {
    upstreamCommit: opts.upstreamCommit,
    wrapperCommit: opts.wrapperCommit,
    buildTimestamp: opts.buildTimestamp,
    targetArchitecture: opts.targetArchitecture,
    variant: opts.variant,
    components: opts.components,
    totalSizeBytes,
    allowlistPassed: allowlistResult.valid,
    unallowlistedPaths: allowlistResult.unallowlistedPaths,
  };
}

/**
 * Compares full and core minimal variants to produce size and component deltas.
 */
export function comparePackagingVariants(
  fullGraph: ModularPackagingGraph,
  coreGraph: ModularPackagingGraph
): {
  fullSizeBytes: number;
  coreSizeBytes: number;
  savingsBytes: number;
  savingsPercent: number;
  omittedComponents: string[];
} {
  const fullSize = fullGraph.totalSizeBytes;
  const coreSize = coreGraph.totalSizeBytes;
  const savingsBytes = fullSize > coreSize ? fullSize - coreSize : 0;
  const savingsPercent = fullSize > 0 ? Number(((savingsBytes / fullSize) * 100).toFixed(2)) : 0;

  const fullComps = Object.keys(fullGraph.components);
  const coreComps = new Set(Object.keys(coreGraph.components).filter((k) => coreGraph.components[k]?.status === 'present'));

  const omittedComponents = fullComps.filter((c) => !coreComps.has(c));

  return {
    fullSizeBytes: fullSize,
    coreSizeBytes: coreSize,
    savingsBytes,
    savingsPercent,
    omittedComponents,
  };
}
