/**
 * Executors - Execute different types of tool/resource actions
 */

export { executeStatic } from './static';
export { executeHttp } from './http';
export { executeFunction, validateFunctionSyntax } from './function';

import type { ToolExecutor, ResourceExecutor, ExecutionContext } from '../types';
import { executeStatic } from './static';
import { executeHttp } from './http';
import { executeFunction } from './function';

/**
 * Execute a tool or resource based on its executor type
 */
export async function execute(
  executor: ToolExecutor | ResourceExecutor,
  params: Record<string, unknown>,
  context: ExecutionContext
): Promise<unknown> {
  switch (executor.type) {
    case 'static':
      return executeStatic(executor, params, context);
    case 'http':
      return executeHttp(executor, params, context);
    case 'function':
      return executeFunction(executor, params, context);
    default:
      throw new Error(`Unknown executor type: ${(executor as { type: string }).type}`);
  }
}
