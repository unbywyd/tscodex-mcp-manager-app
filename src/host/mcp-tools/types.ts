/**
 * Types for MCP Tools - Dynamic tools, prompts, and resources
 */

// ============================================================================
// JSON Schema Types
// ============================================================================

export interface JsonSchema {
  type?: string | string[];
  properties?: Record<string, JsonSchema>;
  required?: string[];
  items?: JsonSchema;
  enum?: unknown[];
  const?: unknown;
  default?: unknown;
  description?: string;
  minimum?: number;
  maximum?: number;
  minLength?: number;
  maxLength?: number;
  pattern?: string;
  format?: string;
  additionalProperties?: boolean | JsonSchema;
  oneOf?: JsonSchema[];
  anyOf?: JsonSchema[];
  allOf?: JsonSchema[];
  $ref?: string;
  $defs?: Record<string, JsonSchema>;
}

// ============================================================================
// Entity Types
// ============================================================================

export type EntityType = 'tool' | 'prompt' | 'resource';
export type ExecutorType = 'static' | 'http' | 'function';

export interface BaseEntity {
  id: string;
  name: string;
  description: string;
  enabled: boolean;
  createdAt: number;
  updatedAt: number;
}

// ============================================================================
// Tool Types
// ============================================================================

export interface DynamicTool extends BaseEntity {
  type: 'tool';
  inputSchema: JsonSchema;
  executor: ToolExecutor;
}

export type ToolExecutor = StaticExecutor | HttpExecutor | FunctionExecutor;

export type EditorMode = 'text' | 'markdown' | 'html' | 'json' | 'javascript';

export interface StaticExecutor {
  type: 'static';
  content: string;
  contentType: 'text' | 'json';
  /** Editor mode for syntax highlighting (client-side preference) */
  editorMode?: EditorMode;
}

export interface HttpExecutor {
  type: 'http';
  method: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
  url: string;
  headers?: Record<string, string>;
  body?: string;
  bodyType?: 'json' | 'form' | 'text';
  timeout?: number;
  responseMapping?: {
    successPath?: string;
    errorPath?: string;
  };
}

export interface FunctionExecutor {
  type: 'function';
  code: string;
}

// ============================================================================
// Prompt Types
// ============================================================================

export interface DynamicPrompt extends BaseEntity {
  type: 'prompt';
  arguments?: PromptArgument[];
  template: string;
}

export interface PromptArgument {
  name: string;
  description?: string;
  required?: boolean;
}

// ============================================================================
// Resource Types
// ============================================================================

export interface DynamicResource extends BaseEntity {
  type: 'resource';
  uri: string;
  mimeType?: string;
  executor: ResourceExecutor;
}

export type ResourceExecutor = StaticExecutor | HttpExecutor | FunctionExecutor;

// ============================================================================
// Execution Context
// ============================================================================

export interface ExecutionContext {
  /** Session information */
  session: {
    /** Current workspace ID */
    workspaceId: string;
    /** Project root path (if available) */
    projectRoot?: string;
    /** Client type (e.g., 'claude-code', 'cursor') */
    clientType?: string;
  };
  /** Request metadata */
  request: {
    /** Request timestamp */
    timestamp: number;
    /** Unique request ID */
    requestId: string;
  };
  /** Input parameters passed to the tool */
  params: Record<string, unknown>;
  /** Utility functions */
  utils: {
    /** Fetch function for HTTP requests */
    fetch: typeof fetch;
    /** Log function for debugging */
    log: (message: string) => void;
    /**
     * Get a secret value by key name.
     * Secrets are resolved from the workspace's secret store.
     * Returns undefined if secret doesn't exist.
     */
    getSecret: (keyName: string) => string | undefined;
  };
}

/**
 * Available context variables for placeholders:
 *
 * Input Parameters:
 * - {{paramName}} - Any parameter defined in inputSchema
 *
 * Session Context:
 * - {{SESSION.workspaceId}} - Current workspace ID
 * - {{SESSION.projectRoot}} - Project root path
 * - {{SESSION.clientType}} - Client type
 *
 * Request Context:
 * - {{REQUEST.timestamp}} - Request timestamp (Unix ms)
 * - {{REQUEST.requestId}} - Unique request ID
 *
 * Secrets (secure, server-side only):
 * - {{SECRET_KEY_NAME}} - Secret value from workspace secrets
 *   Secrets are identified by their SECRET_ prefix.
 *
 * Example URL: https://api.example.com/v1/data?key={{SECRET_API_KEY}}&city={{city}}
 * Example Header: Authorization: Bearer {{SECRET_AUTH_TOKEN}}
 */
export const PLACEHOLDER_DOCS = {
  params: 'Input parameters from tool call (e.g., {{city}}, {{query}})',
  session: {
    workspaceId: '{{SESSION.workspaceId}} - Current workspace ID',
    projectRoot: '{{SESSION.projectRoot}} - Project root path',
    clientType: '{{SESSION.clientType}} - Client type (claude-code, cursor, etc.)',
  },
  request: {
    timestamp: '{{REQUEST.timestamp}} - Request timestamp (Unix ms)',
    requestId: '{{REQUEST.requestId}} - Unique request ID',
  },
  secrets: '{{SECRET_KEY_NAME}} - Secret with SECRET_ prefix (e.g., {{SECRET_API_KEY}})',
};

// ============================================================================
// Store Types
// ============================================================================

export interface McpToolsConfig {
  enabled: boolean;
  tools: DynamicTool[];
  prompts: DynamicPrompt[];
  resources: DynamicResource[];
}

// ============================================================================
// Validation Types
// ============================================================================

export interface ValidationResult {
  valid: boolean;
  error?: string;
  warnings?: string[];
}

// Reserved parameter names that cannot be used in inputSchema
export const RESERVED_PARAM_NAMES = [
  '_context',
  '_request',
  '_internal',
  '_meta',
] as const;

// ============================================================================
// API Types
// ============================================================================

export interface McpToolsStatus {
  enabled: boolean;
  toolsCount: number;
  promptsCount: number;
  resourcesCount: number;
  enabledToolsCount: number;
  enabledPromptsCount: number;
  enabledResourcesCount: number;
}

export interface CreateToolRequest {
  name: string;
  description: string;
  inputSchema: JsonSchema;
  executor: ToolExecutor;
  enabled?: boolean;
}

export interface UpdateToolRequest {
  name?: string;
  description?: string;
  inputSchema?: JsonSchema;
  executor?: ToolExecutor;
  enabled?: boolean;
}

export interface CreatePromptRequest {
  name: string;
  description: string;
  arguments?: PromptArgument[];
  template: string;
  enabled?: boolean;
}

export interface UpdatePromptRequest {
  name?: string;
  description?: string;
  arguments?: PromptArgument[];
  template?: string;
  enabled?: boolean;
}

export interface CreateResourceRequest {
  name: string;
  description: string;
  uri: string;
  mimeType?: string;
  executor: ResourceExecutor;
  enabled?: boolean;
}

export interface UpdateResourceRequest {
  name?: string;
  description?: string;
  uri?: string;
  mimeType?: string;
  executor?: ResourceExecutor;
  enabled?: boolean;
}

// ============================================================================
// Event Types
// ============================================================================

export type McpToolsEventType =
  | 'mcp-tools-enabled'
  | 'mcp-tools-disabled'
  | 'mcp-tools-tool-created'
  | 'mcp-tools-tool-updated'
  | 'mcp-tools-tool-deleted'
  | 'mcp-tools-prompt-created'
  | 'mcp-tools-prompt-updated'
  | 'mcp-tools-prompt-deleted'
  | 'mcp-tools-resource-created'
  | 'mcp-tools-resource-updated'
  | 'mcp-tools-resource-deleted';

export interface McpToolsEvent {
  type: McpToolsEventType;
  timestamp: number;
  data?: {
    entityId?: string;
    entityName?: string;
    entityType?: EntityType;
  };
}

// ============================================================================
// Export/Import Types
// ============================================================================

export interface ExportData {
  version: 1;
  exportedAt: number;
  tools?: DynamicTool[];
  prompts?: DynamicPrompt[];
  resources?: DynamicResource[];
}

export interface ImportOptions {
  /** How to handle conflicts with existing items */
  conflictStrategy: 'skip' | 'replace' | 'rename';
  /** Import tools */
  importTools?: boolean;
  /** Import prompts */
  importPrompts?: boolean;
  /** Import resources */
  importResources?: boolean;
}

export interface ImportResult {
  success: boolean;
  imported: {
    tools: number;
    prompts: number;
    resources: number;
  };
  skipped: {
    tools: string[];
    prompts: string[];
    resources: string[];
  };
  errors: string[];
}
