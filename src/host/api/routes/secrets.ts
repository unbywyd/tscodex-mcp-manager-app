/**
 * Secret Routes - Secret key listing (NO VALUES via HTTP!)
 */

import { Router, Request, Response } from '../../http/router';
import type { RouteContext } from './index';

export function createSecretRoutes(router: Router, ctx: RouteContext): void {
  // Get secret keys for server (NO VALUES!)
  router.get('/api/secrets/:serverId', async (req: Request, res: Response) => {
    try {
      const { serverId } = req.params;
      const { scope = 'global', workspaceId } = req.query;

      if (scope !== 'global' && scope !== 'workspace') {
        res.status(400).json({
          success: false,
          error: 'scope must be "global" or "workspace"',
        });
        return;
      }

      if (scope === 'workspace' && !workspaceId) {
        res.status(400).json({
          success: false,
          error: 'workspaceId is required for workspace scope',
        });
        return;
      }

      const keys = await ctx.secretStore.getSecretKeys(
        serverId,
        scope as 'global' | 'workspace',
        workspaceId as string | undefined
      );

      res.json({
        success: true,
        keys,
        scope,
        message: 'Secret values are not exposed via HTTP. Use the MCP Manager app to manage secrets.',
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  });

  // Get all secret keys (global + workspace merged)
  router.get('/api/secrets/:serverId/all', async (req: Request, res: Response) => {
    try {
      const { serverId } = req.params;
      const { workspaceId } = req.query;

      const globalKeys = await ctx.secretStore.getSecretKeys(serverId, 'global');

      let workspaceKeys: string[] = [];
      if (workspaceId) {
        workspaceKeys = await ctx.secretStore.getSecretKeys(
          serverId,
          'workspace',
          workspaceId as string
        );
      }

      // Deduplicate
      const allKeys = [...new Set([...globalKeys, ...workspaceKeys])];

      // Indicate source for each key
      const keysWithSource = allKeys.map((key) => ({
        key,
        source: workspaceKeys.includes(key)
          ? 'workspace'
          : 'global',
      }));

      res.json({
        success: true,
        keys: keysWithSource,
        message: 'Secret values are not exposed via HTTP. Use the MCP Manager app to manage secrets.',
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  });
}
