import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/**
 * Safely parse JSON with fallback value
 */
export function safeJsonParse<T>(json: string, fallback: T): T {
  try {
    return JSON.parse(json) as T;
  } catch {
    return fallback;
  }
}

/**
 * Safely parse JSON with error reporting
 */
export function tryJsonParse<T>(json: string): { success: true; data: T } | { success: false; error: string } {
  try {
    return { success: true, data: JSON.parse(json) as T };
  } catch (e) {
    return { success: false, error: e instanceof Error ? e.message : 'Invalid JSON' };
  }
}
