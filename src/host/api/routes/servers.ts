/**
 * Server Routes - Server template CRUD
 */

import { Router, Request, Response } from '../../http/router';
import type { RouteContext } from './index';
import type { InstallType, ServerPermissions } from '../../../shared/types';
import { DEFAULT_HOST_PORT, DEFAULT_SERVER_PERMISSIONS } from '../../../shared/types';
import { checkForUpdate, clearPackageCache } from '../../managers/PackageVersionChecker';
import { readLocalPackageJson, fetchNpmPackageMetadata } from '../../managers/PackageMetadataReader';

export function createServerRoutes(router: Router, ctx: RouteContext): void {
  // List all servers
  // Optional query param: workspaceId - filter instances by workspace
  router.get('/api/servers', async (req: Request, res: Response) => {
    try {
      const workspaceId = req.query.workspaceId as string | undefined;
      const servers = ctx.serverStore.getAll();

      // Enrich with instance status, fallback to cached metadata when stopped
      // Note: Servers always run in 'global' workspace, so we get global status
      const enriched = servers.map((server) => {
        const instances = ctx.processManager.getAllInstances()
          .filter((i) => i.serverId === server.id);

        // Get global running instance (servers only run globally)
        const runningInstance = instances.find((i) => i.status === 'running');

        // Debug: log packageInfo for each server
        if (server.packageInfo) {
          console.log(`[ServerRoutes] GET /api/servers - ${server.displayName} has packageInfo:`, {
            hasReadme: !!server.packageInfo.readme,
            readmeLength: server.packageInfo.readme?.length,
            hasAuthor: !!server.packageInfo.author,
          });
        }

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

      // Build mcpEndpoints for the workspace (if provided)
      // Only servers explicitly enabled for workspace get a proxy URL
      let mcpEndpoints: Record<string, string> | undefined;
      if (workspaceId) {
        mcpEndpoints = {};
        for (const server of servers) {
          // Check if server is explicitly enabled for this workspace
          const wsConfig = ctx.workspaceStore.getServerConfig(workspaceId, server.id);
          // Server must be explicitly enabled (wsConfig.enabled === true)
          // If no config exists or enabled is false/undefined, server is disabled
          if (!wsConfig || wsConfig.enabled !== true) {
            continue;
          }
          // Build proxy URL
          mcpEndpoints[server.id] = `http://127.0.0.1:${DEFAULT_HOST_PORT}/mcp/${server.id}/${workspaceId}`;
        }
      }

      res.json({ success: true, servers: enriched, mcpEndpoints });
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

      // Fetch package metadata
      let metadata = null;
      if (installType === 'local' && localPath) {
        metadata = await readLocalPackageJson(localPath);
      } else if (packageName) {
        metadata = await fetchNpmPackageMetadata(packageName);
      }

      const server = await ctx.serverStore.create({
        installType,
        packageName,
        packageVersion,
        localPath,
        // Use metadata if available
        displayName: metadata?.name,
        description: metadata?.description,
        packageInfo: metadata?.packageInfo,
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

      console.log(`[ServerRoutes] Refreshing metadata for server: ${server.id}`);
      console.log(`[ServerRoutes] Install type: ${server.installType}`);
      console.log(`[ServerRoutes] Local path: ${server.localPath}`);
      console.log(`[ServerRoutes] Package name: ${server.packageName}`);

      // Fetch package metadata based on install type
      let metadata = null;
      if (server.installType === 'local' && server.localPath) {
        console.log(`[ServerRoutes] Reading local package.json from: ${server.localPath}`);
        metadata = await readLocalPackageJson(server.localPath);
      } else if (server.packageName) {
        console.log(`[ServerRoutes] Fetching npm metadata for: ${server.packageName}`);
        metadata = await fetchNpmPackageMetadata(server.packageName);
      }

      console.log(`[ServerRoutes] Metadata result:`, metadata ? {
        name: metadata.name,
        hasReadme: !!metadata.packageInfo?.readme,
        readmeLength: metadata.packageInfo?.readme?.length,
        hasAuthor: !!metadata.packageInfo?.author,
        hasHomepage: !!metadata.packageInfo?.homepage,
        hasRepository: !!metadata.packageInfo?.repository,
      } : 'null');

      if (!metadata) {
        res.json({
          success: true,
          server,
          message: 'No metadata found',
        });
        return;
      }

      // Update server with new metadata
      const updated = await ctx.serverStore.update(server.id, {
        displayName: metadata.name || server.displayName,
        description: metadata.description || server.description,
        packageInfo: metadata.packageInfo,
      });

      res.json({ success: true, server: updated });
    } catch (error) {
      console.error(`[ServerRoutes] Error refreshing metadata:`, error);
      res.status(500).json({
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  });

  // Check for package updates
  router.get('/api/servers/:id/check-update', async (req: Request, res: Response) => {
    try {
      const server = await ctx.serverStore.get(req.params.id);

      if (!server) {
        res.status(404).json({
          success: false,
          error: 'Server not found',
        });
        return;
      }

      // Only check for npm-based servers with fixed version
      if (server.installType === 'local' || !server.packageName) {
        res.json({
          success: true,
          hasUpdate: false,
          latestVersion: null,
          currentVersion: null,
          message: 'Local servers do not support update checking',
        });
        return;
      }

      // Skip if using 'latest' - always up to date
      if (!server.packageVersion || server.packageVersion === 'latest') {
        res.json({
          success: true,
          hasUpdate: false,
          latestVersion: null,
          currentVersion: 'latest',
          message: 'Server is configured to use latest version',
        });
        return;
      }

      const updateInfo = await checkForUpdate(server.packageName, server.packageVersion);

      res.json({
        success: true,
        hasUpdate: updateInfo.hasUpdate,
        latestVersion: updateInfo.latestVersion,
        currentVersion: updateInfo.currentVersion,
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  });

  // Update server to latest version
  router.post('/api/servers/:id/update', async (req: Request, res: Response) => {
    try {
      const server = await ctx.serverStore.get(req.params.id);

      if (!server) {
        res.status(404).json({
          success: false,
          error: 'Server not found',
        });
        return;
      }

      // Only update npm-based servers
      if (server.installType === 'local' || !server.packageName) {
        res.status(400).json({
          success: false,
          error: 'Local servers cannot be updated through this endpoint',
        });
        return;
      }

      // Get target version from body or fetch latest
      const body = req.body as { version?: string };
      let targetVersion = body.version;

      if (!targetVersion) {
        // Fetch latest version
        const updateInfo = await checkForUpdate(server.packageName, server.packageVersion);
        if (!updateInfo.latestVersion) {
          res.status(400).json({
            success: false,
            error: 'Could not determine latest version',
          });
          return;
        }
        targetVersion = updateInfo.latestVersion;
      }

      // Check if server is running
      const instances = ctx.processManager.getAllInstances()
        .filter((i) => i.serverId === server.id);
      const wasRunning = instances.some((i) => i.status === 'running');

      // Stop all instances if running
      for (const instance of instances) {
        if (instance.status === 'running') {
          await ctx.processManager.stop(instance.serverId, instance.workspaceId);
        }
      }

      // Update version in store
      const previousVersion = server.packageVersion;
      await ctx.serverStore.update(server.id, {
        packageVersion: targetVersion,
      });

      // Clear cache for this package to ensure fresh check next time
      clearPackageCache(server.packageName);

      // Restart if was running (only global instance for now)
      if (wasRunning) {
        try {
          await ctx.processManager.start(server.id, 'global');
        } catch (startError) {
          console.error('[ServerRoutes] Failed to restart server after update:', startError);
          // Don't fail the whole update, just log the error
        }
      }

      res.json({
        success: true,
        previousVersion,
        newVersion: targetVersion,
        restarted: wasRunning,
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  });

  // ============================================================================
  // Server Permissions Routes
  // ============================================================================

  // Get global permissions for a server
  router.get('/api/servers/:id/permissions', async (req: Request, res: Response) => {
    try {
      const server = await ctx.serverStore.get(req.params.id);

      if (!server) {
        res.status(404).json({
          success: false,
          error: 'Server not found',
        });
        return;
      }

      // Return permissions or default if not set
      const permissions = server.permissions || null;
      const isLegacy = !server.permissions;

      res.json({
        success: true,
        data: {
          permissions,
          isLegacy, // Indicates server has no permissions configured (uses legacy behavior)
          defaults: DEFAULT_SERVER_PERMISSIONS,
        },
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  });

  // Update global permissions for a server
  router.put('/api/servers/:id/permissions', async (req: Request, res: Response) => {
    try {
      const server = await ctx.serverStore.get(req.params.id);

      if (!server) {
        res.status(404).json({
          success: false,
          error: 'Server not found',
        });
        return;
      }

      const body = req.body as { permissions: ServerPermissions };
      const { permissions } = body;

      if (!permissions) {
        res.status(400).json({
          success: false,
          error: 'permissions is required',
        });
        return;
      }

      // Validate permissions structure
      if (!permissions.env || !permissions.context || !permissions.secrets) {
        res.status(400).json({
          success: false,
          error: 'Invalid permissions structure. Must include env, context, and secrets',
        });
        return;
      }

      // Update server with new permissions
      const updated = await ctx.serverStore.update(req.params.id, {
        permissions,
      });

      res.json({
        success: true,
        data: { permissions: updated?.permissions },
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  });

  // Reset permissions to default (remove custom permissions)
  router.delete('/api/servers/:id/permissions', async (req: Request, res: Response) => {
    try {
      const server = await ctx.serverStore.get(req.params.id);

      if (!server) {
        res.status(404).json({
          success: false,
          error: 'Server not found',
        });
        return;
      }

      // Remove permissions (will use defaults)
      await ctx.serverStore.update(req.params.id, {
        permissions: undefined,
      });

      res.json({
        success: true,
        message: 'Permissions reset to defaults',
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  });

  // Get effective permissions for a server in a workspace (merged global + workspace override)
  router.get('/api/servers/:id/permissions/:workspaceId', async (req: Request, res: Response) => {
    try {
      const { id: serverId, workspaceId } = req.params;

      const server = await ctx.serverStore.get(serverId);
      if (!server) {
        res.status(404).json({
          success: false,
          error: 'Server not found',
        });
        return;
      }

      // Get global permissions
      const globalPerms = server.permissions || null;

      // Get workspace override
      const wsConfig = ctx.workspaceStore.getServerConfig(workspaceId, serverId);
      const workspaceOverride = wsConfig?.permissionsOverride || null;

      // Merge to get effective permissions
      let effectivePermissions: ServerPermissions | null = null;
      if (globalPerms) {
        if (workspaceOverride) {
          effectivePermissions = {
            env: { ...globalPerms.env, ...workspaceOverride.env },
            context: { ...globalPerms.context, ...workspaceOverride.context },
            secrets: workspaceOverride.secrets || globalPerms.secrets,
          };
        } else {
          effectivePermissions = globalPerms;
        }
      }

      res.json({
        success: true,
        data: {
          globalPermissions: globalPerms,
          workspaceOverride,
          effectivePermissions,
          isLegacy: !globalPerms,
        },
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  });

  // Update workspace-level permission override
  router.put('/api/servers/:id/permissions/:workspaceId', async (req: Request, res: Response) => {
    try {
      const { id: serverId, workspaceId } = req.params;

      const server = await ctx.serverStore.get(serverId);
      if (!server) {
        res.status(404).json({
          success: false,
          error: 'Server not found',
        });
        return;
      }

      const body = req.body as { permissionsOverride: Partial<ServerPermissions> };
      const { permissionsOverride } = body;

      if (!permissionsOverride) {
        res.status(400).json({
          success: false,
          error: 'permissionsOverride is required',
        });
        return;
      }

      // Get current workspace server config or create new one
      const currentConfig = ctx.workspaceStore.getServerConfig(workspaceId, serverId);

      await ctx.workspaceStore.setServerConfig(workspaceId, serverId, {
        ...currentConfig,
        enabled: currentConfig?.enabled ?? false,
        permissionsOverride,
      });

      res.json({
        success: true,
        data: { permissionsOverride },
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  });

  // Remove workspace-level permission override (use global)
  router.delete('/api/servers/:id/permissions/:workspaceId', async (req: Request, res: Response) => {
    try {
      const { id: serverId, workspaceId } = req.params;

      const currentConfig = ctx.workspaceStore.getServerConfig(workspaceId, serverId);

      if (currentConfig) {
        // Remove only permissionsOverride, keep other config
        await ctx.workspaceStore.setServerConfig(workspaceId, serverId, {
          ...currentConfig,
          permissionsOverride: undefined,
        });
      }

      res.json({
        success: true,
        message: 'Workspace permission override removed',
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  });
}
