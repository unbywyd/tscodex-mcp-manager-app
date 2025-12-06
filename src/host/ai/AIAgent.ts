/**
 * AIAgent - Manages AI Assistant functionality and proxy for MCP servers
 */

import OpenAI from 'openai';
import crypto from 'crypto';
import type { SecretStore } from '../stores/SecretStore';
import type { ServerStore } from '../stores/ServerStore';
import type { WorkspaceStore } from '../stores/WorkspaceStore';
import type { AIUsageStore } from '../stores/AIUsageStore';
import type {
  AIPermissions,
  AIModelsInfo,
  AIGlobalTokenInfo,
  AITokenValidationResult,
  AIUsageEntry,
  AIUsageStats,
} from '../../shared/types';

interface ProxyTokenData {
  serverId: string;
  workspaceId: string;
  createdAt: number;
}

interface RateLimitEntry {
  count: number;
  resetAt: number;
}

const GLOBAL_TOKEN_KEY = 'GLOBAL_TOKEN';
const GLOBAL_TOKEN_CREATED_KEY = 'GLOBAL_TOKEN_CREATED';
const DEFAULT_HOST_PORT = 4040;

export class AIAgent {
  private client: OpenAI | null = null;
  private defaultModel: string = '';
  private configured: boolean = false;

  // Proxy token management (for MCP servers)
  private proxyTokens = new Map<string, ProxyTokenData>();

  // Global token (cached in memory)
  private globalToken: string | null = null;
  private globalTokenCreatedAt: number | null = null;

  // Rate limiting per server
  private rateLimits = new Map<string, RateLimitEntry>();

  // Usage store reference (optional, set via setUsageStore)
  private usageStore: AIUsageStore | null = null;

  constructor(
    private secretStore: SecretStore,
    private serverStore: ServerStore,
    private workspaceStore: WorkspaceStore
  ) {}

  /**
   * Set usage store reference
   */
  setUsageStore(store: AIUsageStore): void {
    this.usageStore = store;
  }

  /**
   * Check if AI Assistant is configured
   */
  isConfigured(): boolean {
    return this.configured;
  }

  /**
   * Get default model
   */
  getDefaultModel(): string {
    return this.defaultModel;
  }

  /**
   * Initialize AI Agent from stored config
   */
  async initialize(): Promise<boolean> {
    const apiKey = await this.secretStore.getAISecret('API_KEY');
    const baseUrl = await this.secretStore.getAISecret('BASE_URL');
    const model = await this.secretStore.getAISecret('DEFAULT_MODEL');

    if (!apiKey || !baseUrl || !model) {
      this.configured = false;
      this.client = null;
      this.defaultModel = '';
      return false;
    }

    this.client = new OpenAI({
      apiKey,
      baseURL: baseUrl,
    });
    this.defaultModel = model;
    this.configured = true;

    // Load global token
    await this.loadGlobalToken();

    return true;
  }

  /**
   * Load global token from storage
   */
  private async loadGlobalToken(): Promise<void> {
    this.globalToken = await this.secretStore.getAISecret(GLOBAL_TOKEN_KEY);
    const createdStr = await this.secretStore.getAISecret(GLOBAL_TOKEN_CREATED_KEY);
    this.globalTokenCreatedAt = createdStr ? parseInt(createdStr, 10) : null;
  }

  /**
   * Get global token info for UI
   */
  getGlobalTokenInfo(): AIGlobalTokenInfo {
    return {
      hasToken: !!this.globalToken,
      proxyUrl: `http://127.0.0.1:${DEFAULT_HOST_PORT}/api/ai/proxy/v1`,
      createdAt: this.globalTokenCreatedAt || undefined,
    };
  }

  /**
   * Get global token for copying (returns actual token)
   */
  async getGlobalToken(): Promise<string | null> {
    if (!this.globalToken) {
      // Auto-generate if not exists
      return await this.regenerateGlobalToken();
    }
    return this.globalToken;
  }

  /**
   * Regenerate global token
   */
  async regenerateGlobalToken(): Promise<string> {
    const newToken = crypto.randomBytes(32).toString('hex');
    const createdAt = Date.now();

    await this.secretStore.setAISecret(GLOBAL_TOKEN_KEY, newToken);
    await this.secretStore.setAISecret(GLOBAL_TOKEN_CREATED_KEY, createdAt.toString());

    this.globalToken = newToken;
    this.globalTokenCreatedAt = createdAt;

    return newToken;
  }

  /**
   * Verify AI configuration by making a test request
   */
  async verify(): Promise<{ success: boolean; error?: string }> {
    if (!this.client) {
      return { success: false, error: 'AI not configured' };
    }

    try {
      await this.client.chat.completions.create({
        model: this.defaultModel,
        messages: [{ role: 'user', content: 'Hi' }],
        max_tokens: 1,
      });
      return { success: true };
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      return { success: false, error: message };
    }
  }

  /**
   * Generate a proxy token for a server
   */
  generateProxyToken(serverId: string, workspaceId: string): string {
    const token = crypto.randomBytes(32).toString('hex');

    this.proxyTokens.set(token, {
      serverId,
      workspaceId,
      createdAt: Date.now(),
    });

    return token;
  }

  /**
   * Validate any token (global or server) and return type info
   */
  validateToken(token: string): AITokenValidationResult | null {
    // Check global token first
    if (this.globalToken && token === this.globalToken) {
      return { type: 'global' };
    }

    // Check server tokens
    const serverData = this.proxyTokens.get(token);
    if (serverData) {
      return {
        type: 'server',
        serverId: serverData.serverId,
        workspaceId: serverData.workspaceId,
      };
    }

    return null;
  }

  /**
   * Legacy method for backward compatibility
   */
  validateProxyToken(token: string): ProxyTokenData | null {
    return this.proxyTokens.get(token) || null;
  }

  /**
   * Revoke proxy tokens for a server
   */
  revokeTokensForServer(serverId: string): void {
    for (const [token, data] of this.proxyTokens) {
      if (data.serverId === serverId) {
        this.proxyTokens.delete(token);
      }
    }
  }

  /**
   * Get AI permissions for a server (merged global + workspace)
   */
  async getServerAIPermissions(serverId: string, workspaceId: string): Promise<AIPermissions | null> {
    const server = await this.serverStore.get(serverId);
    if (!server) return null;

    // Get global AI permissions from server config
    const globalAI = server.permissions?.ai;

    // For 'global' workspace, only use server's global permissions
    if (workspaceId === 'global') {
      if (!globalAI) {
        return null;
      }
      return {
        allowAccess: globalAI.allowAccess ?? false,
        allowedModels: globalAI.allowedModels ?? [],
        rateLimit: globalAI.rateLimit ?? 0,
      };
    }

    // For specific workspace, check if it exists
    const workspace = this.workspaceStore.get(workspaceId);
    if (!workspace) return null;

    const serverConfig = this.workspaceStore.getServerConfig(workspaceId, serverId);

    // Get workspace override
    const workspaceAI = serverConfig?.permissionsOverride?.ai;

    // Merge: workspace overrides global
    if (!globalAI && !workspaceAI) {
      return null;
    }

    return {
      allowAccess: workspaceAI?.allowAccess ?? globalAI?.allowAccess ?? false,
      allowedModels: workspaceAI?.allowedModels ?? globalAI?.allowedModels ?? [],
      rateLimit: workspaceAI?.rateLimit ?? globalAI?.rateLimit ?? 0,
    };
  }

  /**
   * Check rate limit for a server
   * Returns true if request is allowed, false if rate limited
   */
  checkRateLimit(serverId: string, limit: number): boolean {
    if (limit === 0) return true; // Unlimited

    const now = Date.now();
    const entry = this.rateLimits.get(serverId);

    if (!entry || now >= entry.resetAt) {
      // New window
      this.rateLimits.set(serverId, {
        count: 1,
        resetAt: now + 60000, // 1 minute window
      });
      return true;
    }

    if (entry.count >= limit) {
      return false; // Rate limited
    }

    entry.count++;
    return true;
  }

  /**
   * Get models info for a token (for /models endpoint)
   */
  async getModelsInfoForToken(token: string): Promise<AIModelsInfo | null> {
    const validation = this.validateToken(token);
    if (!validation) return null;

    if (validation.type === 'global') {
      // Global token has access to all models, no rate limit
      return {
        defaultModel: this.defaultModel,
        allowedModels: [], // Empty means all models allowed for global
        rateLimit: 0, // No rate limit
      };
    }

    // Server token
    const permissions = await this.getServerAIPermissions(
      validation.serverId!,
      validation.workspaceId!
    );
    if (!permissions || !permissions.allowAccess) {
      return null;
    }

    return {
      defaultModel: this.defaultModel,
      allowedModels: permissions.allowedModels,
      rateLimit: permissions.rateLimit,
    };
  }

  /**
   * Get models info for a server (for /models endpoint) - legacy method
   */
  async getModelsInfo(serverId: string, workspaceId: string): Promise<AIModelsInfo | null> {
    const permissions = await this.getServerAIPermissions(serverId, workspaceId);
    if (!permissions || !permissions.allowAccess) {
      return null;
    }

    return {
      defaultModel: this.defaultModel,
      allowedModels: permissions.allowedModels,
      rateLimit: permissions.rateLimit,
    };
  }

  /**
   * Check if a model is allowed for a server
   */
  async isModelAllowed(model: string, serverId: string, workspaceId: string): Promise<boolean> {
    const permissions = await this.getServerAIPermissions(serverId, workspaceId);
    if (!permissions || !permissions.allowAccess) {
      return false;
    }

    // If no specific models allowed, only default model is allowed
    if (permissions.allowedModels.length === 0) {
      return model === this.defaultModel;
    }

    // Check if model is in allowed list or is the default
    return permissions.allowedModels.includes(model) || model === this.defaultModel;
  }

  /**
   * Log usage to store
   */
  private async logUsage(entry: Omit<AIUsageEntry, 'id' | 'sourceName'>): Promise<void> {
    if (this.usageStore) {
      try {
        await this.usageStore.log(entry);
      } catch (error) {
        console.error('[AIAgent] Failed to log usage:', error);
      }
    }
  }

  /**
   * Proxy a chat completion request (unified for both global and server tokens)
   */
  async proxyChatCompletion(
    token: string,
    body: OpenAI.Chat.ChatCompletionCreateParams
  ): Promise<{ success: boolean; data?: OpenAI.Chat.ChatCompletion; error?: string; status?: number }> {
    const startTime = Date.now();

    if (!this.client || !this.configured) {
      return { success: false, error: 'AI not configured', status: 503 };
    }

    // Validate token (unified validation)
    const validation = this.validateToken(token);
    if (!validation) {
      return { success: false, error: 'Invalid or expired token', status: 401 };
    }

    const isGlobal = validation.type === 'global';
    const source = isGlobal ? 'global' : validation.serverId!;

    // For server tokens, check permissions and rate limit
    if (!isGlobal) {
      const permissions = await this.getServerAIPermissions(
        validation.serverId!,
        validation.workspaceId!
      );
      if (!permissions || !permissions.allowAccess) {
        this.logUsage({
          timestamp: Date.now(),
          source,
          model: body.model || this.defaultModel,
          inputTokens: 0,
          outputTokens: 0,
          status: 'error',
          errorMsg: 'AI access not allowed',
          latencyMs: Date.now() - startTime,
        });
        return { success: false, error: 'AI access not allowed for this server', status: 403 };
      }

      // Check rate limit
      if (!this.checkRateLimit(validation.serverId!, permissions.rateLimit)) {
        this.logUsage({
          timestamp: Date.now(),
          source,
          model: body.model || this.defaultModel,
          inputTokens: 0,
          outputTokens: 0,
          status: 'rate_limited',
          errorMsg: 'Rate limit exceeded',
          latencyMs: Date.now() - startTime,
        });
        return { success: false, error: 'Rate limit exceeded', status: 429 };
      }
    }

    // Determine model to use
    let modelToUse = body.model || this.defaultModel;

    if (!isGlobal) {
      // For server tokens, validate model
      if (!(await this.isModelAllowed(modelToUse, validation.serverId!, validation.workspaceId!))) {
        modelToUse = this.defaultModel;
      }
    }
    // Global token can use any model

    try {
      const response = await this.client.chat.completions.create({
        ...body,
        model: modelToUse,
        stream: false, // Streaming not supported yet
      });

      // Log successful request
      this.logUsage({
        timestamp: Date.now(),
        source,
        model: modelToUse,
        inputTokens: response.usage?.prompt_tokens || 0,
        outputTokens: response.usage?.completion_tokens || 0,
        status: 'success',
        latencyMs: Date.now() - startTime,
      });

      return { success: true, data: response };
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Unknown error';

      // Log error
      this.logUsage({
        timestamp: Date.now(),
        source,
        model: modelToUse,
        inputTokens: 0,
        outputTokens: 0,
        status: 'error',
        errorMsg: message,
        latencyMs: Date.now() - startTime,
      });

      return { success: false, error: message, status: 502 };
    }
  }

  // ============================================================================
  // AI Generation Methods (for MCP Tools form generation)
  // ============================================================================

  /**
   * Generate a tool definition from a natural language description
   * Uses OpenAI Structured Outputs for reliable JSON generation
   */
  async generateToolDefinition(prompt: string): Promise<{
    success: boolean;
    data?: {
      name: string;
      description: string;
      inputSchema: Record<string, unknown>;
      executorType: 'static' | 'http' | 'function';
      executor: Record<string, unknown>;
    };
    error?: string;
  }> {
    if (!this.client || !this.configured) {
      return { success: false, error: 'AI not configured' };
    }

    const systemPrompt = `You create MCP tool definitions. Choose the best executor type:

EXECUTOR TYPES:
1. "static" - Fixed response content.
   Fields: content (string), contentType ("text"|"json"), editorMode ("text"|"markdown"|"html"|"json"|"javascript")

2. "http" - HTTP request to external API.
   Fields: method ("GET"|"POST"|"PUT"|"PATCH"|"DELETE"), url, headers (object), body (string)
   Placeholders: {{paramName}} for input params, {{SECRET_NAME}} for API keys

3. "function" - JavaScript async function for data processing.
   Field: code (string with async function body)
   Available context:
   - params: input parameters object
   - context.session.workspaceId: current workspace ID
   - context.session.projectRoot: project root path
   - context.session.clientType: client type (claude-code, cursor, etc.)
   - context.request.timestamp: request timestamp (Unix ms)
   - context.request.requestId: unique request ID
   - context.utils.fetch(url, options): HTTP fetch function
   - console.log(): logging

RULES:
- name: snake_case, starts with letter
- Prefer http for APIs, function for complex logic, static for constants`;

    // JSON Schema for structured output
    const toolSchema = {
      type: 'object' as const,
      properties: {
        name: {
          type: 'string' as const,
          description: 'Tool name in snake_case (lowercase letters, numbers, underscores)',
        },
        description: {
          type: 'string' as const,
          description: 'Clear description of what the tool does',
        },
        inputSchema: {
          type: 'object' as const,
          description: 'JSON Schema for tool input parameters',
          additionalProperties: true,
        },
        executorType: {
          type: 'string' as const,
          enum: ['static', 'http', 'function'],
          description: 'Type of executor',
        },
        executor: {
          type: 'object' as const,
          description: 'Executor configuration. Only include fields for chosen executorType.',
          properties: {
            // static executor fields
            content: { type: 'string' as const, description: 'Static content (for static type)' },
            contentType: { type: 'string' as const, enum: ['text', 'json'], description: 'Content type (for static type)' },
            editorMode: { type: 'string' as const, enum: ['text', 'markdown', 'html', 'json', 'javascript'], description: 'Editor mode (for static type)' },
            // http executor fields
            method: { type: 'string' as const, enum: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'], description: 'HTTP method (for http type)' },
            url: { type: 'string' as const, description: 'URL with {{param}} placeholders (for http type)' },
            headers: { type: 'object' as const, description: 'HTTP headers object (for http type)' },
            body: { type: 'string' as const, description: 'Request body (for http type)' },
            // function executor fields
            code: { type: 'string' as const, description: 'JavaScript async function code (for function type)' },
          },
        },
      },
      required: ['name', 'description', 'inputSchema', 'executorType', 'executor'],
    };

    try {
      const response = await this.client.chat.completions.create({
        model: this.defaultModel,
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: `Create a tool for: ${prompt}` },
        ],
        temperature: 0.3,
        max_tokens: 2000,
        response_format: {
          type: 'json_schema',
          json_schema: {
            name: 'tool_definition',
            schema: toolSchema,
          },
        },
      });

      const content = response.choices[0]?.message?.content;
      if (!content) {
        return { success: false, error: 'No response from AI' };
      }

      const data = JSON.parse(content);
      return { success: true, data };
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      return { success: false, error: `Failed to generate tool: ${message}` };
    }
  }

  /**
   * Generate a resource definition from a natural language description
   * Uses OpenAI Structured Outputs for reliable JSON generation
   */
  async generateResourceDefinition(prompt: string): Promise<{
    success: boolean;
    data?: {
      name: string;
      description: string;
      mimeType: string;
      executorType: 'static' | 'http' | 'function';
      executor: Record<string, unknown>;
    };
    error?: string;
  }> {
    if (!this.client || !this.configured) {
      return { success: false, error: 'AI not configured' };
    }

    const systemPrompt = `You create MCP resource definitions. Choose the best executor type:

EXECUTOR TYPES:
1. "static" - Fixed content for documentation, config, templates.
   Fields: content (string), contentType ("text"|"json"), editorMode ("text"|"markdown"|"html"|"json"|"javascript")

2. "http" - Fetch content from external URL.
   Fields: method ("GET"|"POST"|"PUT"|"PATCH"|"DELETE"), url, headers (object)
   Placeholders: {{SECRET_NAME}} for API keys

3. "function" - JavaScript async function for dynamic content generation.
   Field: code (string with async function body)
   Available context:
   - context.session.workspaceId: current workspace ID
   - context.session.projectRoot: project root path
   - context.session.clientType: client type (claude-code, cursor, etc.)
   - context.request.timestamp: request timestamp (Unix ms)
   - context.request.requestId: unique request ID
   - context.utils.fetch(url, options): HTTP fetch function
   - context.utils.log(message): logging function
   - console.log(): also available for logging

RULES:
- name: snake_case, starts with letter
- mimeType should match content: text/plain, text/markdown, text/html, application/json, application/xml`;

    // JSON Schema for structured output
    const resourceSchema = {
      type: 'object' as const,
      properties: {
        name: {
          type: 'string' as const,
          description: 'Resource name in snake_case (lowercase letters, numbers, underscores)',
        },
        description: {
          type: 'string' as const,
          description: 'Clear description of what the resource provides',
        },
        mimeType: {
          type: 'string' as const,
          enum: ['text/plain', 'text/markdown', 'text/html', 'application/json', 'application/xml'],
          description: 'MIME type of the resource content',
        },
        executorType: {
          type: 'string' as const,
          enum: ['static', 'http', 'function'],
          description: 'Type of executor',
        },
        executor: {
          type: 'object' as const,
          description: 'Executor configuration. Only include fields for chosen executorType.',
          properties: {
            // static executor fields
            content: { type: 'string' as const, description: 'Static content (for static type)' },
            contentType: { type: 'string' as const, enum: ['text', 'json'], description: 'Content type (for static type)' },
            editorMode: { type: 'string' as const, enum: ['text', 'markdown', 'html', 'json', 'javascript'], description: 'Editor mode (for static type)' },
            // http executor fields
            method: { type: 'string' as const, enum: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'], description: 'HTTP method (for http type)' },
            url: { type: 'string' as const, description: 'Request URL (for http type)' },
            headers: { type: 'object' as const, description: 'HTTP headers object (for http type)' },
            // function executor fields
            code: { type: 'string' as const, description: 'JavaScript async function code (for function type)' },
          },
        },
      },
      required: ['name', 'description', 'mimeType', 'executorType', 'executor'],
    };

    try {
      const response = await this.client.chat.completions.create({
        model: this.defaultModel,
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: `Create a resource for: ${prompt}` },
        ],
        temperature: 0.3,
        max_tokens: 2000,
        response_format: {
          type: 'json_schema',
          json_schema: {
            name: 'resource_definition',
            schema: resourceSchema,
          },
        },
      });

      const content = response.choices[0]?.message?.content;
      if (!content) {
        return { success: false, error: 'No response from AI' };
      }

      const data = JSON.parse(content);
      return { success: true, data };
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      return { success: false, error: `Failed to generate resource: ${message}` };
    }
  }

  // ============================================================================
  // Usage Statistics Methods
  // ============================================================================

  /**
   * Get usage statistics (delegates to store)
   */
  async getUsageStats(source?: string, periodMs?: number): Promise<AIUsageStats> {
    if (!this.usageStore) {
      return {
        totalRequests: 0,
        totalInputTokens: 0,
        totalOutputTokens: 0,
        bySource: {},
      };
    }
    return await this.usageStore.getStats(source, periodMs);
  }

  /**
   * Get usage log (delegates to store)
   */
  async getUsageLog(
    source?: string,
    periodMs?: number,
    page?: number,
    limit?: number
  ): Promise<{ entries: AIUsageEntry[]; total: number; pages: number }> {
    if (!this.usageStore) {
      return { entries: [], total: 0, pages: 0 };
    }

    const result = await this.usageStore.getLog(source, periodMs, page, limit);

    // Enrich entries with source names
    const entries: AIUsageEntry[] = await Promise.all(
      result.entries.map(async (entry) => {
        let sourceName = entry.source;
        if (entry.source !== 'global') {
          const server = await this.serverStore.get(entry.source);
          if (server) {
            sourceName = server.displayName || server.packageName || entry.source;
          }
        }
        return { ...entry, sourceName };
      })
    );

    return { entries, total: result.total, pages: result.pages };
  }

  /**
   * Get unique sources from usage log
   */
  async getUsageSources(): Promise<Array<{ id: string; name: string }>> {
    if (!this.usageStore) {
      return [];
    }

    const sourceIds = await this.usageStore.getSources();
    return Promise.all(
      sourceIds.map(async (id) => {
        if (id === 'global') {
          return { id, name: 'Global' };
        }
        const server = await this.serverStore.get(id);
        return {
          id,
          name: server?.displayName || server?.packageName || id,
        };
      })
    );
  }
}
