/**
 * MCP Gateway - Proxy requests to MCP servers
 */

import { Router, Request, Response } from '../http/router';
import { ProcessManager } from '../managers/ProcessManager';
import { ServerStore } from '../stores/ServerStore';
import { WorkspaceStore } from '../stores/WorkspaceStore';
import { SessionStore } from '../stores/SessionStore';
import { DEFAULT_MCP_PATH, GLOBAL_WORKSPACE_ID } from '../../shared/types';

interface GatewayContext {
  serverStore: ServerStore;
  workspaceStore: WorkspaceStore;
  sessionStore: SessionStore;
  processManager: ProcessManager;
}

export function setupGateway(router: Router, ctx: GatewayContext): void {
  // MCP Gateway route: /mcp/:serverId/:workspaceId/*
  // We need to handle this with a pattern that matches the base path
  router.post('/mcp/:serverId/:workspaceId', (req, res) => handleGatewayRequest(req, res, ctx, ''));
  router.get('/mcp/:serverId/:workspaceId', (req, res) => handleGatewayRequest(req, res, ctx, ''));

  // Direct health check for gateway
  router.get('/mcp/:serverId/:workspaceId/health', async (req: Request, res: Response) => {
    const { serverId, workspaceId } = req.params;

    const instance = ctx.processManager.getInstance(serverId, workspaceId);

    if (!instance) {
      res.json({
        status: 'stopped',
        serverId,
        workspaceId,
      });
      return;
    }

    res.json({
      status: instance.status,
      serverId,
      workspaceId,
      port: instance.port,
      pid: instance.pid,
    });
  });
}

async function handleGatewayRequest(
  req: Request,
  res: Response,
  ctx: GatewayContext,
  subPath: string
): Promise<void> {
  const { serverId, workspaceId } = req.params;

  try {
    // Validate server exists
    const server = await ctx.serverStore.get(serverId);
    if (!server) {
      res.status(404).json({
        error: 'Server not found',
        serverId,
      });
      return;
    }

    // Get workspace config
    const workspace = workspaceId !== GLOBAL_WORKSPACE_ID
      ? ctx.workspaceStore.get(workspaceId)
      : null;

    // Check if server is enabled for workspace
    const wsConfig = ctx.workspaceStore.getServerConfig(workspaceId, serverId);
    if (wsConfig && wsConfig.enabled === false) {
      res.status(403).json({
        error: 'Server is disabled for this workspace',
        serverId,
        workspaceId,
      });
      return;
    }

    // Get or start server instance
    let instance = ctx.processManager.getInstance(serverId, workspaceId);

    if (!instance || instance.status !== 'running') {
      // Lazy start: automatically start the server
      try {
        instance = await ctx.processManager.start(
          serverId,
          workspaceId,
          workspace?.projectRoot,
          {
            ...server.defaultConfig,
            ...wsConfig?.configOverride,
          }
        );
      } catch (error) {
        res.status(503).json({
          error: 'Failed to start server',
          message: error instanceof Error ? error.message : 'Unknown error',
          serverId,
          workspaceId,
        });
        return;
      }
    }

    if (!instance.port) {
      res.status(503).json({
        error: 'Server port not available',
        serverId,
        workspaceId,
      });
      return;
    }

    // Proxy request to actual MCP server
    const targetUrl = `http://127.0.0.1:${instance.port}${DEFAULT_MCP_PATH}${subPath}`;

    try {
      const response = await fetch(targetUrl, {
        method: req.method || 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Workspace-Id': workspaceId,
          'X-Project-Root': workspace?.projectRoot || '',
          'X-Server-Id': serverId,
        },
        body: ['POST', 'PUT', 'PATCH'].includes(req.method || '')
          ? JSON.stringify(req.body)
          : undefined,
        signal: AbortSignal.timeout(30000), // 30 second timeout
      });

      // Forward response headers
      const contentType = response.headers.get('content-type');
      if (contentType) {
        res.setHeader('Content-Type', contentType);
      }

      // Forward response status and body
      if (contentType?.includes('application/json')) {
        const data = await response.json();
        res.status(response.status).json(data);
      } else {
        const text = await response.text();
        res.status(response.status).send(text);
      }
    } catch (error) {
      // Handle proxy errors
      if (error instanceof Error && error.name === 'TimeoutError') {
        res.status(504).json({
          error: 'Gateway timeout',
          message: 'Request to MCP server timed out',
          serverId,
          workspaceId,
        });
        return;
      }

      res.status(502).json({
        error: 'Bad gateway',
        message: error instanceof Error ? error.message : 'Unknown error',
        serverId,
        workspaceId,
      });
    }
  } catch (error) {
    console.error('Gateway error:', error);
    res.status(500).json({
      error: 'Internal gateway error',
      message: error instanceof Error ? error.message : 'Unknown error',
    });
  }
}
