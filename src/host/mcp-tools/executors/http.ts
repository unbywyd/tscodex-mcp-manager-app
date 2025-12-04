/**
 * HTTP Executor - Makes HTTP requests with parameter substitution
 *
 * Supports placeholders:
 * - {{paramName}} - Input parameters
 * - {{SESSION.workspaceId}} - Workspace ID
 * - {{SESSION.projectRoot}} - Project root path
 * - {{SESSION.clientType}} - Client type
 * - {{REQUEST.timestamp}} - Request timestamp
 * - {{REQUEST.requestId}} - Request ID
 * - {{SECRET_KEY_NAME}} - Secret value (secure, server-side only)
 *
 * Secrets are identified by the SECRET_ prefix in their name.
 */

import type { HttpExecutor, ExecutionContext } from '../types';

const DEFAULT_TIMEOUT = 30000;

/**
 * Build substitution map from context
 */
function buildSubstitutionMap(
  params: Record<string, unknown>,
  context: ExecutionContext
): Record<string, unknown> {
  return {
    // Input parameters (direct access)
    ...params,
    // Session context
    'SESSION.workspaceId': context.session.workspaceId,
    'SESSION.projectRoot': context.session.projectRoot || '',
    'SESSION.clientType': context.session.clientType || '',
    // Request context
    'REQUEST.timestamp': context.request.timestamp,
    'REQUEST.requestId': context.request.requestId,
  };
}

/**
 * Replace {{param}} placeholders with actual values
 * Secrets are identified by SECRET_ prefix and resolved via getSecret
 */
function substitutePlaceholders(
  template: string,
  substitutionMap: Record<string, unknown>,
  getSecret: (key: string) => string | undefined
): string {
  // Replace all placeholders ({{param}}, {{SESSION.x}}, {{SECRET_KEY}})
  return template.replace(/\{\{([A-Za-z_][A-Za-z0-9_.]*)\}\}/g, (match, key) => {
    // Check if it's a secret (starts with SECRET_)
    if (key.startsWith('SECRET_')) {
      const secret = getSecret(key);
      if (secret !== undefined) {
        return secret;
      }
      // Log warning but don't expose that secret is missing
      console.warn(`[HTTP Executor] Secret not found: ${key}`);
      return match; // Keep placeholder if secret not found
    }

    // Regular placeholder from substitution map
    if (key in substitutionMap) {
      const value = substitutionMap[key];
      return typeof value === 'object' ? JSON.stringify(value) : String(value ?? '');
    }
    return match; // Keep placeholder if no value
  });
}

/**
 * Extract value from object using JSONPath-like syntax
 * Supports simple paths like "$.data.items" or "data.items"
 */
function extractPath(obj: unknown, path: string): unknown {
  if (!path) return obj;

  // Remove leading $. if present
  const cleanPath = path.startsWith('$.') ? path.slice(2) : path;
  const parts = cleanPath.split('.');

  let current: unknown = obj;
  for (const part of parts) {
    if (current === null || current === undefined) {
      return undefined;
    }
    if (typeof current === 'object') {
      current = (current as Record<string, unknown>)[part];
    } else {
      return undefined;
    }
  }

  return current;
}

export async function executeHttp(
  executor: HttpExecutor,
  params: Record<string, unknown>,
  context: ExecutionContext
): Promise<unknown> {
  const { method, url, headers, body, bodyType, timeout, responseMapping } = executor;

  // Build substitution map with all available context
  const substitutionMap = buildSubstitutionMap(params, context);
  const getSecret = context.utils.getSecret;

  // Substitute placeholders in URL
  const finalUrl = substitutePlaceholders(url, substitutionMap, getSecret);
  // Log URL without secrets for security
  const safeLogUrl = url.replace(/\{\{SECRET_[^}]+\}\}/g, '{{SECRET_***}}');
  context.utils.log(`HTTP ${method} ${substitutePlaceholders(safeLogUrl, substitutionMap, () => '***')}`);

  // Substitute placeholders in headers
  const finalHeaders: Record<string, string> = {};
  if (headers) {
    for (const [key, value] of Object.entries(headers)) {
      finalHeaders[key] = substitutePlaceholders(value, substitutionMap, getSecret);
    }
  }

  // Prepare body
  let finalBody: string | undefined;
  if (body && ['POST', 'PUT', 'PATCH'].includes(method)) {
    finalBody = substitutePlaceholders(body, substitutionMap, getSecret);

    // Set content-type if not specified
    if (!finalHeaders['Content-Type'] && !finalHeaders['content-type']) {
      switch (bodyType) {
        case 'json':
          finalHeaders['Content-Type'] = 'application/json';
          break;
        case 'form':
          finalHeaders['Content-Type'] = 'application/x-www-form-urlencoded';
          break;
        case 'text':
          finalHeaders['Content-Type'] = 'text/plain';
          break;
      }
    }
  }

  // Create abort controller for timeout
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeout || DEFAULT_TIMEOUT);

  try {
    const response = await fetch(finalUrl, {
      method,
      headers: finalHeaders,
      body: finalBody,
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    context.utils.log(`Response status: ${response.status}`);

    // Parse response
    const contentType = response.headers.get('content-type') || '';
    let data: unknown;

    if (contentType.includes('application/json')) {
      data = await response.json();
    } else {
      data = await response.text();
    }

    // Check for errors
    if (!response.ok) {
      let errorMessage = `HTTP ${response.status}: ${response.statusText}`;

      if (responseMapping?.errorPath) {
        const extractedError = extractPath(data, responseMapping.errorPath);
        if (extractedError) {
          errorMessage = String(extractedError);
        }
      }

      throw new Error(errorMessage);
    }

    // Extract success data if mapping specified
    if (responseMapping?.successPath) {
      return extractPath(data, responseMapping.successPath);
    }

    return data;
  } catch (error) {
    clearTimeout(timeoutId);

    if ((error as Error).name === 'AbortError') {
      throw new Error(`Request timeout after ${timeout || DEFAULT_TIMEOUT}ms`);
    }

    throw error;
  }
}
