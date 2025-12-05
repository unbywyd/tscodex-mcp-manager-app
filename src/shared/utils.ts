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
  localPath?: string,
  entryPoint?: string
): { command: string; args: string[] } {
  // For npm installed packages, use the entry point directly
  if (installType === 'npm') {
    if (!entryPoint) {
      throw new Error(`[getSpawnCommand] entryPoint is required for npm install type`);
    }
    return { command: 'node', args: [entryPoint] };
  }

  // For package runners (npx, pnpx, etc.)
  // packageVersion should always be set during server creation
  // fallback to 'latest' only for legacy servers without fixed version
  if (!packageVersion && packageName) {
    console.warn(`[getSpawnCommand] No packageVersion for ${packageName}, using 'latest' (this may slow down startup)`);
  }
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
    default:
      throw new Error(`Unknown install type: ${installType}`);
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

/**
 * Get user data path with fallback for when electron app context is not available.
 * Falls back to ~/.mcp-manager on Unix or %USERPROFILE%/.mcp-manager on Windows.
 */
export function getUserDataPath(electronApp?: { getPath?: (name: 'userData') => string }): string {
  // Try electron app.getPath first
  if (electronApp?.getPath) {
    try {
      return electronApp.getPath('userData');
    } catch {
      // Fall through to fallback
    }
  }

  // Fallback to home directory based path
  const home = process.env.HOME || process.env.USERPROFILE;
  if (home) {
    // Use home directory directly - os.homedir() may not be available in all contexts
    return `${home}/.mcp-manager`.replace(/\\/g, '/');
  }

  // Last resort: current working directory
  console.warn('[getUserDataPath] Could not determine user data path, using cwd');
  return process.cwd();
}
