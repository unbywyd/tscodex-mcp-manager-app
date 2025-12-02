/**
 * Centralized API client for MCP Manager
 * All requests to the host API should go through this module
 */

export const API_BASE = 'http://127.0.0.1:4040/api';
export const WS_URL = 'ws://127.0.0.1:4040/events';

/**
 * Fetch wrapper with error handling
 */
export async function apiFetch<T = unknown>(
  endpoint: string,
  options?: RequestInit
): Promise<{ success: boolean; data?: T; error?: string }> {
  try {
    const url = endpoint.startsWith('http') ? endpoint : `${API_BASE}${endpoint}`;
    const response = await fetch(url, {
      ...options,
      headers: {
        'Content-Type': 'application/json',
        ...options?.headers,
      },
    });

    const data = await response.json();
    return data;
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Network error',
    };
  }
}

/**
 * GET request helper
 */
export async function apiGet<T = unknown>(endpoint: string, options?: RequestInit) {
  return apiFetch<T>(endpoint, { ...options, method: 'GET' });
}

/**
 * POST request helper
 */
export async function apiPost<T = unknown>(endpoint: string, body?: unknown, options?: RequestInit) {
  return apiFetch<T>(endpoint, {
    ...options,
    method: 'POST',
    body: body ? JSON.stringify(body) : undefined,
  });
}

/**
 * PATCH request helper
 */
export async function apiPatch<T = unknown>(endpoint: string, body?: unknown, options?: RequestInit) {
  return apiFetch<T>(endpoint, {
    ...options,
    method: 'PATCH',
    body: body ? JSON.stringify(body) : undefined,
  });
}

/**
 * DELETE request helper
 */
export async function apiDelete<T = unknown>(endpoint: string, options?: RequestInit) {
  return apiFetch<T>(endpoint, { ...options, method: 'DELETE' });
}

/**
 * Get instance health via proxy (avoids CORS issues with MCP servers)
 */
export async function getInstanceHealth(serverId: string, workspaceId: string) {
  return apiGet(`/instances/${serverId}/${workspaceId}/health`);
}

/**
 * Get instance metadata via proxy (avoids CORS issues with MCP servers)
 */
export async function getInstanceMetadata(serverId: string, workspaceId: string) {
  return apiGet(`/instances/${serverId}/${workspaceId}/metadata`);
}
