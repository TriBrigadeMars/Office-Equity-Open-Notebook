/**
 * Office of Equity Open Notebook — FastAPI / Native Backend Feasibility Study Contracts (L7.6)
 *
 * Provides functions to evaluate API route groups by downstream dependency graph, assess Python process
 * removal feasibility, identify IPC/serialization/streaming complexity, estimate upstream sync risks and
 * resource wins, define parity test plans, and record Candidate/No-Go decisions per Master Plan Section 32 / Workstream 24.
 */

import {
  ApiRouteGroupMapping,
  IpcStreamingComplexityAnalysis,
  UpstreamSyncAndTestBurden,
  ResourceWinEstimate,
  ParityTestPlan,
  RouteGroupFeasibilityMatrixItem,
  FastApiNativeBackendStudyReport,
} from '../types';

/**
 * API routes grouped by downstream dependency graph and Python process removal assessment.
 */
export function getL76RouteGroupMappings(): readonly ApiRouteGroupMapping[] {
  return [
    {
      groupId: 'system_utility',
      groupName: 'System & Utility Routes',
      description: 'System health checks, version information, and configuration status endpoints.',
      routes: ['/api/health', '/api/version'],
      downstreamDependencies: ['SurrealDB async RPC client', 'Environment configuration', 'FastAPI state'],
      pythonProcessRemovalPossible: false,
      removalReasoning:
        'While basic health checking could theoretically be served by a native host, SurrealDB connection verification and Python worker status checks require Python backend execution.',
    },
    {
      groupId: 'crud_data',
      groupName: 'CRUD Data Routes',
      description: 'Notebook, note, and source metadata list, create, read, update, and delete endpoints.',
      routes: ['/api/notebooks/*', '/api/notes/*', '/api/sources/*'],
      downstreamDependencies: ['SurrealDB async client', 'open_notebook.domain models', 'Pydantic schemas'],
      pythonProcessRemovalPossible: false,
      removalReasoning:
        'Replacing FastAPI HTTP routing does NOT remove the Python process because Python domain models, Pydantic validations, and background worker tasks are still required for note processing.',
    },
    {
      groupId: 'llm_chat_streaming',
      groupName: 'LLM & Chat Streaming Routes',
      description: 'Interactive chat completion token streaming, summarize notes, and AI model credentials endpoints.',
      routes: ['/api/chat/stream', '/api/notes/summarize', '/api/models/*'],
      downstreamDependencies: ['OpenAI SDK', 'LangChain', 'TikToken', 'httpx', 'Async SSE token streaming'],
      pythonProcessRemovalPossible: false,
      removalReasoning:
        'Heavily dependent on Python LLM and tokenization libraries. Rewriting HTTP handlers leaves 100% of the Python ML dependency graph intact.',
    },
    {
      groupId: 'upload_ingestion_trigger',
      groupName: 'Document Upload & Ingestion Trigger Routes',
      description: 'Multipart document file upload and background document extraction trigger endpoints.',
      routes: ['/api/sources/upload', '/api/sources/process'],
      downstreamDependencies: ['FastAPI UploadFile', 'multipart boundary parser', 'Docling', 'fitz', 'SurrealDB queue'],
      pythonProcessRemovalPossible: false,
      removalReasoning:
        'Document parsing and layout extraction rely on Python ML packages (Docling, PyTorch). Native HTTP upload routing would still need to forward payloads to Python workers via IPC.',
    },
    {
      groupId: 'audio_podcast_streaming',
      groupName: 'Audio & Podcast Generation Routes',
      description: 'Podcast synthesis status updates, SSE progress streaming, and audio transcription endpoints.',
      routes: ['/api/podcasts/*', '/api/podcasts/progress'],
      downstreamDependencies: ['Faster-Whisper', 'PyTorch', 'Audio TTS pipelines', 'Chunked SSE streaming'],
      pythonProcessRemovalPossible: false,
      removalReasoning:
        'Audio inference and speech synthesis rely entirely on Python frameworks. Replacing FastAPI handlers merely introduces IPC complexity without removing Python.',
    },
  ];
}

/**
 * Assessment of new IPC, serialization, and streaming complexity introduced by a native front/backend.
 */
export function getL76IpcStreamingComplexity(): IpcStreamingComplexityAnalysis {
  return {
    ipcProtocolComplexity:
      'Replacing loopback HTTP proxying with custom native IPC requires implementing custom IPC transport layers (gRPC, Unix Domain Sockets, or stdin/stdout JSON-RPC) between the native front and Python processes.',
    serializationOverhead:
      'Marshaling requests into JSON/Protobuf, transmitting across IPC boundaries, and deserializing in Python adds CPU overhead and memory allocations compared to native loopback HTTP proxying.',
    streamingHandlingComplexity:
      'Unbuffered SSE token streaming (/api/chat/stream) requires custom chunk framing, backpressure flow control, and client cancellation signal propagation across IPC boundaries.',
    multipartUploadHandling:
      'Forwarding 50MB document uploads (/api/sources/upload) across IPC requires chunked buffer streaming or shared memory/file descriptor management, adding memory copy overhead.',
    overallIpcComplexityRating: 'extreme',
  };
}

/**
 * Estimate upstream synchronization and parity testing burden.
 */
export function getL76UpstreamSyncBurden(): UpstreamSyncAndTestBurden {
  return {
    upstreamSyncRisk: 'extreme',
    schemaDuplicationBurden:
      'High ongoing burden duplicating Pydantic models, OpenAPI schemas, and SurrealQL queries in Rust/C++ native code.',
    upstreamMaintenanceOverhead:
      'Every upstream open-notebook feature, schema update, or bugfix in Python would require manual dual-maintenance in native code, creating a permanent maintenance fork.',
    reasonsForSyncBurden: [
      'Upstream open-notebook frequently updates Pydantic validation schemas and REST route specifications.',
      'Re-implementing FastAPI 422 Unprocessable Entity error structures in native code risks subtle API drift.',
      'Maintaining dual schemas in Python and Rust/C++ multiplies test and regression risk.',
      'Native backend rewrites merely add IPC glue code while leaving Python dependencies intact.',
    ],
  };
}

/**
 * Realistic resource wins estimated from measured baseline data (L6).
 */
export function getL76ResourceWinEstimate(): ResourceWinEstimate {
  return {
    currentUvicornMemoryRssMb: 120.0,
    projectedNativeBackendMemoryRssMb: 20.0,
    netMemorySavingsMb: 0.0,
    latencyImpactMs: -1.5,
    coldStartImpactMs: 0.0,
    measuredBenefitAssessment:
      'Negligible resource wins (<2ms latency difference, 0 MB net RAM savings since Python is still required for ML/worker tasks) that fail to justify the extreme IPC complexity and upstream maintenance burden.',
  };
}

/**
 * Required parity-test plan for any route group considered for native migration.
 */
export function getL76ParityTestPlan(): ParityTestPlan {
  return {
    requiredSuites: [
      {
        suiteName: 'Health & Version Parity Suite',
        description: 'Validates exact response format, status codes, and SurrealDB connectivity indicators.',
        coveredEndpoints: ['/api/health', '/api/version'],
        verificationCriteria: [
          'HTTP 200 status code',
          'JSON body structure matching FastAPI schema',
          'Database connectivity status reported correctly',
        ],
      },
      {
        suiteName: 'CRUD & Query Schema Parity Suite',
        description: 'Validates REST endpoints for notebooks, notes, and sources including 404 and 422 error structures.',
        coveredEndpoints: ['/api/notebooks/*', '/api/notes/*', '/api/sources/*'],
        verificationCriteria: [
          'Identical JSON field types and date formats',
          'FastAPI 422 Unprocessable Entity validation error format matching',
          '404 Not Found error detail field parity',
        ],
      },
      {
        suiteName: 'Multipart Upload & Limit Parity Suite',
        description: 'Validates 50MB file upload limits, multipart boundary handling, and payload truncation rejection.',
        coveredEndpoints: ['/api/sources/upload'],
        verificationCriteria: [
          '50MB (52,428,800 bytes) threshold enforcement',
          'HTTP 413 Payload Too Large error response',
          'HTTP 400 Bad Request on missing file part',
        ],
      },
      {
        suiteName: 'Unbuffered SSE Stream Parity Suite',
        description: 'Validates chunked token streaming, header correctness, and disconnect cancellation behavior.',
        coveredEndpoints: ['/api/chat/stream', '/api/podcasts/progress'],
        verificationCriteria: [
          'Headers: content-type: text/event-stream, x-accel-buffering: no',
          'Chunk latency < 50ms per token frame',
          'Clean upstream stream cancellation upon client disconnect',
        ],
      },
    ],
    totalEndpointsCovered: 12,
    estimatedParityTestEffort: '3-4 weeks of full-coverage test automation',
  };
}

/**
 * Feasibility matrix for candidate route groups.
 */
export function getL76FeasibilityMatrix(): readonly RouteGroupFeasibilityMatrixItem[] {
  return [
    {
      groupId: 'system_utility',
      title: 'System & Utility Routes',
      decision: 'NO_GO',
      rationale:
        'Trivial resource wins (<1 MB RAM) far outweighed by the cost of IPC integration with Python backend health indicators.',
      pros: ['Slightly lower HTTP handler overhead'],
      cons: ['Requires IPC signaling to verify Python process state', 'Zero impact on total app RAM'],
    },
    {
      groupId: 'crud_data',
      title: 'CRUD Data Routes',
      decision: 'REJECT_REWRITE',
      rationale:
        'Python process must remain alive for domain logic, Pydantic validation, and background worker jobs; replacing Uvicorn saves 0 MB net RAM while creating high upstream sync burden.',
      pros: ['Slightly faster static route parsing (<1ms)'],
      cons: ['Extreme upstream schema sync burden', 'Duplication of Pydantic models in Rust/C++'],
    },
    {
      groupId: 'llm_chat_streaming',
      title: 'LLM & Chat Streaming Routes',
      decision: 'REJECT_REWRITE',
      rationale:
        'Execution time is dominated by LLM token generation (1,650 ms P95); native HTTP handler saves <1ms while introducing complex SSE streaming IPC.',
      pros: ['Native HTTP framing'],
      cons: ['Complex SSE framing over IPC', 'Python LLM dependencies remain untouched'],
    },
    {
      groupId: 'upload_ingestion_trigger',
      title: 'Document Upload & Ingestion Trigger Routes',
      decision: 'REJECT_REWRITE',
      rationale:
        'Rust Tauri host proxy already enforces the 50MB upload size limit; forwarding file streams across native IPC to Python workers adds buffer copy overhead.',
      pros: ['None over existing Rust Tauri proxy'],
      cons: ['IPC buffer copying overhead for 50MB files', 'Python Docling engine still required'],
    },
    {
      groupId: 'audio_podcast_streaming',
      title: 'Audio & Podcast Generation Routes',
      decision: 'REJECT_REWRITE',
      rationale:
        'Bound by PyTorch/Whisper audio processing; native HTTP front adds zero efficiency while increasing architectural complexity.',
      pros: ['None'],
      cons: ['IPC streaming complexity', 'Python ML libraries remain mandatory'],
    },
  ];
}

/**
 * Generate full FastAPI Native Backend Feasibility Study Report for Packet L7.6.
 */
export function generateFastApiNativeBackendStudyReport(): FastApiNativeBackendStudyReport {
  return {
    packetId: 'L7.6',
    title: 'FastAPI / Native Backend Feasibility Study Report',
    status: 'STUDY_COMPLETE_NO_REWRITE',
    summary:
      'Evaluated backend migration feasibility route-by-route across 5 route groups. Determined that replacing HTTP handling with a native backend would NOT remove any Python processes or ML dependencies, because Python is required for domain models, Pydantic validation, TikToken, PyTorch, Docling, and Whisper. Identified that a native backend would introduce extreme IPC and streaming complexity while producing negligible resource wins (<2ms latency, 0 MB net RAM savings). Recommends REJECTING all native backend code rewrites and retaining FastAPI proxied by the Rust Tauri host.',
    routeGroupMappings: getL76RouteGroupMappings(),
    ipcStreamingComplexity: getL76IpcStreamingComplexity(),
    upstreamSyncAndTestBurden: getL76UpstreamSyncBurden(),
    resourceWinEstimate: getL76ResourceWinEstimate(),
    parityTestPlan: getL76ParityTestPlan(),
    feasibilityMatrix: getL76FeasibilityMatrix(),
    overallRecommendation: {
      decision: 'REJECT_ALL_NATIVE_BACKEND_REWRITES',
      primaryRationale:
        'Rewriting FastAPI HTTP handlers in native Rust/C++ merely introduces IPC glue code without removing the Python process or Python ML dependencies. Net resource savings are negligible (<2ms latency, 0 MB net RAM) while upstream synchronization risk and maintenance debt are extreme. Retaining FastAPI proxied by the native Tauri host (src-tauri) delivers maximum stability, 100% upstream alignment, and zero architectural risk.',
      recommendedArchitecture:
        'Rust Tauri Native Host (src-tauri) serving static frontend assets + proxying /api/* to FastAPI (Uvicorn) + On-Demand Python Worker with process recycling (max_tasks_per_child = 5).',
      actionableNextSteps: [
        'Maintain existing Rust Tauri native host proxy for static assets and API loopback forwarding.',
        'Reject any proposal to rewrite FastAPI routes or Pydantic domain models in native C++/Rust code.',
        'Focus optimization efforts on worker process recycling and lazy Python imports established in L7.5.',
      ],
    },
  };
}

/**
 * Validate that FastAPI Native Backend Study Report satisfies Packet L7.6 rules.
 */
export function validateFastApiNativeBackendStudyReport(report: FastApiNativeBackendStudyReport): boolean {
  if (report.packetId !== 'L7.6') return false;
  if (report.status !== 'STUDY_COMPLETE_NO_REWRITE') return false;
  if (!report.routeGroupMappings || report.routeGroupMappings.length < 5) return false;

  for (const group of report.routeGroupMappings) {
    if (group.pythonProcessRemovalPossible !== false) return false;
  }

  if (report.ipcStreamingComplexity.overallIpcComplexityRating !== 'extreme') return false;
  if (report.upstreamSyncAndTestBurden.upstreamSyncRisk !== 'extreme') return false;
  if (!report.feasibilityMatrix || report.feasibilityMatrix.length < 5) return false;

  for (const item of report.feasibilityMatrix) {
    if (item.decision !== 'NO_GO' && item.decision !== 'REJECT_REWRITE') return false;
  }

  if (report.overallRecommendation.decision !== 'REJECT_ALL_NATIVE_BACKEND_REWRITES') return false;
  if (!report.overallRecommendation.actionableNextSteps || report.overallRecommendation.actionableNextSteps.length === 0) return false;

  return true;
}
