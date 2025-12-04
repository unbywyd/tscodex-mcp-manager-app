/**
 * Static Executor - Returns static content
 */

import type { StaticExecutor, ExecutionContext } from '../types';

export async function executeStatic(
  executor: StaticExecutor,
  _params: Record<string, unknown>,
  _context: ExecutionContext
): Promise<unknown> {
  if (executor.contentType === 'json') {
    try {
      return JSON.parse(executor.content);
    } catch (error) {
      throw new Error(`Invalid JSON content: ${(error as Error).message}`);
    }
  }

  return executor.content;
}
