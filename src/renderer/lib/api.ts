/**
 * Centralized API client for MCP Manager
 * All requests to the host API should go through this module
 */

// Default port - will be updated on app init
const DEFAULT_PORT = 4040;
let hostPort: number = DEFAULT_PORT;
let isPortInitialized = false;

/**
 * Initialize the API client with the actual host port.
 * This should be called once on app startup.
 */
export async function initializeApi(): Promise<number> {
  if (isPortInitialized) {
    return hostPort;
  }

  try {
    // Get actual port from electron main process
    if (window.electronAPI?.getHostPort) {
      hostPort = await window.electronAPI.getHostPort();
      console.log(`[API] Using host port: ${hostPort}`);
    }
  } catch (error) {
    console.warn('[API] Failed to get host port, using default:', error);
  }

  isPortInitialized = true;
  return hostPort;
}

/**
 * Get the current host port (may be default if not initialized)
 */
export function getHostPort(): number {
  return hostPort;
}

// Dynamic URL getters
export const getHostBase = (): string => `http://127.0.0.1:${hostPort}`;
export const getApiBase = (): string => `${getHostBase()}/api`;
export const getWsUrl = (): string => `ws://127.0.0.1:${hostPort}/events`;

// Legacy exports for compatibility (use getters for dynamic values)
export const HOST_BASE = `http://127.0.0.1:${DEFAULT_PORT}`;
export const API_BASE = `${HOST_BASE}/api`;
export const WS_URL = `ws://127.0.0.1:${DEFAULT_PORT}/events`;

// MCP endpoints
export const getMcpUrl = (serverId: string, workspaceId: string): string =>
  `${getHostBase()}/mcp/${serverId}/${workspaceId}`;
export const MCP_TOOLS_URL = `http://127.0.0.1:${DEFAULT_PORT}/mcp-tools`;
export const getMcpToolsUrl = (): string => `${getHostBase()}/mcp-tools`;

/**
 * Fetch wrapper with error handling
 */
export async function apiFetch<T = unknown>(
  endpoint: string,
  options?: RequestInit
): Promise<{ success: boolean; data?: T; error?: string }> {
  try {
    const url = endpoint.startsWith('http') ? endpoint : `${getApiBase()}${endpoint}`;
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
