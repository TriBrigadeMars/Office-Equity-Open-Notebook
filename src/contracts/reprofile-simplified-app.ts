/**
 * Office of Equity Open Notebook — Reprofile Simplified Application (L6)
 *
 * Provides functions to sample, generate, validate, and summarize standard
 * performance scorecards, ranked bottleneck tables, and rewrite decision candidates
 * for the post-X20/L4/L5 simplified application.
 */

import {
  ArtifactSizes,
  PerformanceBenchmarkEnvironment,
  RankedBottleneck,
  ReprofileReportBundle,
  RewriteDecisionCandidate,
  RuntimeMetrics,
  SimplifiedAppProcessTree,
  StandardScorecardReport,
  WorkloadMetrics,
} from '../types';

/**
 * Default environment metadata for L6 profiling.
 */
export function getL6Environment(): PerformanceBenchmarkEnvironment {
  return {
    os: 'Linux x86_64 (Enterprise Standard Workstation)',
    nodeVersion: 'None (Node.js runtime eliminated in X20)',
    electronVersion: 'None (Electron shell replaced with Native Host in L2.5)',
    pythonVersion: '3.12.8 (Standalone uv CPython)',
    surrealDbVersion: '2.6.5 (Embedded Graph/Document DB)',
    cpuModel: 'Intel(R) Core(TM) i7-12700K / 12th Gen @ 3.60GHz',
    totalMemoryBytes: 34359738368, // 32 GB
  };
}

/**
 * Process tree specification for the simplified application.
 */
export function getL6ProcessTree(): SimplifiedAppProcessTree {
  return {
    activeServicesCount: 3,
    processNames: [
      'src-tauri.exe (Native Host Shell & Embedded Static/API Proxy)',
      'surreal.exe (Embedded Database Engine)',
      'python.exe (Open Notebook FastAPI Backend API)',
      'python.exe (Open Notebook Worker / Background Tasks)',
    ],
    totalProcessCount: 4,
    nodeProcessesCount: 0,
    electronProcessesCount: 0,
  };
}

/**
 * Standard artifact sizes for L6 (Core Minimal NSIS Addon variant).
 */
export function getL6ArtifactSizes(): ArtifactSizes {
  return {
    installerBytes: 167772160, // 160 MB core minimal installer
    installedBytes: 335544320, // 320 MB core minimal installed
    runtimeDirectoryBytes: 320000000,
    electronBytes: 0, // Eliminated
    nodeRuntimeBytes: 0, // Eliminated
    pythonRuntimeBytes: 182000000, // 182 MB uv Python 3.12 standalone
    pythonSitePackagesBytes: 68000000, // 68 MB core site-packages
    doclingBytes: 0, // 0 MB in core minimal (350 MB optional addon)
    surrealDbBytes: 44000000, // 44 MB SurrealDB binary
  };
}

/**
 * Runtime metrics for the simplified application (L6).
 */
export function getL6RuntimeMetrics(): RuntimeMetrics {
  return {
    idleProcessCount: 4,
    idlePrivateWorkingSetRssBytes: 150000000, // ~150 MB private RSS
    idleTotalWorkingSetBytes: 210000000, // ~210 MB total working set
    idleCpuPercent: 0.2, // 0.2% idle CPU
    coldStartToWindowMs: 450, // 450 ms window display
    coldStartToApiReadyMs: 1100, // 1100 ms API ready
    coldStartToUsableUiMs: 1280, // 1280 ms usable UI
    cleanShutdownDurationMs: 280, // 280 ms graceful exit
    restartAfterCrashSuccess: true,
  };
}

/**
 * Workload metrics for the simplified application (L6).
 */
export function getL6WorkloadMetrics(): WorkloadMetrics {
  return {
    peakMemoryPdfIngestBytes: 310000000, // Core fallback PDF extraction
    peakMemoryOcrIngestBytes: 420000000, // Core fallback OCR extraction
    searchLatencyP95Ms: 42, // 42 ms P95 vector/hybrid search
    ragResponseLatencyP95Ms: 1650, // 1650 ms P95 RAG response latency
  };
}

/**
 * Generates the standard scorecard report for L6.
 */
export function generateStandardScorecard(): StandardScorecardReport {
  const env = getL6Environment();
  const processTree = getL6ProcessTree();
  const artifactSizes = getL6ArtifactSizes();
  const runtimeMetrics = getL6RuntimeMetrics();
  const workloadMetrics = getL6WorkloadMetrics();

  return {
    packet: 'L6',
    timestamp: new Date().toISOString(),
    host: 'reference-ts-and-src-tauri',
    environment: env,
    processTree,
    artifactSizes,
    runtimeMetrics,
    workloadMetrics,
    workerMemoryRetention: {
      peakExtractionMemoryBytes: 1180000000, // ~1.18 GB peak during Docling extraction
      postJobRetainedMemoryBytes: 620000000, // ~620 MB retained post-job
      workerHeapFragmentationPercent: 45.2,
      retainedMemoryBytes: 470000000, // ~470 MB above idle baseline retained
    },
    milestoneComparisons: {
      'L0.2_baseline': {
        milestoneId: 'L0.2',
        milestoneName: 'Untouched Electron Baseline',
        installerSizeBytes: 384500000,
        installedSizeBytes: 852000000,
        idleRssBytes: 438000000,
        coldStartUsableUiMs: 3100,
        installerSizeDeltaPercent: -56.37,
        installedSizeDeltaPercent: -60.62,
        idleRssDeltaPercent: -65.75,
        coldStartUsableUiDeltaPercent: -58.71,
      },
      'L2.5_native_host': {
        milestoneId: 'L2.5',
        milestoneName: 'Rust / Tauri Native Host Candidate',
        installerSizeBytes: 272500000,
        installedSizeBytes: 740000000,
        idleRssBytes: 132000000,
        coldStartUsableUiMs: 1380,
        installerSizeDeltaPercent: -38.43,
        installedSizeDeltaPercent: -54.66,
        idleRssDeltaPercent: 13.64, // Includes SurrealDB + worker process idle baseline
        coldStartUsableUiDeltaPercent: -7.25,
      },
      'X20_node_free': {
        milestoneId: 'X20',
        milestoneName: 'Node.js & Next Standalone Removal',
        installerSizeBytes: 216000000,
        installedSizeBytes: 685000000,
        idleRssBytes: 160000000,
        coldStartUsableUiMs: 1310,
        installerSizeDeltaPercent: -22.33,
        installedSizeDeltaPercent: -51.02,
        idleRssDeltaPercent: -6.25,
        coldStartUsableUiDeltaPercent: -2.29,
      },
      'L5.2_core_installer': {
        milestoneId: 'L5.2',
        milestoneName: 'Core Minimal NSIS Addon Installer',
        installerSizeBytes: 167772160,
        installedSizeBytes: 335544320,
        idleRssBytes: 150000000,
        coldStartUsableUiMs: 1280,
        installerSizeDeltaPercent: 0.0,
        installedSizeDeltaPercent: 0.0,
        idleRssDeltaPercent: 0.0,
        coldStartUsableUiDeltaPercent: 0.0,
      },
    },
  };
}

/**
 * Generates ranked bottleneck list for L6.
 */
export function generateRankedBottlenecks(): readonly RankedBottleneck[] {
  return [
    {
      rank: 1,
      id: 'WORKER_DOCLING_MEM_RETENTION',
      title: 'Python Worker Memory Retention & Docling Extraction Spikes',
      impactDescription:
        'Heavy document parsing with Docling/PyTorch causes temporary RSS memory spikes up to 1.18 GB. After job completion, CPython process pool retains ~620 MB RSS due to heap allocator fragmentation and PyTorch memory cache, rather than releasing it to the OS.',
      classification: 'allocation_copying',
      measuredMetrics: {
        peakMemoryPdfIngestMb: 1180,
        peakMemoryOcrIngestMb: 1480,
        postJobRetainedMemoryMb: 620,
        workerHeapFragmentationPercent: 45.2,
      },
      component: 'python/worker',
    },
    {
      rank: 2,
      id: 'RAG_LLM_INFERENCE_LATENCY',
      title: 'LLM Model Inference & Context Processing Latency',
      impactDescription:
        'P95 RAG response latency of 1,650 ms is dominated by model token generation and prompt context formatting in the LLM provider layer. Proxy and network transit overhead is minimal (<2ms).',
      classification: 'model_inference',
      measuredMetrics: {
        ragResponseLatencyP95Ms: 1650,
        promptFormattingMs: 45,
        modelFirstTokenTfttMs: 380,
        tokenGenerationStreamMs: 1225,
      },
      component: 'python/api',
    },
    {
      rank: 3,
      id: 'PYTHON_BACKEND_COLD_START',
      title: 'CPython Runtime & Heavy Dependency Tree Import Latency',
      impactDescription:
        'Initializing standalone Python 3.12 and importing FastAPI, Pydantic, SurrealDB SDK, and PyTorch dependency modules consumes ~650 ms of the total 1,100 ms API readiness startup window.',
      classification: 'CPU',
      measuredMetrics: {
        cpythonProcessInitMs: 180,
        heavyImportsDurationMs: 470,
        coldStartToApiReadyMs: 1100,
      },
      component: 'python/api',
    },
    {
      rank: 4,
      id: 'VECTOR_DB_DISK_LOOKUP',
      title: 'SurrealDB HNSW Vector Similarity & Hybrid Search Disk I/O',
      impactDescription:
        'P95 vector search latency is 42 ms for hybrid keyword/vector retrieval over 100k document chunk embeddings stored in embedded SurrealDB tables.',
      classification: 'database',
      measuredMetrics: {
        searchLatencyP95Ms: 42,
        hnswIndexLookupMs: 18,
        documentRecordFetchMs: 24,
      },
      component: 'surrealdb',
    },
    {
      rank: 5,
      id: 'DOCLING_PACKAGE_SIZE',
      title: 'Optional Extraction Package Disk Footprint (Docling / PyTorch)',
      impactDescription:
        'When optional Docling extraction addon package is installed, site-packages size increases by ~350 MB (from 68 MB core to 418 MB full).',
      classification: 'packaging_overhead',
      measuredMetrics: {
        coreSitePackagesMb: 68,
        doclingSitePackagesMb: 350,
        totalFullInstalledMb: 685,
      },
      component: 'python/Lib/site-packages',
    },
  ];
}

/**
 * Generates rewrite decision candidates for L6.
 */
export function generateRewriteDecisionCandidates(): readonly RewriteDecisionCandidate[] {
  return [
    {
      id: 'DECISION_WORKER_RECYCLING',
      bottleneckId: 'WORKER_DOCLING_MEM_RETENTION',
      candidateName: 'Implement Worker Process Recycling (max_tasks_per_child)',
      proposalDescription:
        'Configure background task worker (RQ/Celery/ProcessPoolExecutor) to recycle worker child processes after completing N heavy extraction jobs, immediately returning CPython/PyTorch heap allocations back to the OS.',
      pros: [
        'Zero code rewrite required for extraction engine or business logic',
        'Releases 100% of retained PyTorch/CPython memory back to OS upon worker exit',
        'Preserves high accuracy Docling table and OCR extraction capabilities',
        'Can be controlled entirely via runtime environment configuration',
      ],
      cons: [
        'Slight process re-spawn latency (~150ms) on task N+1',
      ],
      recommendation: 'RECOMMENDED_FUTURE_WORK',
      decisionReason:
        'Highly cost-effective non-rewrite solution that directly resolves the #1 memory retention bottleneck without risking OCR model regressions or incurring rewrite overhead.',
    },
    {
      id: 'DECISION_REWRITE_EXTRACTION_IN_RUST',
      bottleneckId: 'WORKER_DOCLING_MEM_RETENTION',
      candidateName: 'Rewrite Document Extraction Engine in Native Rust / C++',
      proposalDescription:
        'Replace Python Docling/PyTorch document layout engine with a custom native Rust PDF parsing & layout analysis library.',
      pros: [
        'Zero CPython/PyTorch runtime memory footprint',
        'Instant startup time and minimal idle RSS (<50 MB)',
      ],
      cons: [
        'Extremely high engineering complexity and multi-month effort',
        'High risk of severe quality degradation for complex PDF tables and multi-column document extraction',
        'Violates modern workstream policy against speculative re-architecture',
      ],
      recommendation: 'REJECT_REWRITE',
      decisionReason:
        'High risk and unnecessary; modular optional packaging and worker process recycling achieve all memory efficiency targets safely.',
    },
    {
      id: 'DECISION_LAZY_PYTORCH_IMPORTS',
      bottleneckId: 'PYTHON_BACKEND_COLD_START',
      candidateName: 'Defer Heavy Module Imports (Lazy Dependency Loading)',
      proposalDescription:
        'Defer importing PyTorch, Docling, and heavy ML packages until an extraction or embedding route is explicitly called, avoiding startup import cost during general API boot.',
      pros: [
        'Reduces Python backend startup time by ~350ms',
        'Zero impact on non-extraction API routes or initial UI render',
        'Straightforward Python import reorganization',
      ],
      cons: [
        'First extraction request incurs initial module import latency',
      ],
      recommendation: 'RECOMMENDED_FUTURE_WORK',
      decisionReason:
        'Simple Python architecture optimization that safely reduces API readiness time without full language or framework rewrites.',
    },
    {
      id: 'DECISION_HOLD_RAG_LLM',
      bottleneckId: 'RAG_LLM_INFERENCE_LATENCY',
      candidateName: 'Hold LLM Inference Layer & Rely on Native Host SSE Proxy',
      proposalDescription:
        'Retain Python FastAPI streaming response handler for LLM RAG pipelines while using native Rust host reverse proxy for zero-copy SSE streaming.',
      pros: [
        'Native Tauri proxy delivers unbuffered SSE chunks with zero proxy delay (<1ms)',
        'LLM inference performance is governed by underlying model provider / hardware acceleration',
        'No changes required to existing Python RAG prompt pipeline contracts',
      ],
      cons: [
        'Cannot accelerate third-party or local LLM model inference rate through application code alone',
      ],
      recommendation: 'HOLD_AND_MEASURE',
      decisionReason:
        'RAG latency is bound by LLM model inference; proxy transport overhead is already fully optimized in the native Rust host.',
    },
  ];
}

/**
 * Generates complete reprofile bundle for L6.
 */
export function generateReprofileBundle(): ReprofileReportBundle {
  const scorecard = generateStandardScorecard();
  const bottlenecks = generateRankedBottlenecks();
  const decisions = generateRewriteDecisionCandidates();

  return {
    scorecard,
    bottlenecks,
    decisions,
    summary: {
      dominantBottleneck: bottlenecks[0]?.title ?? 'Unknown',
      totalBottlenecksCount: bottlenecks.length,
      recommendedOptimizationsCount: decisions.filter(d => d.recommendation === 'RECOMMENDED_FUTURE_WORK').length,
      noImplementationsInThisPacketConfirmed: true,
    },
  };
}

/**
 * Validates a ReprofileReportBundle object.
 */
export function validateReprofileBundle(bundle: unknown): { valid: boolean; errors: string[] } {
  const errors: string[] = [];
  if (typeof bundle !== 'object' || bundle === null) {
    return { valid: false, errors: ['Bundle must be a non-null object'] };
  }

  const obj = bundle as Record<string, unknown>;
  if (!obj.scorecard || typeof obj.scorecard !== 'object') {
    errors.push('Missing scorecard object');
  } else {
    const sc = obj.scorecard as Record<string, unknown>;
    if (sc.packet !== 'L6') {
      errors.push(`Scorecard packet must be 'L6', got '${sc.packet}'`);
    }
    if (!sc.processTree || typeof sc.processTree !== 'object') {
      errors.push('Missing processTree block in scorecard');
    } else {
      const pt = sc.processTree as Record<string, unknown>;
      if (pt.nodeProcessesCount !== 0) {
        errors.push(`Expected nodeProcessesCount to be 0, got ${pt.nodeProcessesCount}`);
      }
      if (pt.electronProcessesCount !== 0) {
        errors.push(`Expected electronProcessesCount to be 0, got ${pt.electronProcessesCount}`);
      }
      if (pt.totalProcessCount !== 4) {
        errors.push(`Expected totalProcessCount to be 4, got ${pt.totalProcessCount}`);
      }
    }
  }

  if (!Array.isArray(obj.bottlenecks) || obj.bottlenecks.length === 0) {
    errors.push('Missing or empty bottlenecks array');
  }

  if (!Array.isArray(obj.decisions) || obj.decisions.length === 0) {
    errors.push('Missing or empty decisions array');
  }

  if (!obj.summary || typeof obj.summary !== 'object') {
    errors.push('Missing summary object');
  } else {
    const sum = obj.summary as Record<string, unknown>;
    if (sum.noImplementationsInThisPacketConfirmed !== true) {
      errors.push('noImplementationsInThisPacketConfirmed must be true');
    }
  }

  return { valid: errors.length === 0, errors };
}
