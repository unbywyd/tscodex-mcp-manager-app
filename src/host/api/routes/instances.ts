/**
 * Instance Routes - Server instance lifecycle management
 */

import { Router, Request, Response } from '../../http/router';
import type { RouteContext } from './index';
import { GLOBAL_WORKSPACE_ID } from '../../../shared/types';

export function createInstanceRoutes(router: Router, ctx: RouteContext): void {
  // List all running instances
  router.get('/api/instances', async (_req: Request, res: Response) => {
    try {
      const instances = ctx.processManager.getAllInstances();
      res.json({ success: true, instances });
    } catch (error) {
      res.status(500).json({
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  });

  // Start server instance
  router.post('/api/instances/start', async (req: Request, res: Response) => {
    try {
      const body = req.body as { serverId?: string; workspaceId?: string };
      const { serverId, workspaceId = GLOBAL_WORKSPACE_ID } = body;

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

      // Get workspace config
      const workspace = ctx.workspaceStore.get(workspaceId);
      const wsConfig = ctx.workspaceStore.getServerConfig(workspaceId, serverId);

      // Start instance
      const instance = await ctx.processManager.start(
        serverId,
        workspaceId,
        workspace?.projectRoot,
        {
          ...server.defaultConfig,
          ...wsConfig?.configOverride,
        }
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
  router.post('/api/instances/stop', async (req: Request, res: Response) => {
    try {
      const body = req.body as { serverId?: string; workspaceId?: string };
      const { serverId, workspaceId = GLOBAL_WORKSPACE_ID } = body;

      if (!serverId) {
        res.status(400).json({
          success: false,
          error: 'serverId is required',
        });
        return;
      }

      await ctx.processManager.stop(serverId, workspaceId);
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
  router.post('/api/instances/restart', async (req: Request, res: Response) => {
    try {
      const body = req.body as { serverId?: string; workspaceId?: string };
      const { serverId, workspaceId = GLOBAL_WORKSPACE_ID } = body;

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

      // Get workspace config
      const workspace = ctx.workspaceStore.get(workspaceId);
      const wsConfig = ctx.workspaceStore.getServerConfig(workspaceId, serverId);

      // Restart instance
      const instance = await ctx.processManager.restart(
        serverId,
        workspaceId,
        workspace?.projectRoot,
        {
          ...server.defaultConfig,
          ...wsConfig?.configOverride,
        }
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
