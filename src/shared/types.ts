/**
 * Shared types between main process, host, and renderer
 */

// ============================================================================
// Installation Types
// ============================================================================

/**
 * Package runner type for MCP servers
 * - 'npm': Installed via npm to local app directory (recommended, fast startup)
 * - 'npx', 'pnpx', 'yarn', 'bunx': Run via package runner (slower, checks registry)
 * - 'local': Local development path
 */
export type InstallType = 'npm' | 'npx' | 'pnpx' | 'yarn' | 'bunx' | 'local';

/**
 * Package manager info
 */
export interface PackageManagerInfo {
  name: 'npm' | 'pnpm' | 'yarn' | 'bun';
  runnerCommand: string;
  available: boolean;
  version?: string;
}

// ============================================================================
// Server Permissions Types
// ============================================================================

/**
 * Controls which system environment variables are passed to the server
 */
export interface EnvPermissions {
  /** Allow PATH, PATHEXT */
  allowPath: boolean;
  /** Allow HOME, USERPROFILE, HOMEPATH */
  allowHome: boolean;
  /** Allow LANG, LANGUAGE, LC_* */
  allowLang: boolean;
  /** Allow TEMP, TMP, TMPDIR */
  allowTemp: boolean;
  /** Allow NODE_*, npm_* */
  allowNode: boolean;
  /** Custom allowlist for specific variable names */
  customAllowlist: string[];
}

/**
 * Controls what workspace/session context data is exposed
 */
export interface ContextPermissions {
  /** Allow MCP_PROJECT_ROOT */
  allowProjectRoot: boolean;
  /** Allow MCP_WORKSPACE_ID */
  allowWorkspaceId: boolean;
  /** Allow user profile (email/name) in MCP_AUTH_TOKEN */
  allowUserProfile: boolean;
}

/**
 * Controls which secrets from the Secret Store can be passed
 */
export interface SecretsPermissions {
  /** Mode: 'none' = no secrets, 'allowlist' = only listed, 'all' = all available */
  mode: 'none' | 'allowlist' | 'all';
  /** When mode is 'allowlist', only these keys are passed */
  allowlist: string[];
}

/**
 * Complete server permissions configuration
 */
export interface ServerPermissions {
  env: EnvPermissions;
  context: ContextPermissions;
  secrets: SecretsPermissions;
}

// ============================================================================
// Server Types
// ============================================================================

export type ServerStatus = 'starting' | 'running' | 'stopped' | 'error';

export interface ServerTemplate {
  id: string;
  installType: InstallType;
  packageName?: string;
  localPath?: string;
  packageVersion?: string;

  displayName: string;
  description?: string;
  version?: string;

  entryPoint?: string;

  configSchema?: Record<string, unknown>;
  defaultConfig: Record<string, unknown>;

  // Cached metadata from --meta or verification
  toolsCount?: number;
  resourcesCount?: number;
  promptsCount?: number;

  globalSecretKeys?: string[];

  packageInfo?: {
    homepage?: string;
    repository?: string;
    readme?: string;
    author?: string | { name?: string; email?: string; url?: string };
  };

  /** Global permissions for this server (applies to all workspaces) */
  permissions?: ServerPermissions;

  /**
   * Custom context headers that server accepts per-request.
   * Declared by SDK via contextHeaders option in getMetadata().
   */
  contextHeaders?: string[];

  createdAt: number;
  updatedAt: number;
}

export interface ServerInstance {
  serverId: string;
  workspaceId: string;
  status: ServerStatus;
  pid?: number;
  port?: number;
  lastError?: string;

  restartAttempts: number;
  firstStartAt: number;

  toolsCount?: number;
  resourcesCount?: number;
  promptsCount?: number;
  authStatus?: 'authorized' | 'unauthorized' | 'unknown';
}

export interface ServerInfo extends ServerTemplate {
  status: ServerStatus;
  port?: number;
  toolsCount?: number;
  resourcesCount?: number;
  promptsCount?: number;
  authStatus?: 'authorized' | 'unauthorized' | 'unknown';
  // Update info (populated by check-update endpoint)
  latestVersion?: string;
  hasUpdate?: boolean;
  /**
   * Custom context headers that server accepts per-request.
   * Declared by SDK via contextHeaders option.
   * MCP Manager UI will show input fields for these in workspace settings.
   */
  contextHeaders?: string[];
}

// ============================================================================
// Workspace Types
// ============================================================================

export type WorkspaceSource = 'manual' | 'api';

export interface WorkspaceConfig {
  id: string;
  label: string;
  projectRoot: string;
  source: WorkspaceSource;
  sourceInstanceId?: string;
  /** Human-readable label for the source (e.g., "Cursor", "VS Code", "Claude Code") */
  sourceLabel?: string;

  createdAt: number;
  updatedAt: number;
}

export interface WorkspaceServerConfig {
  enabled: boolean;
  configOverride?: Record<string, unknown>;
  /** @deprecated Use permissionsOverride.secrets instead */
  secretKeys?: string[];
  /** Workspace-level permission overrides (inherits from and overrides global) */
  permissionsOverride?: Partial<ServerPermissions>;
  /**
   * Values for custom context headers (declared by server via contextHeaders).
   * Key is header name (e.g., 'project-id'), value is the string to send.
   * Passed via X-MCP-CTX-{header-name} headers with each request.
   */
  contextHeaders?: Record<string, string>;
}

// ============================================================================
// Session Types
// ============================================================================

export type ClientType = 'cursor' | 'vscode' | 'api';

export interface WorkspaceSession {
  sessionId: string;
  workspaceId: string;
  clientType: ClientType;
  clientInstanceId: string;
  projectRoot: string;
  lastSeenAt: number;
  mcpEndpoints: Record<string, string>;
}

// ============================================================================
// Auth Types
// ============================================================================

export interface UserProfile {
  fullName: string;
  email: string;
}

// ============================================================================
// API Types
// ============================================================================

export interface ApiResponse<T = unknown> {
  success: boolean;
  data?: T;
  error?: string;
}

export interface ConnectSessionRequest {
  projectRoot: string;
  clientType: ClientType;
  clientInstanceId: string;
}

export interface ConnectSessionResponse {
  sessionId: string;
  workspaceId: string;
  mcpServers: Record<string, string>;
}

export interface CreateServerRequest {
  installType: InstallType;
  packageName?: string;
  packageVersion?: string;
  localPath?: string;
}

export interface CreateWorkspaceRequest {
  label: string;
  projectRoot: string;
  source?: WorkspaceSource;
}

// ============================================================================
// Event Types
// ============================================================================

export type ServerEventType =
  | 'server-starting'
  | 'server-started'
  | 'server-stopped'
  | 'server-error'
  | 'server-log';

export interface ServerEvent {
  type: ServerEventType;
  serverId: string;
  workspaceId: string;
  timestamp: number;
  data?: {
    port?: number;
    error?: string;
    message?: string;
    level?: 'info' | 'warn' | 'error' | 'debug';
  };
}

export type AppEventType =
  | 'workspace-created'
  | 'workspace-updated'
  | 'workspace-deleted'
  | 'session-connected'
  | 'session-disconnected'
  | 'profile-updated'
  // MCP Tools events
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

export interface AppEvent {
  type: AppEventType;
  timestamp: number;
  data?: unknown;
}

// ============================================================================
// IPC Types (Electron)
// ============================================================================

export type IpcChannel =
  | 'app:minimize'
  | 'app:maximize'
  | 'app:close'
  | 'app:quit'
  | 'host:get-status'
  | 'host:get-port'
  | 'secrets:get'
  | 'secrets:set'
  | 'secrets:delete';

// ============================================================================
// Constants
// ============================================================================

export const DEFAULT_HOST_PORT = 4040;
export const DEFAULT_MCP_PATH = '/mcp';
export const HEALTH_CHECK_TIMEOUT = 2000;
export const HEALTH_CHECK_INTERVAL = 1000;
export const HEALTH_CHECK_MAX_ATTEMPTS = 30;
export const HEARTBEAT_INTERVAL = 30000;
export const SESSION_TIMEOUT = 60000;

export const GLOBAL_WORKSPACE_ID = 'global';

// ============================================================================
// Default Permissions
// ============================================================================

/**
 * Default permissions for new servers (secure by default)
 */
export const DEFAULT_SERVER_PERMISSIONS: ServerPermissions = {
  env: {
    allowPath: true,
    allowHome: false,
    allowLang: true,
    allowTemp: true,
    allowNode: true,
    customAllowlist: [],
  },
  context: {
    allowProjectRoot: true,
    allowWorkspaceId: true,
    allowUserProfile: true,
  },
  secrets: {
    mode: 'none',
    allowlist: [],
  },
};

/**
 * Legacy permissions for existing servers (backward compatible, permissive)
 * Used during migration to avoid breaking existing setups
 */
export const LEGACY_SERVER_PERMISSIONS: ServerPermissions = {
  env: {
    allowPath: true,
    allowHome: true,
    allowLang: true,
    allowTemp: true,
    allowNode: true,
    customAllowlist: ['*'], // Special: allow all (handled in ProcessManager)
  },
  context: {
    allowProjectRoot: true,
    allowWorkspaceId: true,
    allowUserProfile: true,
  },
  secrets: {
    mode: 'all',
    allowlist: [],
  },
};
