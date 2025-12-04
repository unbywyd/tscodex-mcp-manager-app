/**
 * PackageMetadataReader - Reads package.json metadata from local paths and npm registry
 */

import fs from 'fs/promises';
import path from 'path';
import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

export interface PackageInfo {
  homepage?: string;
  repository?: string;
  readme?: string;
  author?: string | { name?: string; email?: string; url?: string };
}

export interface PackageMetadata {
  name?: string;
  version?: string;
  description?: string;
  packageInfo: PackageInfo;
}

/**
 * Read package.json from a local path
 * Searches for package.json in the given directory and parent directories
 * Also reads README.md if present
 */
export async function readLocalPackageJson(localPath: string): Promise<PackageMetadata | null> {
  try {
    // Try the given path first
    let searchPath = localPath;

    // Check if path is a file (e.g., dist/index.js) - go to parent directory
    const stat = await fs.stat(searchPath);
    if (stat.isFile()) {
      searchPath = path.dirname(searchPath);
    }

    // Search for package.json going up the directory tree
    let currentPath = searchPath;
    let packageJsonPath: string | null = null;
    let packageDir: string | null = null;

    for (let i = 0; i < 5; i++) { // Max 5 levels up
      const candidatePath = path.join(currentPath, 'package.json');
      try {
        await fs.access(candidatePath);
        packageJsonPath = candidatePath;
        packageDir = currentPath;
        break;
      } catch {
        // Go up one directory
        const parentPath = path.dirname(currentPath);
        if (parentPath === currentPath) {
          // Reached root
          break;
        }
        currentPath = parentPath;
      }
    }

    if (!packageJsonPath || !packageDir) {
      console.log(`[PackageMetadataReader] No package.json found for: ${localPath}`);
      return null;
    }

    const content = await fs.readFile(packageJsonPath, 'utf-8');
    const pkg = JSON.parse(content);

    const metadata = extractMetadata(pkg);

    // Try to read README.md from the same directory
    const readmeContent = await readReadmeFile(packageDir);
    if (readmeContent) {
      metadata.packageInfo.readme = readmeContent;
    }

    return metadata;
  } catch (error) {
    console.error(`[PackageMetadataReader] Failed to read local package.json:`, error);
    return null;
  }
}

/**
 * Read README file from a directory
 * Searches for README files case-insensitively
 */
async function readReadmeFile(dir: string): Promise<string | null> {
  try {
    // Read directory contents and find README file case-insensitively
    const files = await fs.readdir(dir);
    const readmeFile = files.find((f) => {
      const lower = f.toLowerCase();
      return lower === 'readme.md' || lower === 'readme.markdown' || lower === 'readme.txt' || lower === 'readme';
    });

    if (!readmeFile) {
      return null;
    }

    const readmePath = path.join(dir, readmeFile);
    const content = await fs.readFile(readmePath, 'utf-8');

    // Limit size to prevent huge files
    if (content.length < 100000) {
      console.log(`[PackageMetadataReader] Found README: ${readmePath}`);
      return content;
    }

    console.log(`[PackageMetadataReader] README too large, skipping: ${readmePath}`);
    return null;
  } catch (error) {
    console.error(`[PackageMetadataReader] Failed to read README from ${dir}:`, error);
    return null;
  }
}

/**
 * Fetch package metadata from npm registry
 */
export async function fetchNpmPackageMetadata(packageName: string): Promise<PackageMetadata | null> {
  try {
    // Use npm view to get package info as JSON
    const { stdout } = await execAsync(`npm view ${packageName} --json`, {
      timeout: 15000,
    });

    const pkg = JSON.parse(stdout);
    const metadata = extractMetadata(pkg);
    console.log(`[PackageMetadataReader] Fetched metadata for ${packageName}:`, {
      version: metadata.version,
      name: metadata.name,
      hasDistTags: !!pkg['dist-tags'],
      pkgVersion: pkg.version,
      pkgVersionType: typeof pkg.version,
    });
    return metadata;
  } catch (error) {
    console.error(`[PackageMetadataReader] Failed to fetch npm metadata for ${packageName}:`, error);
    return null;
  }
}

/**
 * Extract relevant metadata from package.json content
 */
function extractMetadata(pkg: Record<string, unknown>): PackageMetadata {
  const packageInfo: PackageInfo = {};

  // Homepage
  if (typeof pkg.homepage === 'string') {
    packageInfo.homepage = pkg.homepage;
  }

  // Repository - can be string or object
  if (pkg.repository) {
    if (typeof pkg.repository === 'string') {
      packageInfo.repository = normalizeRepositoryUrl(pkg.repository);
    } else if (typeof pkg.repository === 'object' && pkg.repository !== null) {
      const repo = pkg.repository as { url?: string; type?: string };
      if (repo.url) {
        packageInfo.repository = normalizeRepositoryUrl(repo.url);
      }
    }
  }

  // Author - can be string or object
  if (pkg.author) {
    if (typeof pkg.author === 'string') {
      packageInfo.author = parseAuthorString(pkg.author);
    } else if (typeof pkg.author === 'object' && pkg.author !== null) {
      packageInfo.author = pkg.author as { name?: string; email?: string; url?: string };
    }
  }

  // Readme (npm registry includes this)
  if (typeof pkg.readme === 'string' && pkg.readme.length < 50000) {
    packageInfo.readme = pkg.readme;
  }

  // Get version - npm view --json returns dist-tags.latest for registry packages
  // but version for local package.json
  let version: string | undefined;
  if (typeof pkg.version === 'string') {
    version = pkg.version;
  } else if (pkg['dist-tags'] && typeof pkg['dist-tags'] === 'object') {
    const distTags = pkg['dist-tags'] as Record<string, string>;
    version = distTags.latest;
  }

  return {
    name: typeof pkg.name === 'string' ? pkg.name : undefined,
    version,
    description: typeof pkg.description === 'string' ? pkg.description : undefined,
    packageInfo,
  };
}

/**
 * Normalize repository URL to HTTPS format
 * Handles formats like:
 * - git+https://github.com/user/repo.git
 * - git://github.com/user/repo.git
 * - github:user/repo
 * - user/repo
 */
function normalizeRepositoryUrl(url: string): string {
  // Remove git+ prefix
  url = url.replace(/^git\+/, '');

  // Remove .git suffix
  url = url.replace(/\.git$/, '');

  // Convert git:// to https://
  url = url.replace(/^git:\/\//, 'https://');

  // Convert ssh to https
  url = url.replace(/^git@github\.com:/, 'https://github.com/');

  // Handle github shorthand (github:user/repo or user/repo)
  if (url.startsWith('github:')) {
    url = `https://github.com/${url.slice(7)}`;
  } else if (/^[a-zA-Z0-9_-]+\/[a-zA-Z0-9_-]+$/.test(url)) {
    // Simple user/repo format
    url = `https://github.com/${url}`;
  }

  return url;
}

/**
 * Parse author string to object
 * Handles format: "Name <email> (url)"
 */
function parseAuthorString(author: string): { name?: string; email?: string; url?: string } {
  const result: { name?: string; email?: string; url?: string } = {};

  // Extract email
  const emailMatch = author.match(/<([^>]+)>/);
  if (emailMatch) {
    result.email = emailMatch[1];
    author = author.replace(/<[^>]+>/, '').trim();
  }

  // Extract URL
  const urlMatch = author.match(/\(([^)]+)\)/);
  if (urlMatch) {
    result.url = urlMatch[1];
    author = author.replace(/\([^)]+\)/, '').trim();
  }

  // Remaining is the name
  if (author) {
    result.name = author;
  }

  return result;
}
