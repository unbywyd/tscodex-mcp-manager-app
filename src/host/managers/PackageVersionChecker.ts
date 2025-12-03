/**
 * PackageVersionChecker - Checks for npm package updates
 */

import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

// Cache for version checks (packageName -> { version, checkedAt })
const versionCache = new Map<string, { version: string; checkedAt: number }>();
const CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes

/**
 * Compare two semver versions
 * Returns: 1 if a > b, -1 if a < b, 0 if equal
 */
export function compareSemver(a: string, b: string): number {
  // Remove 'v' prefix if present
  const cleanA = a.replace(/^v/, '');
  const cleanB = b.replace(/^v/, '');

  const partsA = cleanA.split('.').map((p) => parseInt(p, 10) || 0);
  const partsB = cleanB.split('.').map((p) => parseInt(p, 10) || 0);

  // Pad arrays to same length
  while (partsA.length < 3) partsA.push(0);
  while (partsB.length < 3) partsB.push(0);

  for (let i = 0; i < 3; i++) {
    if (partsA[i] > partsB[i]) return 1;
    if (partsA[i] < partsB[i]) return -1;
  }

  return 0;
}

/**
 * Get latest version of a package from npm registry
 */
export async function getLatestVersion(packageName: string): Promise<string | null> {
  // Check cache first
  const cached = versionCache.get(packageName);
  if (cached && Date.now() - cached.checkedAt < CACHE_TTL_MS) {
    return cached.version;
  }

  try {
    // Use npm view to get the latest version
    // Timeout after 10 seconds to not block UI
    const { stdout } = await execAsync(`npm view ${packageName} version`, {
      timeout: 10000,
    });

    const version = stdout.trim();
    if (version) {
      versionCache.set(packageName, { version, checkedAt: Date.now() });
      return version;
    }

    return null;
  } catch (error) {
    console.error(`[PackageVersionChecker] Failed to get latest version for ${packageName}:`, error);
    return null;
  }
}

/**
 * Check if an update is available for a package
 */
export async function checkForUpdate(
  packageName: string,
  currentVersion: string | undefined
): Promise<{ hasUpdate: boolean; latestVersion: string | null; currentVersion: string | null }> {
  // Skip check for 'latest' - it's always up to date by definition
  if (!currentVersion || currentVersion === 'latest') {
    return { hasUpdate: false, latestVersion: null, currentVersion: null };
  }

  const latestVersion = await getLatestVersion(packageName);

  if (!latestVersion) {
    return { hasUpdate: false, latestVersion: null, currentVersion };
  }

  const hasUpdate = compareSemver(latestVersion, currentVersion) > 0;

  return { hasUpdate, latestVersion, currentVersion };
}

/**
 * Clear the version cache (useful for forcing re-check)
 */
export function clearVersionCache(): void {
  versionCache.clear();
}

/**
 * Clear cache entry for specific package
 */
export function clearPackageCache(packageName: string): void {
  versionCache.delete(packageName);
}
