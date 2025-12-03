/**
 * Instance Routes - Server instance lifecycle management
 */

import { Router, Request, Response } from '../../http/router';
import type { RouteContext } from './index';
import { GLOBAL_WORKSPACE_ID } from '../../../shared/types';

export function createInstanceRoutes(router: Router, ctx: RouteContext): void {
  // List all running instances
  // Optional query param: workspaceId - filter instances by workspace
  router.get('/api/instances', async (req: Request, res: Response) => {
    try {
      let instances = ctx.processManager.getAllInstances();

      // Filter by workspaceId if provided
      const workspaceId = req.query.workspaceId as string | undefined;
      if (workspaceId) {
        instances = instances.filter((i) => i.workspaceId === workspaceId);
      }

      res.json({ success: true, instances });
    } catch (error) {
      res.status(500).json({
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  });

  // Start server instance
  // Note: Servers always run in 'global' workspace. The workspaceId param is kept for API consistency.
  router.post('/api/instances/start', async (req: Request, res: Response) => {
    try {
      const body = req.body as { serverId?: string; workspaceId?: string };
      const { serverId } = body;

      if (!serverId) {
        res.status(400).json({
          success: false,
          error: 'serverId is required',
        });
        return;
      }

      // Get server template
      const server = await ctx.serverStore.get(serverId);
      if (!server) {
        res.status(404).json({
          success: false,
          error: 'Server not found',
        });
        return;
      }

      // Start instance in global workspace
      const instance = await ctx.processManager.start(
        serverId,
        GLOBAL_WORKSPACE_ID,
        undefined, // No project root for global
        server.defaultConfig || {}
      );

      res.json({ success: true, instance });
    } catch (error) {
      res.status(500).json({
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  });

  // Stop server instance
  // Note: Servers always run in 'global' workspace. The workspaceId param is kept for API consistency
  // but we always stop from global workspace.
  router.post('/api/instances/stop', async (req: Request, res: Response) => {
    try {
      const body = req.body as { serverId?: string; workspaceId?: string };
      const { serverId } = body;

      if (!serverId) {
        res.status(400).json({
          success: false,
          error: 'serverId is required',
        });
        return;
      }

      // Servers always run in global workspace
      const instance = ctx.processManager.getInstance(serverId, GLOBAL_WORKSPACE_ID);
      if (!instance) {
        res.status(404).json({
          success: false,
          error: `No running instance found for server ${serverId}`,
        });
        return;
      }

      await ctx.processManager.stop(serverId, GLOBAL_WORKSPACE_ID);
      res.json({ success: true });
    } catch (error) {
      res.status(500).json({
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  });

  // Restart all running server instances
  router.post('/api/instances/restart-all', async (_req: Request, res: Response) => {
    try {
      const instances = ctx.processManager.getAllInstances();
      const runningInstances = instances.filter((i) => i.status === 'running');

      const results: { serverId: string; workspaceId: string; success: boolean; error?: string }[] =
        [];

      for (const instance of runningInstances) {
        try {
          // Get server template
          const server = await ctx.serverStore.get(instance.serverId);
          if (!server) {
            results.push({
              serverId: instance.serverId,
              workspaceId: instance.workspaceId,
              success: false,
              error: 'Server not found',
            });
            continue;
          }

          // Get workspace config
          const workspace = ctx.workspaceStore.get(instance.workspaceId);
          const wsConfig = ctx.workspaceStore.getServerConfig(
            instance.workspaceId,
            instance.serverId
          );

          // Restart instance
          await ctx.processManager.restart(
            instance.serverId,
            instance.workspaceId,
            workspace?.projectRoot,
            {
              ...server.defaultConfig,
              ...wsConfig?.configOverride,
            }
          );

          results.push({
            serverId: instance.serverId,
            workspaceId: instance.workspaceId,
            success: true,
          });
        } catch (error) {
          results.push({
            serverId: instance.serverId,
            workspaceId: instance.workspaceId,
            success: false,
            error: error instanceof Error ? error.message : 'Unknown error',
          });
        }
      }

      res.json({
        success: true,
        restarted: results.filter((r) => r.success).length,
        failed: results.filter((r) => !r.success).length,
        results,
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  });

  // Restart server instance
  // Note: Servers always run in 'global' workspace.
  router.post('/api/instances/restart', async (req: Request, res: Response) => {
    try {
      const body = req.body as { serverId?: string; workspaceId?: string };
      const { serverId } = body;

      if (!serverId) {
        res.status(400).json({
          success: false,
          error: 'serverId is required',
        });
        return;
      }

      // Get server template
      const server = await ctx.serverStore.get(serverId);
      if (!server) {
        res.status(404).json({
          success: false,
          error: 'Server not found',
        });
        return;
      }

      // Restart instance in global workspace
      const instance = await ctx.processManager.restart(
        serverId,
        GLOBAL_WORKSPACE_ID,
        undefined, // No project root for global
        server.defaultConfig || {}
      );

      res.json({ success: true, instance });
    } catch (error) {
      res.status(500).json({
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  });

  // Get instance status
  router.get('/api/instances/:serverId/:workspaceId', async (req: Request, res: Response) => {
    try {
      const { serverId, workspaceId } = req.params;

      const instance = ctx.processManager.getInstance(serverId, workspaceId);

      if (!instance) {
        res.json({
          success: true,
          instance: null,
          status: 'stopped',
        });
        return;
      }

      res.json({ success: true, instance });
    } catch (error) {
      res.status(500).json({
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  });

  // Proxy health check to running instance (avoids CORS issues)
  router.get('/api/instances/:serverId/:workspaceId/health', async (req: Request, res: Response) => {
    try {
      const { serverId, workspaceId } = req.params;

      const instance = ctx.processManager.getInstance(serverId, workspaceId);

      if (!instance || !instance.port) {
        res.status(404).json({
          success: false,
          error: 'Instance not found or not running',
        });
        return;
      }

      // Proxy request to instance
      const healthResponse = await fetch(`http://127.0.0.1:${instance.port}/health`, {
        signal: AbortSignal.timeout(5000),
      });

      if (healthResponse.ok) {
        const data = await healthResponse.json();
        res.json({ success: true, ...data });
      } else {
        res.status(healthResponse.status).json({
          success: false,
          error: 'Health check failed',
        });
      }
    } catch (error) {
      res.status(500).json({
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  });

  // Proxy metadata request to running instance (avoids CORS issues)
  router.get('/api/instances/:serverId/:workspaceId/metadata', async (req: Request, res: Response) => {
    try {
      const { serverId, workspaceId } = req.params;

      const instance = ctx.processManager.getInstance(serverId, workspaceId);

      if (!instance || !instance.port) {
        res.status(404).json({
          success: false,
          error: 'Instance not found or not running',
        });
        return;
      }

      // Proxy request to instance - try multiple endpoints
      let data = null;

      // Try /gateway/metadata first
      try {
        const metaResponse = await fetch(`http://127.0.0.1:${instance.port}/gateway/metadata`, {
          signal: AbortSignal.timeout(5000),
        });
        if (metaResponse.ok) {
          data = await metaResponse.json();
        }
      } catch {
        // Ignore and try next
      }

      // Try /metadata if gateway didn't work
      if (!data) {
        try {
          const metaResponse = await fetch(`http://127.0.0.1:${instance.port}/metadata`, {
            signal: AbortSignal.timeout(5000),
          });
          if (metaResponse.ok) {
            data = await metaResponse.json();
          }
        } catch {
          // Ignore
        }
      }

      if (data) {
        res.json({ success: true, ...data });
      } else {
        res.status(404).json({
          success: false,
          error: 'Could not fetch metadata from server',
        });
      }
    } catch (error) {
      res.status(500).json({
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  });
}
