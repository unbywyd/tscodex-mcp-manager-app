/**
 * AI Assistant API Routes
 */

import type OpenAI from 'openai';
import type { Router, Request, Response } from '../../http/router';
import type { AIAgent } from '../../ai/AIAgent';
import type { SecretStore } from '../../stores/SecretStore';

export interface AIRouteContext {
  aiAgent: AIAgent;
  secretStore: SecretStore;
}

// Period presets in milliseconds
const PERIOD_PRESETS: Record<string, number> = {
  '1h': 60 * 60 * 1000,
  '24h': 24 * 60 * 60 * 1000,
  '7d': 7 * 24 * 60 * 60 * 1000,
  '30d': 30 * 24 * 60 * 60 * 1000,
  all: 0, // 0 means no filter
};

export function createAIRoutes(router: Router, ctx: AIRouteContext): void {
  const { aiAgent, secretStore } = ctx;

  // ============================================================================
  // Config Endpoints (for UI)
  // ============================================================================

  /**
   * GET /api/ai/status - Get AI Assistant status
   */
  router.get('/api/ai/status', async (_req: Request, res: Response) => {
    res.json({
      success: true,
      configured: aiAgent.isConfigured(),
    });
  });

  /**
   * GET /api/ai/config - Get AI config (without API key)
   */
  router.get('/api/ai/config', async (_req: Request, res: Response) => {
    const config = await secretStore.getAIConfig();
    res.json({
      success: true,
      config: {
        baseUrl: config.baseUrl || '',
        defaultModel: config.defaultModel || '',
        hasApiKey: config.hasApiKey,
      },
    });
  });

  /**
   * DELETE /api/ai/config - Clear AI config (API key, base URL, model)
   */
  router.delete('/api/ai/config', async (_req: Request, res: Response) => {
    await secretStore.deleteAISecret('API_KEY');
    await secretStore.deleteAISecret('BASE_URL');
    await secretStore.deleteAISecret('DEFAULT_MODEL');

    // Re-initialize agent (will be unconfigured now)
    await aiAgent.initialize();

    res.json({
      success: true,
      message: 'AI configuration cleared',
    });
  });

  /**
   * POST /api/ai/verify - Verify and save AI config
   * Body: { baseUrl, apiKey, defaultModel }
   */
  router.post('/api/ai/verify', async (req: Request, res: Response) => {
    const { baseUrl, apiKey, defaultModel } = req.body as {
      baseUrl?: string;
      apiKey?: string;
      defaultModel?: string;
    };

    // Validate input
    if (!baseUrl || !defaultModel) {
      return res.status(400).json({
        success: false,
        error: 'Base URL and Default Model are required',
      });
    }

    // If apiKey provided, save it; otherwise check if one exists
    const existingApiKey = await secretStore.getAISecret('API_KEY');
    const keyToUse = apiKey || existingApiKey;

    if (!keyToUse) {
      return res.status(400).json({
        success: false,
        error: 'API Key is required',
      });
    }

    // Save config
    await secretStore.setAISecret('BASE_URL', baseUrl);
    await secretStore.setAISecret('DEFAULT_MODEL', defaultModel);
    if (apiKey) {
      await secretStore.setAISecret('API_KEY', apiKey);
    }

    // Re-initialize agent with new config
    await aiAgent.initialize();

    // Verify connection
    const result = await aiAgent.verify();

    if (!result.success) {
      return res.json({
        success: false,
        error: result.error || 'Failed to verify connection',
      });
    }

    res.json({
      success: true,
      message: 'AI Assistant configured successfully',
    });
  });

  // ============================================================================
  // Global Token Endpoints
  // ============================================================================

  /**
   * GET /api/ai/global-token - Get global token info (not the token itself)
   */
  router.get('/api/ai/global-token', async (_req: Request, res: Response) => {
    const info = aiAgent.getGlobalTokenInfo();
    res.json({
      success: true,
      ...info,
    });
  });

  /**
   * POST /api/ai/global-token/copy - Get actual global token for copying
   * Creates one if it doesn't exist
   */
  router.post('/api/ai/global-token/copy', async (_req: Request, res: Response) => {
    if (!aiAgent.isConfigured()) {
      return res.status(400).json({
        success: false,
        error: 'AI Assistant is not configured',
      });
    }

    const token = await aiAgent.getGlobalToken();
    res.json({
      success: true,
      token,
    });
  });

  /**
   * POST /api/ai/global-token/regenerate - Regenerate global token
   */
  router.post('/api/ai/global-token/regenerate', async (_req: Request, res: Response) => {
    if (!aiAgent.isConfigured()) {
      return res.status(400).json({
        success: false,
        error: 'AI Assistant is not configured',
      });
    }

    const token = await aiAgent.regenerateGlobalToken();
    res.json({
      success: true,
      token,
    });
  });

  // ============================================================================
  // Usage Stats Endpoints
  // ============================================================================

  /**
   * GET /api/ai/usage/sources - Get unique sources for filter dropdown
   */
  router.get('/api/ai/usage/sources', async (_req: Request, res: Response) => {
    const sources = await aiAgent.getUsageSources();
    res.json({
      success: true,
      sources,
    });
  });

  /**
   * GET /api/ai/usage/stats - Get usage statistics
   * Query params: source (optional), period (optional: 1h, 24h, 7d, 30d, all)
   */
  router.get('/api/ai/usage/stats', async (req: Request, res: Response) => {
    const source = req.query.source as string | undefined;
    const periodKey = (req.query.period as string) || '24h';
    const periodMs = PERIOD_PRESETS[periodKey] || PERIOD_PRESETS['24h'];

    const stats = await aiAgent.getUsageStats(
      source === 'all' ? undefined : source,
      periodMs || undefined
    );

    res.json({
      success: true,
      stats,
    });
  });

  /**
   * GET /api/ai/usage/log - Get usage log with pagination
   * Query params: source (optional), period (optional), page (default 1), limit (default 20)
   */
  router.get('/api/ai/usage/log', async (req: Request, res: Response) => {
    const source = req.query.source as string | undefined;
    const periodKey = (req.query.period as string) || '24h';
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 20;

    const periodMs = PERIOD_PRESETS[periodKey] || PERIOD_PRESETS['24h'];

    const result = await aiAgent.getUsageLog(
      source === 'all' ? undefined : source,
      periodMs || undefined,
      page,
      limit
    );

    res.json({
      success: true,
      ...result,
      page,
      limit,
    });
  });

  // ============================================================================
  // AI Generation Endpoints (for MCP Tools form generation)
  // ============================================================================

  /**
   * POST /api/ai/generate/tool - Generate tool JSON from natural language description
   * Body: { prompt: string }
   */
  router.post('/api/ai/generate/tool', async (req: Request, res: Response) => {
    if (!aiAgent.isConfigured()) {
      return res.status(503).json({
        success: false,
        error: 'AI Assistant is not configured',
      });
    }

    const { prompt } = req.body as { prompt?: string };
    if (!prompt || typeof prompt !== 'string') {
      return res.status(400).json({
        success: false,
        error: 'Prompt is required',
      });
    }

    if (prompt.length > 1000) {
      return res.status(400).json({
        success: false,
        error: 'Prompt must be 1000 characters or less',
      });
    }

    try {
      const result = await aiAgent.generateToolDefinition(prompt);
      if (!result.success) {
        return res.status(500).json({
          success: false,
          error: result.error || 'Failed to generate tool',
        });
      }
      res.json({
        success: true,
        data: result.data,
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        error: (error as Error).message,
      });
    }
  });

  /**
   * POST /api/ai/generate/resource - Generate resource JSON from natural language description
   * Body: { prompt: string }
   */
  router.post('/api/ai/generate/resource', async (req: Request, res: Response) => {
    if (!aiAgent.isConfigured()) {
      return res.status(503).json({
        success: false,
        error: 'AI Assistant is not configured',
      });
    }

    const { prompt } = req.body as { prompt?: string };
    if (!prompt || typeof prompt !== 'string') {
      return res.status(400).json({
        success: false,
        error: 'Prompt is required',
      });
    }

    if (prompt.length > 1000) {
      return res.status(400).json({
        success: false,
        error: 'Prompt must be 1000 characters or less',
      });
    }

    try {
      const result = await aiAgent.generateResourceDefinition(prompt);
      if (!result.success) {
        return res.status(500).json({
          success: false,
          error: result.error || 'Failed to generate resource',
        });
      }
      res.json({
        success: true,
        data: result.data,
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        error: (error as Error).message,
      });
    }
  });

  // ============================================================================
  // Proxy Endpoints (for MCP servers and global token)
  // ============================================================================

  /**
   * GET /api/ai/proxy/v1/models - Get available models for token
   * Authorization: Bearer <token> (global or server token)
   */
  router.get('/api/ai/proxy/v1/models', async (req: Request, res: Response) => {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({
        success: false,
        error: 'Missing or invalid authorization header',
      });
    }

    const token = authHeader.slice(7);
    const modelsInfo = await aiAgent.getModelsInfoForToken(token);

    if (!modelsInfo) {
      return res.status(401).json({
        success: false,
        error: 'Invalid or expired token',
      });
    }

    res.json(modelsInfo);
  });

  /**
   * POST /api/ai/proxy/v1/chat/completions - Proxy chat completion
   * Authorization: Bearer <token> (global or server token)
   */
  router.post('/api/ai/proxy/v1/chat/completions', async (req: Request, res: Response) => {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({
        success: false,
        error: 'Missing or invalid authorization header',
      });
    }

    const token = authHeader.slice(7);
    const result = await aiAgent.proxyChatCompletion(
      token,
      req.body as OpenAI.Chat.ChatCompletionCreateParams
    );

    if (!result.success) {
      return res.status(result.status || 500).json({
        success: false,
        error: result.error,
      });
    }

    // Return OpenAI-compatible response
    res.json(result.data);
  });
}
