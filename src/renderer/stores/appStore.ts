/**
 * App Store - Global application state
 */

import { create } from 'zustand';
import type {
  ServerInfo,
  WorkspaceConfig,
  UserProfile,
  ServerEvent,
  AppEvent,
} from '../../shared/types';

const API_BASE = 'http://127.0.0.1:4040/api';
const WS_URL = 'ws://127.0.0.1:4040/events';

// WebSocket reconnection state (module-level to persist across store updates)
let wsReconnectAttempts = 0;
let wsReconnectTimeout: ReturnType<typeof setTimeout> | null = null;
const WS_MAX_RECONNECT_DELAY = 30000; // Max 30 seconds between attempts
const WS_BASE_RECONNECT_DELAY = 1000; // Start with 1 second

// Debounce helper
function debounce<T extends (...args: unknown[]) => unknown>(
  fn: T,
  delay: number
): (...args: Parameters<T>) => void {
  let timeoutId: ReturnType<typeof setTimeout> | null = null;
  return (...args: Parameters<T>) => {
    if (timeoutId) clearTimeout(timeoutId);
    timeoutId = setTimeout(() => fn(...args), delay);
  };
}

// Workspace server config (enabled state per workspace)
interface WorkspaceServerConfig {
  enabled: boolean;
}

interface AppState {
  // Data
  servers: ServerInfo[];
  workspaces: WorkspaceConfig[];
  profile: UserProfile | null;
  workspaceServerConfigs: Record<string, Record<string, WorkspaceServerConfig>>; // workspaceId -> serverId -> config

  // UI state
  selectedWorkspaceId: string;
  selectedTab: 'servers' | 'secrets';
  isLoading: boolean;
  error: string | null;

  // WebSocket
  ws: WebSocket | null;
  isConnected: boolean;

  // Actions
  initialize: () => Promise<void>;
  connectWebSocket: () => void;
  handleEvent: (event: ServerEvent | AppEvent) => void;
  fetchServers: () => Promise<void>;
  fetchWorkspaces: () => Promise<void>;
  fetchProfile: () => Promise<void>;
  fetchWorkspaceServerConfigs: (workspaceId: string) => Promise<void>;

  setSelectedWorkspace: (id: string) => void;
  setSelectedTab: (tab: 'servers' | 'secrets') => void;

  // Server actions
  addServer: (data: { installType: string; packageName?: string; packageVersion?: string; localPath?: string }) => Promise<void>;
  startServer: (serverId: string) => Promise<void>;
  stopServer: (serverId: string) => Promise<void>;
  restartServer: (serverId: string) => Promise<void>;
  restartAllServers: () => Promise<{ restarted: number; failed: number }>;
  deleteServer: (serverId: string) => Promise<void>;
  checkServerUpdate: (serverId: string) => Promise<{ hasUpdate: boolean; latestVersion: string | null }>;
  updateServer: (serverId: string, version?: string) => Promise<{ success: boolean; newVersion?: string }>;
  checkAllServerUpdates: () => Promise<void>;
  refreshServerMetadata: (serverId: string) => Promise<void>;

  // Workspace actions
  createWorkspace: (label: string, projectRoot: string) => Promise<void>;
  updateWorkspace: (id: string, label: string, projectRoot?: string) => Promise<void>;
  deleteWorkspace: (id: string) => Promise<void>;
  resetWorkspace: (id: string) => Promise<void>;
  resetWorkspaceSecrets: (workspaceId: string) => Promise<void>;
  setServerEnabledForWorkspace: (workspaceId: string, serverId: string, enabled: boolean) => Promise<void>;
  isServerEnabledForWorkspace: (workspaceId: string, serverId: string) => boolean;

  // Auth actions
  login: (fullName: string, email: string) => Promise<void>;
  logout: () => Promise<void>;
}

export const useAppStore = create<AppState>((set, get) => ({
  // Initial state
  servers: [],
  workspaces: [],
  profile: null,
  workspaceServerConfigs: {},
  selectedWorkspaceId: 'global',
  selectedTab: 'servers',
  isLoading: false,
  error: null,
  ws: null,
  isConnected: false,

  // Initialize app
  initialize: async () => {
    set({ isLoading: true, error: null });

    try {
      // Fetch initial data
      await Promise.all([
        get().fetchServers(),
        get().fetchWorkspaces(),
        get().fetchProfile(),
      ]);

      // Connect WebSocket
      get().connectWebSocket();

      set({ isLoading: false });

      // Check for updates in background (don't block initialization)
      get().checkAllServerUpdates().catch((err) => {
        console.error('Failed to check server updates:', err);
      });
    } catch (error) {
      set({
        isLoading: false,
        error: error instanceof Error ? error.message : 'Failed to initialize',
      });
    }
  },

  // Connect WebSocket for real-time updates
  connectWebSocket: () => {
    // Clear any pending reconnect timeout
    if (wsReconnectTimeout) {
      clearTimeout(wsReconnectTimeout);
      wsReconnectTimeout = null;
    }

    // Don't connect if already have an active connection
    const currentWs = get().ws;
    if (currentWs && currentWs.readyState === WebSocket.CONNECTING) {
      return;
    }

    const ws = new WebSocket(WS_URL);

    ws.onopen = () => {
      console.log('WebSocket connected');
      wsReconnectAttempts = 0; // Reset on successful connection
      set({ isConnected: true });
    };

    ws.onclose = () => {
      console.log('WebSocket disconnected');
      set({ isConnected: false, ws: null });

      // Schedule reconnect with exponential backoff
      if (!wsReconnectTimeout) {
        const delay = Math.min(
          WS_BASE_RECONNECT_DELAY * Math.pow(2, wsReconnectAttempts),
          WS_MAX_RECONNECT_DELAY
        );
        wsReconnectAttempts++;
        console.log(`WebSocket reconnecting in ${delay}ms (attempt ${wsReconnectAttempts})`);

        wsReconnectTimeout = setTimeout(() => {
          wsReconnectTimeout = null;
          get().connectWebSocket();
        }, delay);
      }
    };

    ws.onmessage = (event) => {
      try {
        const message = JSON.parse(event.data);
        get().handleEvent(message);
      } catch (error) {
        console.error('Failed to parse WebSocket message:', error);
      }
    };

    ws.onerror = () => {
      // Error is logged by onclose, just silently handle here
      // The onclose handler will take care of reconnection
    };

    set({ ws });
  },

  // Handle WebSocket events
  handleEvent: (() => {
    // Create debounced fetch functions to avoid flooding with requests
    const debouncedFetchServers = debounce(() => {
      // Get fresh reference to fetchServers
      useAppStore.getState().fetchServers();
    }, 300);

    const debouncedFetchWorkspaces = debounce(() => {
      useAppStore.getState().fetchWorkspaces();
    }, 300);

    const debouncedFetchWorkspaceServerConfigs = debounce(() => {
      const state = useAppStore.getState();
      const workspaceId = state.selectedWorkspaceId;
      if (workspaceId && workspaceId !== 'global') {
        state.fetchWorkspaceServerConfigs(workspaceId);
      }
    }, 300);

    return (event: ServerEvent | AppEvent) => {
      console.log('Event received:', event);

      // Refresh data based on event type (debounced to prevent flooding)
      if ('serverId' in event) {
        // Server event - use debounced fetch
        debouncedFetchServers();
      } else if (event.type === 'workspace-created' || event.type === 'workspace-updated' || event.type === 'workspace-deleted') {
        debouncedFetchWorkspaces();
        // Also refresh servers and workspace server configs since enabled/disabled may have changed
        debouncedFetchServers();
        debouncedFetchWorkspaceServerConfigs();
      } else if (event.type === 'profile-updated') {
        get().fetchProfile();
      }
    };
  })(),

  // Fetch servers (with status filtered by selected workspace)
  fetchServers: async () => {
    try {
      const workspaceId = get().selectedWorkspaceId;
      const url = workspaceId && workspaceId !== 'global'
        ? `${API_BASE}/servers?workspaceId=${encodeURIComponent(workspaceId)}`
        : `${API_BASE}/servers`;

      console.log(`[AppStore] fetchServers: workspaceId=${workspaceId}, url=${url}`);

      const response = await fetch(url);
      const data = await response.json();

      if (data.success) {
        console.log(`[AppStore] fetchServers: got ${data.servers.length} servers, statuses:`,
          data.servers.map((s: ServerInfo) => `${s.displayName}=${s.status}`));
        set({ servers: data.servers });

        // Update tray with running servers count
        const runningCount = (data.servers as ServerInfo[]).filter(
          (s) => s.status === 'running'
        ).length;
        window.electronAPI?.updateServersCount(runningCount);
      }
    } catch (error) {
      console.error('Failed to fetch servers:', error);
    }
  },

  // Fetch workspaces
  fetchWorkspaces: async () => {
    try {
      const response = await fetch(`${API_BASE}/workspaces`);
      const data = await response.json();

      if (data.success) {
        set({ workspaces: data.workspaces });
      }
    } catch (error) {
      console.error('Failed to fetch workspaces:', error);
    }
  },

  // Fetch profile
  fetchProfile: async () => {
    try {
      const response = await fetch(`${API_BASE}/auth/profile`);
      const data = await response.json();

      if (data.success) {
        set({ profile: data.profile });
      }
    } catch (error) {
      console.error('Failed to fetch profile:', error);
    }
  },

  // Fetch workspace server configs
  fetchWorkspaceServerConfigs: async (workspaceId: string) => {
    if (workspaceId === 'global') return;

    try {
      const response = await fetch(`${API_BASE}/workspaces/${workspaceId}/servers`);
      const data = await response.json();

      if (data.success) {
        set((state) => ({
          workspaceServerConfigs: {
            ...state.workspaceServerConfigs,
            [workspaceId]: data.servers || {},
          },
        }));
      }
    } catch (error) {
      console.error('Failed to fetch workspace server configs:', error);
    }
  },

  // Select workspace
  setSelectedWorkspace: (id: string) => {
    set({ selectedWorkspaceId: id });
    // Fetch server configs for non-global workspace
    if (id !== 'global') {
      get().fetchWorkspaceServerConfigs(id);
    }
    // Refresh servers to show correct status for selected workspace
    get().fetchServers();
  },

  // Select tab
  setSelectedTab: (tab: 'servers' | 'secrets') => {
    set({ selectedTab: tab });
  },

  // Add server
  addServer: async (data: { installType: string; packageName?: string; packageVersion?: string; localPath?: string }) => {
    try {
      const response = await fetch(`${API_BASE}/servers`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });

      const result = await response.json();
      if (!result.success) {
        throw new Error(result.error);
      }

      await get().fetchServers();
    } catch (error) {
      console.error('Failed to add server:', error);
      throw error;
    }
  },

  // Start server
  startServer: async (serverId: string) => {
    try {
      const response = await fetch(`${API_BASE}/instances/start`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          serverId,
          workspaceId: get().selectedWorkspaceId,
        }),
      });

      const data = await response.json();
      if (!data.success) {
        throw new Error(data.error);
      }

      await get().fetchServers();
    } catch (error) {
      console.error('Failed to start server:', error);
      throw error;
    }
  },

  // Stop server
  stopServer: async (serverId: string) => {
    try {
      const response = await fetch(`${API_BASE}/instances/stop`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          serverId,
          workspaceId: get().selectedWorkspaceId,
        }),
      });

      const data = await response.json();
      if (!data.success) {
        throw new Error(data.error);
      }

      await get().fetchServers();
    } catch (error) {
      console.error('Failed to stop server:', error);
      throw error;
    }
  },

  // Restart server
  restartServer: async (serverId: string) => {
    try {
      const response = await fetch(`${API_BASE}/instances/restart`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          serverId,
          workspaceId: get().selectedWorkspaceId,
        }),
      });

      const data = await response.json();
      if (!data.success) {
        throw new Error(data.error);
      }

      await get().fetchServers();
    } catch (error) {
      console.error('Failed to restart server:', error);
      throw error;
    }
  },

  // Restart all running servers (useful after changing global secrets)
  restartAllServers: async () => {
    try {
      const response = await fetch(`${API_BASE}/instances/restart-all`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      });

      const data = await response.json();
      if (!data.success) {
        throw new Error(data.error);
      }

      await get().fetchServers();
      return { restarted: data.restarted, failed: data.failed };
    } catch (error) {
      console.error('Failed to restart all servers:', error);
      throw error;
    }
  },

  // Delete server
  deleteServer: async (serverId: string) => {
    try {
      const response = await fetch(`${API_BASE}/servers/${serverId}`, {
        method: 'DELETE',
      });

      const data = await response.json();
      if (!data.success) {
        throw new Error(data.error);
      }

      await get().fetchServers();
    } catch (error) {
      console.error('Failed to delete server:', error);
      throw error;
    }
  },

  // Check for server update
  checkServerUpdate: async (serverId: string) => {
    try {
      const response = await fetch(`${API_BASE}/servers/${serverId}/check-update`);
      const data = await response.json();

      if (!data.success) {
        return { hasUpdate: false, latestVersion: null };
      }

      // Update server in local state with update info
      if (data.hasUpdate) {
        set((state) => ({
          servers: state.servers.map((s) =>
            s.id === serverId
              ? { ...s, hasUpdate: data.hasUpdate, latestVersion: data.latestVersion }
              : s
          ),
        }));
      }

      return { hasUpdate: data.hasUpdate, latestVersion: data.latestVersion };
    } catch (error) {
      console.error('Failed to check server update:', error);
      return { hasUpdate: false, latestVersion: null };
    }
  },

  // Update server to new version
  updateServer: async (serverId: string, version?: string) => {
    try {
      const response = await fetch(`${API_BASE}/servers/${serverId}/update`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ version }),
      });

      const data = await response.json();
      if (!data.success) {
        throw new Error(data.error);
      }

      // Refresh servers to get updated info
      await get().fetchServers();

      return { success: true, newVersion: data.newVersion };
    } catch (error) {
      console.error('Failed to update server:', error);
      throw error;
    }
  },

  // Check updates for all servers with fixed versions
  checkAllServerUpdates: async () => {
    const { servers } = get();

    // Only check servers with fixed versions (not 'latest' or local)
    const serversToCheck = servers.filter(
      (s) => s.installType !== 'local' && s.packageVersion && s.packageVersion !== 'latest'
    );

    // Check updates in parallel but don't block
    await Promise.allSettled(
      serversToCheck.map((s) => get().checkServerUpdate(s.id))
    );
  },

  // Refresh server metadata (re-read package.json or npm registry)
  refreshServerMetadata: async (serverId: string) => {
    try {
      const response = await fetch(`${API_BASE}/servers/${serverId}/refresh-metadata`, {
        method: 'POST',
      });

      const data = await response.json();
      if (!data.success) {
        throw new Error(data.error);
      }

      // Refresh servers to get updated info
      await get().fetchServers();
    } catch (error) {
      console.error('Failed to refresh server metadata:', error);
      throw error;
    }
  },

  // Create workspace
  createWorkspace: async (label: string, projectRoot: string) => {
    try {
      const response = await fetch(`${API_BASE}/workspaces`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ label, projectRoot, source: 'manual' }),
      });

      const data = await response.json();
      if (!data.success) {
        throw new Error(data.error);
      }

      await get().fetchWorkspaces();

      // Auto-select the newly created workspace
      if (data.workspace?.id) {
        set({ selectedWorkspaceId: data.workspace.id });
      }
    } catch (error) {
      console.error('Failed to create workspace:', error);
      throw error;
    }
  },

  // Update workspace
  updateWorkspace: async (id: string, label: string, projectRoot?: string) => {
    try {
      const body: { label: string; projectRoot?: string } = { label };
      if (projectRoot !== undefined) {
        body.projectRoot = projectRoot;
      }
      const response = await fetch(`${API_BASE}/workspaces/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });

      const data = await response.json();
      if (!data.success) {
        throw new Error(data.error);
      }

      await get().fetchWorkspaces();
    } catch (error) {
      console.error('Failed to update workspace:', error);
      throw error;
    }
  },

  // Delete workspace
  deleteWorkspace: async (id: string) => {
    try {
      const response = await fetch(`${API_BASE}/workspaces/${id}`, {
        method: 'DELETE',
      });

      const data = await response.json();
      if (!data.success) {
        throw new Error(data.error);
      }

      // Switch to global if deleted workspace was selected
      if (get().selectedWorkspaceId === id) {
        set({ selectedWorkspaceId: 'global' });
      }

      await get().fetchWorkspaces();
    } catch (error) {
      console.error('Failed to delete workspace:', error);
      throw error;
    }
  },

  // Reset workspace to Global defaults (clear all server config overrides)
  resetWorkspace: async (id: string) => {
    try {
      const response = await fetch(`${API_BASE}/workspaces/${id}/reset`, {
        method: 'POST',
      });

      const data = await response.json();
      if (!data.success) {
        throw new Error(data.error);
      }

      // Clear local cache of workspace server configs
      set((state) => {
        const newConfigs = { ...state.workspaceServerConfigs };
        delete newConfigs[id];
        return { workspaceServerConfigs: newConfigs };
      });

      // Refresh workspace data
      await get().fetchWorkspaceServerConfigs(id);
    } catch (error) {
      console.error('Failed to reset workspace:', error);
      throw error;
    }
  },

  // Reset workspace secrets (delete all workspace-specific secrets)
  resetWorkspaceSecrets: async (workspaceId: string) => {
    try {
      // Get all workspace secrets and delete them
      const secrets = await window.electronAPI?.getSecrets('__app__', 'workspace', workspaceId);
      if (secrets) {
        for (const key of Object.keys(secrets)) {
          await window.electronAPI?.deleteSecret('__app__', key, 'workspace', workspaceId);
        }
      }
    } catch (error) {
      console.error('Failed to reset workspace secrets:', error);
      throw error;
    }
  },

  // Set server enabled/disabled for workspace
  setServerEnabledForWorkspace: async (workspaceId: string, serverId: string, enabled: boolean) => {
    try {
      const response = await fetch(`${API_BASE}/workspaces/${workspaceId}/servers/${serverId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ enabled }),
      });

      const data = await response.json();
      if (!data.success) {
        throw new Error(data.error);
      }

      // Update local state
      set((state) => ({
        workspaceServerConfigs: {
          ...state.workspaceServerConfigs,
          [workspaceId]: {
            ...(state.workspaceServerConfigs[workspaceId] || {}),
            [serverId]: { enabled },
          },
        },
      }));
    } catch (error) {
      console.error('Failed to set server enabled for workspace:', error);
      throw error;
    }
  },

  // Check if server is enabled for workspace (defaults to true if no config)
  isServerEnabledForWorkspace: (workspaceId: string, serverId: string): boolean => {
    if (workspaceId === 'global') return true;
    const config = get().workspaceServerConfigs[workspaceId]?.[serverId];
    // Default to true (enabled) if no explicit config
    return config?.enabled !== false;
  },

  // Login
  login: async (fullName: string, email: string) => {
    try {
      const response = await fetch(`${API_BASE}/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ fullName, email }),
      });

      const data = await response.json();
      if (!data.success) {
        throw new Error(data.error);
      }

      set({ profile: data.profile });
    } catch (error) {
      console.error('Failed to login:', error);
      throw error;
    }
  },

  // Logout
  logout: async () => {
    try {
      await fetch(`${API_BASE}/auth/logout`, { method: 'POST' });
      set({ profile: null });
    } catch (error) {
      console.error('Failed to logout:', error);
    }
  },
}));
