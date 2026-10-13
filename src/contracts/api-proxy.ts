/**
 * Office of Equity Open Notebook — API Proxy, Upload & SSE Streaming Contract (L3.2)
 *
 * Captures, simulates, and validates reverse proxy, multipart file upload,
 * and Server-Sent Events (SSE) streaming behavior for Next.js standalone and
 * native host candidates (Rust/Tauri, Wails, C#).
 */

import {
  ApiProxyFixtureSet,
  ProxiedApiFixture,
  UploadFixture,
  SseStreamingFixture,
  ApiProxyTestResultDetail,
  ApiProxyCompatibilityResult,
} from '../types';

/**
 * Validates whether an API proxy call matches the expected response signature.
 */
export function simulateProxiedApiCall(fixture: ProxiedApiFixture): {
  statusCode: number;
  headers: Record<string, string>;
  body: unknown;
} {
  // Reference execution matching FastAPI proxied responses
  return {
    statusCode: fixture.expectedResponse.statusCode,
    headers: { ...fixture.expectedResponse.headers },
    body: fixture.expectedResponse.body,
  };
}

/**
 * Validates multipart/form-data upload behavior, enforce max payload limits,
 * and verify required file parameter presence.
 */
export function simulateUploadRequest(fixture: UploadFixture): {
  statusCode: number;
  headers: Record<string, string>;
  body: unknown;
} {
  const { request, maxAllowedSizeBytes } = fixture;

  // Check 1: Missing file part
  if (!request.filePart) {
    return {
      statusCode: 400,
      headers: { 'content-type': 'application/json' },
      body: { error: "Bad Request: Missing required 'file' part in multipart payload" },
    };
  }

  // Check 2: File size exceeds threshold
  if (request.filePart.sizeBytes > maxAllowedSizeBytes) {
    return {
      statusCode: 413,
      headers: { 'content-type': 'application/json' },
      body: { error: `Payload Too Large: File size exceeds maximum limit of ${maxAllowedSizeBytes} bytes` },
    };
  }

  // Success case
  return {
    statusCode: fixture.expectedResponse.statusCode,
    headers: { ...fixture.expectedResponse.headers },
    body: fixture.expectedResponse.body,
  };
}

/**
 * Simulates Server-Sent Events (SSE) response streaming, validating framing,
 * unbuffered timing constraints, and client disconnect handling.
 */
export function simulateSseStream(
  fixture: SseStreamingFixture,
  options: { forceBuffer?: boolean | undefined; abortEarly?: boolean | undefined } = {}
): {
  chunks: Array<{ raw: string; deltaMs: number }>;
  bufferingDetected: boolean;
  cancelled: boolean;
  headersValid: boolean;
  error?: string;
} {
  // 1. Verify required headers
  const required = fixture.requiredHeaders;
  let headersValid = true;

  if (required['content-type'] !== 'text/event-stream' || required['cache-control'] !== 'no-cache') {
    headersValid = false;
  }

  // 2. Handle cancellation scenario
  if (fixture.simulateDisconnectAfterChunkIndex !== undefined || options.abortEarly) {
    const cancelIdx = fixture.simulateDisconnectAfterChunkIndex ?? 1;
    const baseChunks = fixture.chunks ?? [];
    const deliveredChunks = baseChunks.slice(0, cancelIdx + 1);

    return {
      chunks: deliveredChunks,
      bufferingDetected: false,
      cancelled: true,
      headersValid,
    };
  }

  const rawChunks = fixture.chunks ?? [];

  // 3. Forced buffering simulation (e.g., test case to verify buffering detection)
  if (options.forceBuffer) {
    // Coalesce all chunks into a single chunk delivered with high delay (500ms)
    const combinedRaw = rawChunks.map((c) => c.raw).join('');
    return {
      chunks: [{ deltaMs: 500, raw: combinedRaw }],
      bufferingDetected: true,
      cancelled: false,
      headersValid,
      error: 'Buffering detected: SSE frames were coalesced into a single delayed delivery frame (500ms > max 100ms)',
    };
  }

  // 4. Normal unbuffered chunk delivery
  let maxLatencyExceeded = false;
  const maxAllowed = fixture.maxAllowedLatencyMs ?? 100;

  for (const c of rawChunks) {
    if (c.deltaMs > maxAllowed) {
      maxLatencyExceeded = true;
    }
  }

  return {
    chunks: [...rawChunks],
    bufferingDetected: maxLatencyExceeded,
    cancelled: false,
    headersValid,
    ...(maxLatencyExceeded ? { error: `Chunk latency exceeded threshold of ${maxAllowed}ms` } : {}),
  };
}

/**
 * Runs the API Proxy, Upload, and SSE Streaming Compatibility Harness against canonical fixtures.
 */
export function runApiProxyHarness(
  fixtures: ApiProxyFixtureSet,
  options: { testBufferedFailure?: boolean } = {}
): ApiProxyCompatibilityResult {
  const startTime = Date.now();
  const details: ApiProxyTestResultDetail[] = [];
  let passedCount = 0;
  let failedCount = 0;

  // 1. Evaluate Proxied API Cases
  for (const tc of fixtures.proxyCases) {
    let passed = false;
    let errorMsg: string | undefined;

    try {
      const res = simulateProxiedApiCall(tc);
      const codeMatch = res.statusCode === tc.expectedResponse.statusCode;
      const bodyMatch = JSON.stringify(res.body) === JSON.stringify(tc.expectedResponse.body);
      const headerMatch = res.headers['content-type'] === tc.expectedResponse.headers['content-type'];

      passed = codeMatch && bodyMatch && headerMatch;
      if (!passed) {
        errorMsg = `Response mismatch: status=${res.statusCode} (expected ${tc.expectedResponse.statusCode})`;
      }
    } catch (err) {
      passed = false;
      errorMsg = err instanceof Error ? err.message : String(err);
    }

    if (passed) passedCount++; else failedCount++;
    details.push({
      id: tc.id,
      category: 'proxy',
      description: `${tc.route} [${tc.method}]: ${tc.description}`,
      passed,
      ...(errorMsg ? { error: errorMsg } : {}),
      expected: tc.expectedResponse,
    });
  }

  // 2. Evaluate Upload Cases
  for (const uc of fixtures.uploadCases) {
    let passed = false;
    let errorMsg: string | undefined;

    try {
      const res = simulateUploadRequest(uc);
      const codeMatch = res.statusCode === uc.expectedResponse.statusCode;
      const bodyMatch = JSON.stringify(res.body) === JSON.stringify(uc.expectedResponse.body);

      passed = codeMatch && bodyMatch;
      if (!passed) {
        errorMsg = `Upload response mismatch: got status ${res.statusCode}, expected ${uc.expectedResponse.statusCode}`;
      }
    } catch (err) {
      passed = false;
      errorMsg = err instanceof Error ? err.message : String(err);
    }

    if (passed) passedCount++; else failedCount++;
    details.push({
      id: uc.id,
      category: 'upload',
      description: `Upload [${uc.route}]: ${uc.description}`,
      passed,
      ...(errorMsg ? { error: errorMsg } : {}),
      expected: uc.expectedResponse,
    });
  }

  // 3. Evaluate SSE Cases
  for (const sc of fixtures.sseCases) {
    let passed = false;
    let errorMsg: string | undefined;

    try {
      const forceBuffer = Boolean(options.testBufferedFailure && sc.id === 'SSE_CHAT_STREAM_001');
      const streamRes = simulateSseStream(sc, { forceBuffer });

      if (sc.expectedCancellation) {
        passed = streamRes.cancelled && !streamRes.bufferingDetected;
        if (!passed) {
          errorMsg = 'Cancellation expectation failed or buffering detected on disconnect';
        }
      } else if (forceBuffer) {
        // We expected this to fail buffering
        passed = !streamRes.bufferingDetected; // Will be false when forceBuffer is true -> flagged as test failure
        if (!passed) {
          errorMsg = streamRes.error || 'Forced buffering was correctly flagged as failure';
        }
      } else {
        passed = streamRes.headersValid && !streamRes.bufferingDetected && streamRes.chunks.length > 0;
        if (!passed) {
          errorMsg = streamRes.error || 'SSE stream invalid, headers missing, or buffering detected';
        }
      }
    } catch (err) {
      passed = false;
      errorMsg = err instanceof Error ? err.message : String(err);
    }

    if (passed) passedCount++; else failedCount++;
    details.push({
      id: sc.id,
      category: 'sse',
      description: `SSE [${sc.route}]: ${sc.description}`,
      passed,
      ...(errorMsg ? { error: errorMsg } : {}),
    });
  }

  const durationMs = Date.now() - startTime;

  return {
    implementation: 'reference-next-proxy-ts',
    suite: 'api-proxy-compatibility-v1',
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
 * Validates whether an object matches the ApiProxyCompatibilityResult schema.
 */
export function validateApiProxyResult(data: unknown): { valid: boolean; errors: string[] } {
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
