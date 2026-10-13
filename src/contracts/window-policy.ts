/**
 * Pure wrapper module for window navigation policy and URL origin verification.
 */

import { NavigationDecision } from '../types';

/**
 * Evaluates whether a navigation target URL should be allowed internally,
 * opened in an external browser, or denied.
 */
export function evaluateNavigationPolicy(
  targetUrl: string,
  frontendUrl: string = 'http://127.0.0.1:8502'
): NavigationDecision {
  if (!targetUrl || typeof targetUrl !== 'string') {
    return {
      action: 'deny',
      targetUrl: String(targetUrl || ''),
      reason: 'Target URL is missing or non-string',
    };
  }

  const normalizedTarget = targetUrl.trim();
  const normalizedFrontend = frontendUrl.trim().replace(/\/+$/, '');

  let targetUri: URL | null = null;
  let frontendUri: URL | null = null;

  try {
    targetUri = new URL(normalizedTarget);
  } catch {
    // Malformed URL or non-standard format
  }

  try {
    frontendUri = new URL(normalizedFrontend);
  } catch {
    // Fallback if frontendUrl is simple string
  }

  if (targetUri && frontendUri) {
    // Prevent authority user-info tricks (e.g. http://127.0.0.1:8502@evil.com)
    const hasUserInfo = Boolean(targetUri.username || targetUri.password);

    const targetPort = targetUri.port || (targetUri.protocol === 'http:' ? '80' : '443');
    const frontendPort = frontendUri.port || (frontendUri.protocol === 'http:' ? '80' : '443');

    const isInternalOrigin =
      targetUri.protocol.toLowerCase() === frontendUri.protocol.toLowerCase() &&
      targetUri.hostname.toLowerCase() === frontendUri.hostname.toLowerCase() &&
      targetPort === frontendPort &&
      !hasUserInfo;

    if (isInternalOrigin) {
      return {
        action: 'allow',
        targetUrl: normalizedTarget,
        reason: 'Internal navigation within frontend application',
      };
    }

    // External HTTP or HTTPS link
    if (
      targetUri.protocol.toLowerCase() === 'http:' ||
      targetUri.protocol.toLowerCase() === 'https:'
    ) {
      return {
        action: 'external',
        targetUrl: normalizedTarget,
        reason: 'External HTTP(S) link delegated to OS browser',
      };
    }

    // All other protocols (file:, javascript:, data:, vbscript:, etc.) are denied
    return {
      action: 'deny',
      targetUrl: normalizedTarget,
      reason: 'Unsupported or untrusted protocol',
    };
  }

  // String fallback for non-parseable edge case strings
  const lowerTarget = normalizedTarget.toLowerCase();

  if (
    normalizedTarget.startsWith(normalizedFrontend + '/') ||
    normalizedTarget === normalizedFrontend
  ) {
    return {
      action: 'allow',
      targetUrl: normalizedTarget,
      reason: 'Internal navigation within frontend application',
    };
  }

  if (lowerTarget.startsWith('http://') || lowerTarget.startsWith('https://')) {
    return {
      action: 'external',
      targetUrl: normalizedTarget,
      reason: 'External HTTP(S) link delegated to OS browser',
    };
  }

  return {
    action: 'deny',
    targetUrl: normalizedTarget,
    reason: 'Unsupported or untrusted protocol',
  };
}
