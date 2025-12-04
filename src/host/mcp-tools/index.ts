/**
 * DynamicMcpServer - MCP protocol handler for dynamic tools, prompts, and resources
 */

import { v4 as uuid } from 'uuid';
import type { McpToolsStore } from '../stores/McpToolsStore';
import type { SecretStore } from '../stores/SecretStore';
import type {
  DynamicTool,
  DynamicPrompt,
  DynamicResource,
  ExecutionContext,
} from './types';
import { execute } from './executors';

// ============================================================================
// MCP Protocol Types
// ============================================================================

interface McpRequest {
  jsonrpc: '2.0';
  id: string | number;
  method: string;
  params?: Record<string, unknown>;
}

interface McpResponse {
  jsonrpc: '2.0';
  id: string | number;
  result?: unknown;
  error?: {
    code: number;
    message: string;
    data?: unknown;
  };
}

interface McpToolDefinition {
  name: string;
  description: string;
  inputSchema: Record<string, unknown>;
}

interface McpPromptDefinition {
  name: string;
  description: string;
  arguments?: Array<{
    name: string;
    description?: string;
    required?: boolean;
  }>;
}

interface McpResourceDefinition {
  uri: string;
  name: string;
  description: string;
  mimeType?: string;
}

// ============================================================================
// Dynamic MCP Server
// ============================================================================

export class DynamicMcpServer {
  private store: McpToolsStore;
  private secretStore: SecretStore;
  private logs: string[] = [];

  constructor(store: McpToolsStore, secretStore: SecretStore) {
    this.store = store;
    this.secretStore = secretStore;
  }

  /**
   * Handle incoming MCP request
   */
  async handleRequest(
    request: McpRequest,
    sessionContext: { workspaceId: string; projectRoot?: string; clientType?: string }
  ): Promise<McpResponse> {
    const { method, params, id } = request;

    try {
      let result: unknown;

      switch (method) {
        // Server info
        case 'initialize':
          result = this.handleInitialize();
          break;

        // Tools
        case 'tools/list':
          result = this.handleToolsList();
          break;
        case 'tools/call':
          result = await this.handleToolsCall(params as { name: string; arguments?: Record<string, unknown> }, sessionContext);
          break;

        // Prompts
        case 'prompts/list':
          result = this.handlePromptsList();
          break;
        case 'prompts/get':
          result = this.handlePromptsGet(params as { name: string; arguments?: Record<string, string> });
          break;

        // Resources
        case 'resources/list':
          result = this.handleResourcesList();
          break;
        case 'resources/read':
          result = await this.handleResourcesRead(params as { uri: string }, sessionContext);
          break;

        default:
          return {
            jsonrpc: '2.0',
            id,
            error: {
              code: -32601,
              message: `Method not found: ${method}`,
            },
          };
      }

      return {
        jsonrpc: '2.0',
        id,
        result,
      };
    } catch (error) {
      return {
        jsonrpc: '2.0',
        id,
        error: {
          code: -32603,
          message: (error as Error).message || 'Internal error',
          data: { stack: (error as Error).stack },
        },
      };
    }
  }

  // ============================================================================
  // Initialize
  // ============================================================================

  private handleInitialize(): Record<string, unknown> {
    return {
      protocolVersion: '2024-11-05',
      serverInfo: {
        name: 'mcp-tools',
        version: '1.0.0',
      },
      capabilities: {
        tools: {},
        prompts: {},
        resources: {},
      },
    };
  }

  // ============================================================================
  // Tools
  // ============================================================================

  private handleToolsList(): { tools: McpToolDefinition[] } {
    const tools = this.store.getEnabledTools();

    return {
      tools: tools.map((tool) => ({
        name: tool.name,
        description: tool.description,
        inputSchema: tool.inputSchema as Record<string, unknown>,
      })),
    };
  }

  private async handleToolsCall(
    params: { name: string; arguments?: Record<string, unknown> },
    sessionContext: { workspaceId: string; projectRoot?: string; clientType?: string }
  ): Promise<{ content: Array<{ type: string; text: string }> }> {
    const { name, arguments: args = {} } = params;

    // Find tool by name
    const tool = this.store.getToolByName(name);
    if (!tool) {
      throw new Error(`Tool not found: ${name}`);
    }

    if (!tool.enabled) {
      throw new Error(`Tool is disabled: ${name}`);
    }

    // Create execution context with params
    const context = this.createContext(sessionContext, args);

    // Execute tool
    const result = await execute(tool.executor, args, context);

    // Format result
    const text = typeof result === 'string' ? result : JSON.stringify(result, null, 2);

    return {
      content: [{ type: 'text', text }],
    };
  }

  // ============================================================================
  // Prompts
  // ============================================================================

  private handlePromptsList(): { prompts: McpPromptDefinition[] } {
    const prompts = this.store.getEnabledPrompts();

    return {
      prompts: prompts.map((prompt) => ({
        name: prompt.name,
        description: prompt.description,
        arguments: prompt.arguments?.map((arg) => ({
          name: arg.name,
          description: arg.description,
          required: arg.required,
        })),
      })),
    };
  }

  private handlePromptsGet(
    params: { name: string; arguments?: Record<string, string> }
  ): { description: string; messages: Array<{ role: string; content: { type: string; text: string } }> } {
    const { name, arguments: args = {} } = params;

    // Find prompt by name
    const prompt = this.store.getPromptByName(name);
    if (!prompt) {
      throw new Error(`Prompt not found: ${name}`);
    }

    if (!prompt.enabled) {
      throw new Error(`Prompt is disabled: ${name}`);
    }

    // Substitute placeholders in template
    let text = prompt.template;
    for (const [key, value] of Object.entries(args)) {
      text = text.replace(new RegExp(`\\{\\{${key}\\}\\}`, 'g'), value);
    }

    return {
      description: prompt.description,
      messages: [
        {
          role: 'user',
          content: { type: 'text', text },
        },
      ],
    };
  }

  // ============================================================================
  // Resources
  // ============================================================================

  private handleResourcesList(): { resources: McpResourceDefinition[] } {
    const resources = this.store.getEnabledResources();

    return {
      resources: resources.map((resource) => ({
        uri: resource.uri,
        name: resource.name,
        description: resource.description,
        mimeType: resource.mimeType,
      })),
    };
  }

  private async handleResourcesRead(
    params: { uri: string },
    sessionContext: { workspaceId: string; projectRoot?: string; clientType?: string }
  ): Promise<{ contents: Array<{ uri: string; mimeType?: string; text?: string; blob?: string }> }> {
    const { uri } = params;

    // Find resource by URI
    const resource = this.store.getResourceByUri(uri);
    if (!resource) {
      throw new Error(`Resource not found: ${uri}`);
    }

    if (!resource.enabled) {
      throw new Error(`Resource is disabled: ${uri}`);
    }

    // Create execution context
    const context = this.createContext(sessionContext);

    // Execute resource
    const result = await execute(resource.executor, {}, context);

    // Format result
    const text = typeof result === 'string' ? result : JSON.stringify(result, null, 2);

    return {
      contents: [
        {
          uri: resource.uri,
          mimeType: resource.mimeType || 'text/plain',
          text,
        },
      ],
    };
  }

  // ============================================================================
  // Helpers
  // ============================================================================

  private createContext(
    sessionContext: {
      workspaceId: string;
      projectRoot?: string;
      clientType?: string;
    },
    params: Record<string, unknown> = {}
  ): ExecutionContext {
    this.logs = []; // Reset logs for each execution

    return {
      session: {
        workspaceId: sessionContext.workspaceId,
        projectRoot: sessionContext.projectRoot,
        clientType: sessionContext.clientType,
      },
      request: {
        timestamp: Date.now(),
        requestId: uuid(),
      },
      params,
      utils: {
        fetch,
        log: (message: string) => {
          const timestamp = new Date().toISOString();
          this.logs.push(`[${timestamp}] ${message}`);
          console.log(`[MCP Tools] ${message}`);
        },
        getSecret: (keyName: string): string | undefined => {
          // Get secret from workspace or global
          // First try workspace-specific, then fall back to global
          const workspaceId = sessionContext.workspaceId;
          const secret = this.secretStore.getSecret(keyName, workspaceId);
          if (secret === undefined) {
            console.warn(`[MCP Tools] Secret not found: ${keyName} (workspace: ${workspaceId})`);
          }
          return secret;
        },
      },
    };
  }

  /**
   * Get logs from last execution
   */
  getLogs(): string[] {
    return [...this.logs];
  }
}

export * from './types';
export * from './executors';
