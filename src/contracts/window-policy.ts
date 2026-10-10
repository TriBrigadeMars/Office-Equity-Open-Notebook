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

  // Check if target is internal frontend navigation
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

  // Check if target is external HTTP or HTTPS link
  if (
    normalizedTarget.startsWith('http://') ||
    normalizedTarget.startsWith('https://')
  ) {
    return {
      action: 'external',
      targetUrl: normalizedTarget,
      reason: 'External HTTP(S) link delegated to OS browser',
    };
  }

  // All other protocols (file://, javascript:, custom schemes, etc.) are denied
  return {
    action: 'deny',
    targetUrl: normalizedTarget,
    reason: 'Unsupported or untrusted protocol',
  };
}
