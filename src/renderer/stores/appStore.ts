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

interface AppState {
  // Data
  servers: ServerInfo[];
  workspaces: WorkspaceConfig[];
  profile: UserProfile | null;

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

  setSelectedWorkspace: (id: string) => void;
  setSelectedTab: (tab: 'servers' | 'secrets') => void;

  // Server actions
  addServer: (data: { installType: string; packageName?: string; packageVersion?: string; localPath?: string }) => Promise<void>;
  startServer: (serverId: string) => Promise<void>;
  stopServer: (serverId: string) => Promise<void>;
  restartServer: (serverId: string) => Promise<void>;
  deleteServer: (serverId: string) => Promise<void>;

  // Workspace actions
  createWorkspace: (label: string, projectRoot: string) => Promise<void>;
  deleteWorkspace: (id: string) => Promise<void>;

  // Auth actions
  login: (fullName: string, email: string) => Promise<void>;
  logout: () => Promise<void>;
}

export const useAppStore = create<AppState>((set, get) => ({
  // Initial state
  servers: [],
  workspaces: [],
  profile: null,
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
    } catch (error) {
      set({
        isLoading: false,
        error: error instanceof Error ? error.message : 'Failed to initialize',
      });
    }
  },

  // Connect WebSocket for real-time updates
  connectWebSocket: () => {
    const ws = new WebSocket(WS_URL);

    ws.onopen = () => {
      console.log('WebSocket connected');
      set({ isConnected: true });
    };

    ws.onclose = () => {
      console.log('WebSocket disconnected');
      set({ isConnected: false, ws: null });

      // Reconnect after 5 seconds
      setTimeout(() => {
        if (!get().ws) {
          get().connectWebSocket();
        }
      }, 5000);
    };

    ws.onmessage = (event) => {
      try {
        const message = JSON.parse(event.data);
        get().handleEvent(message);
      } catch (error) {
        console.error('Failed to parse WebSocket message:', error);
      }
    };

    ws.onerror = (error) => {
      console.error('WebSocket error:', error);
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

    return (event: ServerEvent | AppEvent) => {
      console.log('Event received:', event);

      // Refresh data based on event type (debounced to prevent flooding)
      if ('serverId' in event) {
        // Server event - use debounced fetch
        debouncedFetchServers();
      } else if (event.type === 'workspace-created' || event.type === 'workspace-updated' || event.type === 'workspace-deleted') {
        debouncedFetchWorkspaces();
      } else if (event.type === 'profile-updated') {
        get().fetchProfile();
      }
    };
  })(),

  // Fetch servers
  fetchServers: async () => {
    try {
      const response = await fetch(`${API_BASE}/servers`);
      const data = await response.json();

      if (data.success) {
        set({ servers: data.servers });
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

  // Select workspace
  setSelectedWorkspace: (id: string) => {
    set({ selectedWorkspaceId: id });
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
    } catch (error) {
      console.error('Failed to create workspace:', error);
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
