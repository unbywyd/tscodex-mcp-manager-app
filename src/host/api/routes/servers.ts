/**
 * Server Routes - Server template CRUD
 */

import { Router, Request, Response } from '../../http/router';
import type { RouteContext } from './index';
import type { InstallType } from '../../../shared/types';

export function createServerRoutes(router: Router, ctx: RouteContext): void {
  // List all servers
  router.get('/api/servers', async (_req: Request, res: Response) => {
    try {
      const servers = ctx.serverStore.getAll();

      // Enrich with instance status, fallback to cached metadata when stopped
      const enriched = servers.map((server) => {
        const instances = ctx.processManager.getAllInstances()
          .filter((i) => i.serverId === server.id);

        const runningInstance = instances.find((i) => i.status === 'running');

        return {
          ...server,
          status: runningInstance?.status || 'stopped',
          port: runningInstance?.port,
          // Use running instance data if available, otherwise use cached metadata from template
          toolsCount: runningInstance?.toolsCount ?? server.toolsCount,
          resourcesCount: runningInstance?.resourcesCount ?? server.resourcesCount,
          promptsCount: runningInstance?.promptsCount ?? server.promptsCount,
        };
      });

      res.json({ success: true, servers: enriched });
    } catch (error) {
      res.status(500).json({
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  });

  // Get single server
  router.get('/api/servers/:id', async (req: Request, res: Response) => {
    try {
      const server = await ctx.serverStore.get(req.params.id);

      if (!server) {
        res.status(404).json({
          success: false,
          error: 'Server not found',
        });
        return;
      }

      res.json({ success: true, server });
    } catch (error) {
      res.status(500).json({
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  });

  // Create server
  router.post('/api/servers', async (req: Request, res: Response) => {
    try {
      const body = req.body as {
        installType?: InstallType;
        packageName?: string;
        packageVersion?: string;
        localPath?: string;
      };
      const { installType, packageName, packageVersion, localPath } = body;

      if (!installType) {
        res.status(400).json({
          success: false,
          error: 'installType is required',
        });
        return;
      }

      const validTypes: InstallType[] = ['npx', 'pnpx', 'yarn', 'bunx', 'local'];
      if (!validTypes.includes(installType)) {
        res.status(400).json({
          success: false,
          error: `Invalid installType. Must be one of: ${validTypes.join(', ')}`,
        });
        return;
      }

      if (installType === 'local' && !localPath) {
        res.status(400).json({
          success: false,
          error: 'localPath is required for local install type',
        });
        return;
      }

      if (installType !== 'local' && !packageName) {
        res.status(400).json({
          success: false,
          error: 'packageName is required for package runner install types',
        });
        return;
      }

      const server = await ctx.serverStore.create({
        installType,
        packageName,
        packageVersion,
        localPath,
      });

      res.status(201).json({ success: true, server });
    } catch (error) {
      res.status(500).json({
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  });

  // Update server
  router.patch('/api/servers/:id', async (req: Request, res: Response) => {
    try {
      const body = req.body as {
        displayName?: string;
        description?: string;
        version?: string;
        defaultConfig?: Record<string, unknown>;
        configSchema?: Record<string, unknown>;
        toolsCount?: number;
        resourcesCount?: number;
        promptsCount?: number;
      };
      const { displayName, description, version, defaultConfig, configSchema, toolsCount, resourcesCount, promptsCount } = body;

      const server = await ctx.serverStore.update(req.params.id, {
        displayName,
        description,
        version,
        defaultConfig,
        configSchema,
        toolsCount,
        resourcesCount,
        promptsCount,
      });

      if (!server) {
        res.status(404).json({
          success: false,
          error: 'Server not found',
        });
        return;
      }

      res.json({ success: true, server });
    } catch (error) {
      res.status(500).json({
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  });

  // Delete server
  router.delete('/api/servers/:id', async (req: Request, res: Response) => {
    try {
      // Stop all instances first
      const instances = ctx.processManager.getAllInstances()
        .filter((i) => i.serverId === req.params.id);

      for (const instance of instances) {
        await ctx.processManager.stop(instance.serverId, instance.workspaceId);
      }

      // Delete secrets
      await ctx.secretStore.deleteAllSecrets(req.params.id);

      // Delete server
      const deleted = await ctx.serverStore.delete(req.params.id);

      if (!deleted) {
        res.status(404).json({
          success: false,
          error: 'Server not found',
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

  // Refresh metadata
  router.post('/api/servers/:id/refresh-metadata', async (req: Request, res: Response) => {
    try {
      const server = await ctx.serverStore.get(req.params.id);

      if (!server) {
        res.status(404).json({
          success: false,
          error: 'Server not found',
        });
        return;
      }

      // TODO: Run --meta command and update server metadata
      // For now, just return the current server

      res.json({ success: true, server });
    } catch (error) {
      res.status(500).json({
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  });
}
