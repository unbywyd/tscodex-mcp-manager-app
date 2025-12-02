/**
 * Workspace Routes - Workspace CRUD and server config
 */

import { Router, Request, Response } from '../../http/router';
import type { RouteContext } from './index';
import type { WorkspaceSource } from '../../../shared/types';

export function createWorkspaceRoutes(router: Router, ctx: RouteContext): void {
  // List all workspaces
  router.get('/api/workspaces', async (_req: Request, res: Response) => {
    try {
      const workspaces = ctx.workspaceStore.getAll();
      res.json({ success: true, workspaces });
    } catch (error) {
      res.status(500).json({
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  });

  // Find workspace by project path (for IDE extensions)
  // GET /api/workspaces/by-path?path=/path/to/project
  router.get('/api/workspaces/by-path', async (req: Request, res: Response) => {
    try {
      const projectPath = req.query.path as string;

      if (!projectPath) {
        res.status(400).json({
          success: false,
          error: 'path query parameter is required',
        });
        return;
      }

      const workspace = ctx.workspaceStore.findByProjectRoot(projectPath);

      res.json({
        success: true,
        exists: !!workspace,
        workspace: workspace || null,
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  });

  // Get single workspace
  router.get('/api/workspaces/:id', async (req: Request, res: Response) => {
    try {
      const workspace = ctx.workspaceStore.get(req.params.id);

      if (!workspace) {
        res.status(404).json({
          success: false,
          error: 'Workspace not found',
        });
        return;
      }

      res.json({ success: true, workspace });
    } catch (error) {
      res.status(500).json({
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  });

  // Create workspace
  router.post('/api/workspaces', async (req: Request, res: Response) => {
    try {
      const body = req.body as {
        label?: string;
        projectRoot?: string;
        source?: WorkspaceSource;
        sourceInstanceId?: string;
      };
      const { label, projectRoot, source, sourceInstanceId } = body;

      if (!label || !projectRoot) {
        res.status(400).json({
          success: false,
          error: 'label and projectRoot are required',
        });
        return;
      }

      const workspace = await ctx.workspaceStore.create({
        label,
        projectRoot,
        source,
        sourceInstanceId,
      });

      ctx.eventBus.emitAppEvent({
        type: 'workspace-created',
        data: workspace,
      });

      res.status(201).json({ success: true, workspace });
    } catch (error) {
      res.status(500).json({
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  });

  // Update workspace
  router.patch('/api/workspaces/:id', async (req: Request, res: Response) => {
    try {
      const body = req.body as { label?: string; projectRoot?: string };
      const { label, projectRoot } = body;

      const workspace = await ctx.workspaceStore.update(req.params.id, {
        label,
        projectRoot,
      });

      if (!workspace) {
        res.status(404).json({
          success: false,
          error: 'Workspace not found',
        });
        return;
      }

      ctx.eventBus.emitAppEvent({
        type: 'workspace-updated',
        data: workspace,
      });

      res.json({ success: true, workspace });
    } catch (error) {
      res.status(500).json({
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  });

  // Delete workspace
  router.delete('/api/workspaces/:id', async (req: Request, res: Response) => {
    try {
      // Stop all instances for this workspace
      const instances = ctx.processManager.getAllInstances()
        .filter((i) => i.workspaceId === req.params.id);

      for (const instance of instances) {
        await ctx.processManager.stop(instance.serverId, instance.workspaceId);
      }

      // Delete workspace
      const deleted = await ctx.workspaceStore.delete(req.params.id);

      if (!deleted) {
        res.status(404).json({
          success: false,
          error: 'Workspace not found',
        });
        return;
      }

      ctx.eventBus.emitAppEvent({
        type: 'workspace-deleted',
        data: { id: req.params.id },
      });

      res.json({ success: true });
    } catch (error) {
      res.status(500).json({
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  });

  // Get workspace server configs
  router.get('/api/workspaces/:id/servers', async (req: Request, res: Response) => {
    try {
      const workspace = ctx.workspaceStore.get(req.params.id);

      if (!workspace) {
        res.status(404).json({
          success: false,
          error: 'Workspace not found',
        });
        return;
      }

      const servers = ctx.workspaceStore.getAllServerConfigs(req.params.id);
      res.json({ success: true, servers });
    } catch (error) {
      res.status(500).json({
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  });

  // Get server config for workspace
  router.get('/api/workspaces/:id/servers/:serverId/config', async (req: Request, res: Response) => {
    try {
      const { id: workspaceId, serverId } = req.params;

      // Get server template for default config and schema
      const server = await ctx.serverStore.get(serverId);
      if (!server) {
        res.status(404).json({
          success: false,
          error: 'Server not found',
        });
        return;
      }

      // For 'global' workspace, just return the default config from server template
      // For specific workspaces, merge with workspace-specific overrides
      const isGlobal = workspaceId === 'global';
      const wsConfig = isGlobal ? null : ctx.workspaceStore.getServerConfig(workspaceId, serverId);

      // Merge default config with override (if any)
      const mergedConfig = {
        ...server.defaultConfig,
        ...(wsConfig?.configOverride || {}),
      };

      res.json({
        success: true,
        config: mergedConfig,
        schema: server.configSchema,
        defaultConfig: server.defaultConfig,
        workspaceOverride: wsConfig?.configOverride || {},
        isGlobal,
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  });

  // Update server config for workspace (or global default)
  router.put('/api/workspaces/:id/servers/:serverId', async (req: Request, res: Response) => {
    try {
      const { id: workspaceId, serverId } = req.params;
      const isGlobal = workspaceId === 'global';

      const body = req.body as {
        enabled?: boolean;
        configOverride?: Record<string, unknown>;
        secretKeys?: string[];
      };
      const { enabled, configOverride, secretKeys } = body;

      if (isGlobal) {
        // For global, update the server template's defaultConfig
        const server = await ctx.serverStore.get(serverId);
        if (!server) {
          res.status(404).json({
            success: false,
            error: 'Server not found',
          });
          return;
        }

        await ctx.serverStore.update(serverId, {
          defaultConfig: configOverride || {},
        });

        res.json({
          success: true,
          config: configOverride || {},
          isGlobal: true,
        });
      } else {
        // For specific workspace, check if workspace exists
        const workspace = ctx.workspaceStore.get(workspaceId);
        if (!workspace) {
          res.status(404).json({
            success: false,
            error: 'Workspace not found',
          });
          return;
        }

        await ctx.workspaceStore.setServerConfig(workspaceId, serverId, {
          enabled: enabled ?? true,
          configOverride,
          secretKeys,
        });

        const config = ctx.workspaceStore.getServerConfig(workspaceId, serverId);
        res.json({ success: true, config, isGlobal: false });
      }
    } catch (error) {
      res.status(500).json({
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  });

  // Delete server config for workspace
  router.delete('/api/workspaces/:id/servers/:serverId', async (req: Request, res: Response) => {
    try {
      await ctx.workspaceStore.deleteServerConfig(req.params.id, req.params.serverId);
      res.json({ success: true });
    } catch (error) {
      res.status(500).json({
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  });
}
