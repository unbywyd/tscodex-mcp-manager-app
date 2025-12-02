/**
 * Shared utilities
 */

import type { InstallType } from './types';

/**
 * Get spawn command for a server based on install type
 */
export function getSpawnCommand(
  installType: InstallType,
  packageName?: string,
  packageVersion?: string,
  localPath?: string
): { command: string; args: string[] } {
  const version = packageVersion || 'latest';
  const pkg = packageName ? `${packageName}@${version}` : '';

  switch (installType) {
    case 'npx':
      return { command: 'npx', args: [pkg] };
    case 'pnpx':
      return { command: 'pnpm', args: ['dlx', pkg] };
    case 'yarn':
      return { command: 'yarn', args: ['dlx', pkg] };
    case 'bunx':
      return { command: 'bunx', args: [pkg] };
    case 'local':
      return { command: 'node', args: [localPath!] };
  }
}

/**
 * Normalize path for cross-platform compatibility
 */
export function normalizePath(p: string): string {
  return p.replace(/\\/g, '/');
}

/**
 * Generate workspace ID from project root
 */
export function generateWorkspaceId(projectRoot: string): string {
  return normalizePath(projectRoot)
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '_')
    .replace(/_+/g, '_')
    .slice(0, 64);
}

/**
 * Format timestamp for display
 */
export function formatTimestamp(ts: number): string {
  return new Date(ts).toLocaleString();
}

/**
 * Delay execution
 */
export function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Safe JSON parse
 */
export function safeJsonParse<T>(str: string, fallback: T): T {
  try {
    return JSON.parse(str) as T;
  } catch {
    return fallback;
  }
}

/**
 * Create abort signal with timeout
 */
export function timeoutSignal(ms: number): AbortSignal {
  return AbortSignal.timeout(ms);
}
