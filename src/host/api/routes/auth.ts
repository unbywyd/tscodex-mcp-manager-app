/**
 * Auth Routes - User profile management
 */

import { Router, Request, Response } from '../../http/router';
import type { RouteContext } from './index';

export function createAuthRoutes(router: Router, ctx: RouteContext): void {
  // Get current profile
  router.get('/api/auth/profile', async (_req: Request, res: Response) => {
    try {
      const profile = await ctx.secretStore.getProfile();
      res.json({ success: true, profile });
    } catch (error) {
      res.status(500).json({
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  });

  // Login (save profile)
  router.post('/api/auth/login', async (req: Request, res: Response) => {
    try {
      const body = req.body as { fullName?: string; email?: string };
      const { fullName, email } = body;

      if (!fullName || !email) {
        res.status(400).json({
          success: false,
          error: 'fullName and email are required',
        });
        return;
      }

      await ctx.secretStore.setProfile(fullName, email);

      ctx.eventBus.emitAppEvent({
        type: 'profile-updated',
        data: { fullName, email },
      });

      res.json({
        success: true,
        profile: { fullName, email },
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  });

  // Logout (delete profile)
  router.post('/api/auth/logout', async (_req: Request, res: Response) => {
    try {
      await ctx.secretStore.deleteProfile();

      ctx.eventBus.emitAppEvent({
        type: 'profile-updated',
        data: null,
      });

      res.json({ success: true });
    } catch (error) {
      res.status(500).json({
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  });
}
