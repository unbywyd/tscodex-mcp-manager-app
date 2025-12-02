/**
 * Simple HTTP Router - Native Node.js implementation
 */

import { IncomingMessage, ServerResponse } from 'node:http';

export interface Request extends IncomingMessage {
  params: Record<string, string>;
  query: Record<string, string>;
  body: unknown;
  path: string;
}

export interface Response extends ServerResponse {
  json: (data: unknown) => void;
  status: (code: number) => Response;
  send: (data: string) => void;
}

export type NextFunction = (err?: Error) => void;
export type Handler = (req: Request, res: Response, next: NextFunction) => void | Promise<void>;
export type ErrorHandler = (err: Error, req: Request, res: Response, next: NextFunction) => void | Promise<void>;

interface Route {
  method: string;
  pattern: RegExp;
  paramNames: string[];
  handlers: Handler[];
}

export class Router {
  private routes: Route[] = [];
  private middleware: Handler[] = [];
  private errorHandlers: ErrorHandler[] = [];
  private basePath: string = '';

  /**
   * Add middleware
   */
  use(pathOrHandler: string | Handler | Router, handler?: Handler | Router): this {
    if (typeof pathOrHandler === 'function') {
      this.middleware.push(pathOrHandler);
    } else if (pathOrHandler instanceof Router) {
      this.mountRouter('', pathOrHandler);
    } else if (handler instanceof Router) {
      this.mountRouter(pathOrHandler, handler);
    } else if (handler) {
      // Path-specific middleware
      const { pattern, paramNames } = this.pathToRegex(pathOrHandler);
      this.routes.push({
        method: 'ALL',
        pattern,
        paramNames,
        handlers: [handler],
      });
    }
    return this;
  }

  /**
   * Mount sub-router
   */
  private mountRouter(basePath: string, router: Router): void {
    router.basePath = this.basePath + basePath;
    for (const route of router.routes) {
      const fullPattern = this.pathToRegex(router.basePath + route.pattern.source.replace(/^\^/, '').replace(/\$/, ''));
      this.routes.push({
        ...route,
        pattern: fullPattern.pattern,
        paramNames: fullPattern.paramNames,
      });
    }
    this.middleware.push(...router.middleware);
  }

  /**
   * GET route
   */
  get(path: string, ...handlers: Handler[]): this {
    return this.addRoute('GET', path, handlers);
  }

  /**
   * POST route
   */
  post(path: string, ...handlers: Handler[]): this {
    return this.addRoute('POST', path, handlers);
  }

  /**
   * PUT route
   */
  put(path: string, ...handlers: Handler[]): this {
    return this.addRoute('PUT', path, handlers);
  }

  /**
   * PATCH route
   */
  patch(path: string, ...handlers: Handler[]): this {
    return this.addRoute('PATCH', path, handlers);
  }

  /**
   * DELETE route
   */
  delete(path: string, ...handlers: Handler[]): this {
    return this.addRoute('DELETE', path, handlers);
  }

  /**
   * OPTIONS route
   */
  options(path: string, ...handlers: Handler[]): this {
    return this.addRoute('OPTIONS', path, handlers);
  }

  /**
   * Add error handler
   */
  onError(handler: ErrorHandler): this {
    this.errorHandlers.push(handler);
    return this;
  }

  /**
   * Add route
   */
  private addRoute(method: string, path: string, handlers: Handler[]): this {
    const { pattern, paramNames } = this.pathToRegex(this.basePath + path);
    this.routes.push({ method, pattern, paramNames, handlers });
    return this;
  }

  /**
   * Convert path pattern to regex
   */
  private pathToRegex(path: string): { pattern: RegExp; paramNames: string[] } {
    const paramNames: string[] = [];
    const pattern = path
      .replace(/\/:([^/]+)/g, (_match, paramName) => {
        paramNames.push(paramName);
        return '/([^/]+)';
      })
      .replace(/\//g, '\\/');
    return { pattern: new RegExp(`^${pattern}$`), paramNames };
  }

  /**
   * Handle incoming request
   */
  async handle(req: IncomingMessage, res: ServerResponse): Promise<void> {
    // Enhance request
    const enhancedReq = req as Request;
    const url = new URL(req.url || '/', `http://${req.headers.host || 'localhost'}`);
    enhancedReq.path = url.pathname;
    enhancedReq.params = {};
    enhancedReq.query = Object.fromEntries(url.searchParams);

    // Enhance response
    const enhancedRes = res as Response;
    let statusCode = 200;

    enhancedRes.status = (code: number) => {
      statusCode = code;
      return enhancedRes;
    };

    enhancedRes.json = (data: unknown) => {
      res.statusCode = statusCode;
      res.setHeader('Content-Type', 'application/json');
      res.end(JSON.stringify(data));
    };

    enhancedRes.send = (data: string) => {
      res.statusCode = statusCode;
      res.end(data);
    };

    // Parse body for POST/PUT/PATCH
    if (['POST', 'PUT', 'PATCH'].includes(req.method || '')) {
      try {
        enhancedReq.body = await this.parseBody(req);
      } catch {
        enhancedReq.body = {};
      }
    }

    // Run middleware
    let middlewareIndex = 0;
    const runMiddleware = async (): Promise<boolean> => {
      while (middlewareIndex < this.middleware.length) {
        const mw = this.middleware[middlewareIndex++];
        let nextCalled = false;
        let error: Error | undefined;

        await new Promise<void>((resolve) => {
          const result = mw(enhancedReq, enhancedRes, (err?: Error) => {
            nextCalled = true;
            error = err;
            resolve();
          });
          if (result instanceof Promise) {
            result.then(() => {
              if (!nextCalled && !res.writableEnded) {
                nextCalled = true;
                resolve();
              }
            }).catch((err) => {
              error = err;
              resolve();
            });
          }
        });

        if (error) {
          await this.handleError(error, enhancedReq, enhancedRes);
          return false;
        }

        if (res.writableEnded) return false;
      }
      return true;
    };

    const canContinue = await runMiddleware();
    if (!canContinue) return;

    // Find matching route
    const method = req.method || 'GET';
    const path = enhancedReq.path;

    for (const route of this.routes) {
      if (route.method !== 'ALL' && route.method !== method) continue;

      const match = path.match(route.pattern);
      if (match) {
        // Extract params
        route.paramNames.forEach((name, index) => {
          enhancedReq.params[name] = match[index + 1];
        });

        // Run handlers
        for (const handler of route.handlers) {
          if (res.writableEnded) return;

          try {
            let nextCalled = false;
            await new Promise<void>((resolve, reject) => {
              const result = handler(enhancedReq, enhancedRes, (err?: Error) => {
                nextCalled = true;
                if (err) reject(err);
                else resolve();
              });
              if (result instanceof Promise) {
                result.then(() => {
                  if (!nextCalled) resolve();
                }).catch(reject);
              } else if (!nextCalled && !res.writableEnded) {
                // Sync handler that didn't call next - assume done
                resolve();
              }
            });
          } catch (error) {
            await this.handleError(error as Error, enhancedReq, enhancedRes);
            return;
          }
        }
        return;
      }
    }

    // No route found
    enhancedRes.status(404).json({ success: false, error: 'Not found' });
  }

  /**
   * Parse request body
   */
  private parseBody(req: IncomingMessage): Promise<unknown> {
    return new Promise((resolve, reject) => {
      const chunks: Buffer[] = [];
      req.on('data', (chunk) => chunks.push(chunk));
      req.on('end', () => {
        const body = Buffer.concat(chunks).toString();
        if (!body) {
          resolve({});
          return;
        }
        try {
          resolve(JSON.parse(body));
        } catch {
          resolve(body);
        }
      });
      req.on('error', reject);
    });
  }

  /**
   * Handle errors
   */
  private async handleError(error: Error, req: Request, res: Response): Promise<void> {
    if (this.errorHandlers.length > 0) {
      for (const handler of this.errorHandlers) {
        if (res.writableEnded) return;
        await handler(error, req, res, () => {});
      }
    } else {
      console.error('Unhandled error:', error);
      if (!res.writableEnded) {
        res.status(500).json({ success: false, error: error.message || 'Internal server error' });
      }
    }
  }
}

/**
 * Create a new router instance
 */
export function createRouter(): Router {
  return new Router();
}
