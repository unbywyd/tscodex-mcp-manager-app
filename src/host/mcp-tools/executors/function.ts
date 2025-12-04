/**
 * Function Executor - Executes user-defined JavaScript functions in a sandbox
 *
 * Security considerations:
 * - Uses vm module for basic isolation
 * - Limited global scope
 * - Timeout enforcement
 * - No access to require/process/fs
 *
 * Note: For production, consider using vm2 or isolated-vm for better isolation
 */

import { createContext, runInContext, Script } from 'node:vm';
import type { FunctionExecutor, ExecutionContext } from '../types';

const DEFAULT_TIMEOUT = 30000;
const MAX_MEMORY = 128 * 1024 * 1024; // 128MB (for reference, not enforced by vm)

/**
 * Create a safe fetch wrapper that logs requests
 */
function createSafeFetch(context: ExecutionContext): typeof fetch {
  return async (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
    const url = typeof input === 'string' ? input : input.toString();
    context.utils.log(`HTTP ${init?.method || 'GET'} ${url}`);
    return fetch(input, init);
  };
}

/**
 * Execute user-defined function code
 */
export async function executeFunction(
  executor: FunctionExecutor,
  params: Record<string, unknown>,
  context: ExecutionContext
): Promise<unknown> {
  const { code } = executor;

  // Validate code is not empty
  if (!code || code.trim() === '') {
    throw new Error('Function code is empty');
  }

  // Create sandbox with limited globals
  // NOTE: getSecret is intentionally NOT exposed to user functions
  // Secrets can only be accessed via {{SECRET_KEY}} placeholders in HTTP executor
  const sandbox = {
    // User inputs
    params,
    context: {
      session: {
        workspaceId: context.session.workspaceId,
        projectRoot: context.session.projectRoot,
        clientType: context.session.clientType,
      },
      request: {
        timestamp: context.request.timestamp,
        requestId: context.request.requestId,
      },
      // All input parameters for convenience
      params: context.params,
      utils: {
        fetch: createSafeFetch(context),
        log: context.utils.log,
        // NOTE: No getSecret here - secrets are NOT accessible in function executor
        // This is a security measure to prevent leaking secrets through user code
      },
    },

    // Safe built-in objects
    console: {
      log: (...args: unknown[]) => context.utils.log(args.map(String).join(' ')),
      warn: (...args: unknown[]) => context.utils.log(`[WARN] ${args.map(String).join(' ')}`),
      error: (...args: unknown[]) => context.utils.log(`[ERROR] ${args.map(String).join(' ')}`),
      info: (...args: unknown[]) => context.utils.log(`[INFO] ${args.map(String).join(' ')}`),
    },

    // Standard objects
    JSON,
    Date,
    Math,
    Array,
    Object,
    String,
    Number,
    Boolean,
    RegExp,
    Error,
    TypeError,
    RangeError,
    SyntaxError,
    Map,
    Set,
    WeakMap,
    WeakSet,
    Promise,
    Symbol,
    Proxy,
    Reflect,

    // Encoding
    encodeURIComponent,
    decodeURIComponent,
    encodeURI,
    decodeURI,
    atob,
    btoa,

    // Timing (wrapped)
    setTimeout: (fn: () => void, ms: number) => setTimeout(fn, Math.min(ms, 10000)),
    clearTimeout,

    // URL handling
    URL,
    URLSearchParams,

    // Fetch for HTTP requests
    fetch: createSafeFetch(context),

    // Result placeholder
    __result__: undefined as unknown,
  };

  // Create isolated context
  const vmContext = createContext(sandbox);

  // Wrap user code to capture result
  const wrappedCode = `
    (async () => {
      try {
        const userFn = ${code};
        __result__ = await userFn(params, context);
      } catch (error) {
        __result__ = { __error__: true, message: error.message, stack: error.stack };
      }
    })();
  `;

  try {
    // Compile script
    const script = new Script(wrappedCode, {
      filename: 'dynamic-function.js',
    });

    // Run script with timeout
    script.runInContext(vmContext, {
      timeout: DEFAULT_TIMEOUT,
      displayErrors: true,
    });

    // Wait for async completion (with timeout)
    const startTime = Date.now();
    while (sandbox.__result__ === undefined) {
      if (Date.now() - startTime > DEFAULT_TIMEOUT) {
        throw new Error(`Function execution timeout after ${DEFAULT_TIMEOUT}ms`);
      }
      await new Promise((resolve) => setTimeout(resolve, 10));
    }

    // Check for error
    const result = sandbox.__result__;
    if (
      result &&
      typeof result === 'object' &&
      '__error__' in result &&
      (result as { __error__: boolean }).__error__
    ) {
      const errorResult = result as unknown as { message: string; stack?: string };
      throw new Error(errorResult.message);
    }

    return result;
  } catch (error) {
    if ((error as Error).message?.includes('Script execution timed out')) {
      throw new Error(`Function execution timeout after ${DEFAULT_TIMEOUT}ms`);
    }
    throw error;
  }
}

/**
 * Validate function code syntax
 */
export function validateFunctionSyntax(code: string): { valid: boolean; error?: string } {
  if (!code || code.trim() === '') {
    return { valid: false, error: 'Function code is empty' };
  }

  try {
    // Try to parse as arrow function or regular function
    const wrappedCode = `const __fn__ = ${code};`;
    new Script(wrappedCode);
    return { valid: true };
  } catch (error) {
    return {
      valid: false,
      error: (error as Error).message,
    };
  }
}
