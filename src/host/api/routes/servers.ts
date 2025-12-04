/**
 * Server Routes - Server template CRUD
 */

import { Router, Request, Response } from '../../http/router';
import type { RouteContext } from './index';
import type { InstallType, ServerPermissions } from '../../../shared/types';
import { DEFAULT_HOST_PORT, DEFAULT_SERVER_PERMISSIONS } from '../../../shared/types';
import { checkForUpdate, clearPackageCache } from '../../managers/PackageVersionChecker';
import { readLocalPackageJson, fetchNpmPackageMetadata } from '../../managers/PackageMetadataReader';
import { getPackageInstaller } from '../../managers/PackageInstaller';

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
      // Servers are enabled by default unless explicitly disabled
      let mcpEndpoints: Record<string, string> | undefined;
      if (workspaceId) {
        mcpEndpoints = {};
        for (const server of servers) {
          // Check if server is explicitly disabled for this workspace
          const wsConfig = ctx.workspaceStore.getServerConfig(workspaceId, server.id);
          // Server is enabled by default - only skip if explicitly disabled (enabled === false)
          // This matches frontend behavior in appStore.isServerEnabledForWorkspace
          if (wsConfig?.enabled === false) {
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
        entryPoint?: string;
      };
      const { installType, packageName, packageVersion, localPath, entryPoint } = body;

      if (!installType) {
        res.status(400).json({
          success: false,
          error: 'installType is required',
        });
        return;
      }

      const validTypes: InstallType[] = ['npm', 'npx', 'pnpx', 'yarn', 'bunx', 'local'];
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

      if (installType === 'npm' && !entryPoint) {
        res.status(400).json({
          success: false,
          error: 'entryPoint is required for npm install type',
        });
        return;
      }

      if (installType !== 'local' && !packageName) {
        res.status(400).json({
          success: false,
          error: 'packageName is required for package install types',
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

      // Use provided packageVersion, or fall back to version from metadata
      const resolvedPackageVersion = packageVersion || metadata?.version;
      console.log(`[ServerRoutes] Creating server:`, {
        packageName,
        providedVersion: packageVersion,
        metadataVersion: metadata?.version,
        resolvedVersion: resolvedPackageVersion,
      });

      const server = await ctx.serverStore.create({
        installType,
        packageName,
        packageVersion: resolvedPackageVersion,
        localPath,
        entryPoint,
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
        packageVersion?: string;
        defaultConfig?: Record<string, unknown>;
        configSchema?: Record<string, unknown>;
        toolsCount?: number;
        resourcesCount?: number;
        promptsCount?: number;
        contextHeaders?: string[];
      };
      const { displayName, description, version, packageVersion, defaultConfig, configSchema, toolsCount, resourcesCount, promptsCount, contextHeaders } = body;

      // Filter undefined values to avoid overwriting existing data
      const updateData: Partial<typeof body> = {};
      if (displayName !== undefined) updateData.displayName = displayName;
      if (description !== undefined) updateData.description = description;
      if (version !== undefined) updateData.version = version;
      if (packageVersion !== undefined) updateData.packageVersion = packageVersion;
      if (defaultConfig !== undefined) updateData.defaultConfig = defaultConfig;
      if (configSchema !== undefined) updateData.configSchema = configSchema;
      if (toolsCount !== undefined) updateData.toolsCount = toolsCount;
      if (resourcesCount !== undefined) updateData.resourcesCount = resourcesCount;
      if (promptsCount !== undefined) updateData.promptsCount = promptsCount;
      if (contextHeaders !== undefined) updateData.contextHeaders = contextHeaders;

      const server = await ctx.serverStore.update(req.params.id, updateData);

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

  // Get package version from npm registry
  router.get('/api/packages/:packageName/version', async (req: Request, res: Response) => {
    try {
      const packageName = decodeURIComponent(req.params.packageName);

      if (!packageName) {
        res.status(400).json({
          success: false,
          error: 'packageName is required',
        });
        return;
      }

      const metadata = await fetchNpmPackageMetadata(packageName);

      if (!metadata || !metadata.version) {
        res.status(404).json({
          success: false,
          error: 'Package not found or version unavailable',
        });
        return;
      }

      res.json({
        success: true,
        packageName,
        version: metadata.version,
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  });

  // Install package via npm to local app directory
  router.post('/api/packages/install', async (req: Request, res: Response) => {
    try {
      const body = req.body as {
        packageName: string;
        version?: string;
      };
      const { packageName, version } = body;

      if (!packageName) {
        res.status(400).json({
          success: false,
          error: 'packageName is required',
        });
        return;
      }

      const installer = getPackageInstaller();
      const result = await installer.install(packageName, version);

      if (!result.success) {
        res.status(500).json({
          success: false,
          error: result.error || 'Installation failed',
        });
        return;
      }

      res.json({
        success: true,
        packageName,
        version: result.version,
        entryPoint: result.entryPoint,
        packagePath: result.packagePath,
      });
    } catch (error) {
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

      // Only check for npm-based servers
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

      // Check for updates - checkForUpdate now handles all cases including unknown/latest
      const updateInfo = await checkForUpdate(server.packageName, server.packageVersion);

      res.json({
        success: true,
        hasUpdate: updateInfo.hasUpdate,
        latestVersion: updateInfo.latestVersion,
        currentVersion: updateInfo.currentVersion || 'unknown',
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

      const previousVersion = server.packageVersion;

      // For npm install type, actually reinstall the package
      if (server.installType === 'npm') {
        const installer = getPackageInstaller();
        const result = await installer.update(server.packageName, targetVersion);

        if (!result.success) {
          res.status(500).json({
            success: false,
            error: result.error || 'Failed to update package',
          });
          return;
        }

        // Update version and entryPoint in store
        await ctx.serverStore.update(server.id, {
          packageVersion: result.version,
          entryPoint: result.entryPoint,
        });
      } else {
        // For npx/pnpx/yarn/bunx, just update the version in store
        await ctx.serverStore.update(server.id, {
          packageVersion: targetVersion,
        });
      }

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
