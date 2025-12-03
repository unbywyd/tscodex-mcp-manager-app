/**
 * Shared types between main process, host, and renderer
 */

// ============================================================================
// Installation Types
// ============================================================================

/**
 * Package runner type for MCP servers
 */
export type InstallType = 'npx' | 'pnpx' | 'yarn' | 'bunx' | 'local';

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
  secretKeys?: string[];
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
  | 'profile-updated';

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
