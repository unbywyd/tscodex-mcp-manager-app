/**
 * Session Routes - Extension session management
 */

import path from 'node:path';
import { Router, Request, Response } from '../../http/router';
import type { RouteContext } from './index';
import { DEFAULT_HOST_PORT, GLOBAL_WORKSPACE_ID, ClientType } from '../../../shared/types';

export function createSessionRoutes(router: Router, ctx: RouteContext): void {
  // Connect session (called by extension on activation)
  router.post('/api/sessions/connect', async (req: Request, res: Response) => {
    try {
      const body = req.body as {
        projectRoot?: string;
        clientType?: ClientType;
        clientInstanceId?: string;
        /** Human-readable name of the client (e.g., "Cursor", "VS Code", "Claude Code") */
        sourceLabel?: string;
      };
      const { projectRoot, clientType, clientInstanceId, sourceLabel } = body;

      if (!clientType || !clientInstanceId) {
        res.status(400).json({
          success: false,
          error: 'clientType and clientInstanceId are required',
        });
        return;
      }

      // Find or create workspace
      let workspace = projectRoot
        ? ctx.workspaceStore.findByProjectRoot(projectRoot)
        : null;

      if (!workspace && projectRoot) {
        // Auto-create workspace for new project
        const label = path.basename(projectRoot);
        workspace = await ctx.workspaceStore.create({
          label,
          projectRoot,
          source: 'api', // Created via API (IDE extension, etc.)
          sourceInstanceId: clientInstanceId,
          sourceLabel, // e.g., "Cursor", "VS Code", "Claude Code"
        });

        ctx.eventBus.emitAppEvent({
          type: 'workspace-created',
          data: workspace,
        });
      }

      const workspaceId = workspace?.id || GLOBAL_WORKSPACE_ID;

      // Create session
      const session = ctx.sessionStore.create({
        workspaceId,
        projectRoot: projectRoot || '',
        clientType,
        clientInstanceId,
      });

      // Build MCP server endpoints
      const servers = ctx.serverStore.getAll();
      const mcpServers: Record<string, string> = {};

      for (const server of servers) {
        // Check if server is enabled for this workspace
        const wsConfig = ctx.workspaceStore.getServerConfig(workspaceId, server.id);
        if (wsConfig && wsConfig.enabled === false) {
          continue;
        }

        // Build proxy URL
        const url = `http://127.0.0.1:${DEFAULT_HOST_PORT}/mcp/${server.id}/${workspaceId}`;
        mcpServers[server.id] = url;
      }

      // Update session with endpoints
      ctx.sessionStore.updateEndpoints(session.sessionId, mcpServers);

      ctx.eventBus.emitAppEvent({
        type: 'session-connected',
        data: {
          sessionId: session.sessionId,
          workspaceId,
          clientType,
        },
      });

      res.json({
        success: true,
        sessionId: session.sessionId,
        workspaceId,
        mcpServers,
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  });

  // Ping session (heartbeat)
  router.post('/api/sessions/ping', async (req: Request, res: Response) => {
    try {
      const body = req.body as { sessionId?: string };
      const { sessionId } = body;

      if (!sessionId) {
        res.status(400).json({
          success: false,
          error: 'sessionId is required',
        });
        return;
      }

      const success = ctx.sessionStore.ping(sessionId);

      if (!success) {
        res.status(404).json({
          success: false,
          error: 'Session not found',
        });
        return;
      }

      res.json({ success: true });
    } catch (error) {
      res.status(500).json({
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  });

  // Disconnect session
  router.post('/api/sessions/disconnect', async (req: Request, res: Response) => {
    try {
      const body = req.body as { sessionId?: string };
      const { sessionId } = body;

      if (!sessionId) {
        res.status(400).json({
          success: false,
          error: 'sessionId is required',
        });
        return;
      }

      const session = ctx.sessionStore.get(sessionId);
      ctx.sessionStore.delete(sessionId);

      if (session) {
        ctx.eventBus.emitAppEvent({
          type: 'session-disconnected',
          data: { sessionId },
        });
      }

      res.json({ success: true });
    } catch (error) {
      res.status(500).json({
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  });

  // List all sessions (for debugging)
  router.get('/api/sessions', async (_req: Request, res: Response) => {
    try {
      const sessions = ctx.sessionStore.getAll();
      res.json({ success: true, sessions });
    } catch (error) {
      res.status(500).json({
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  });
}
