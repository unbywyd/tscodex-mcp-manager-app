/**
 * Preload script - exposes safe APIs to renderer
 */

import { contextBridge, ipcRenderer } from 'electron';

// Expose protected methods to renderer
contextBridge.exposeInMainWorld('electronAPI', {
  // Window controls
  minimize: () => ipcRenderer.send('app:minimize'),
  maximize: () => ipcRenderer.send('app:maximize'),
  close: () => ipcRenderer.send('app:close'),
  quit: () => ipcRenderer.send('app:quit'),
  isMaximized: () => ipcRenderer.invoke('app:is-maximized'),
  onMaximized: (callback: () => void) => {
    ipcRenderer.on('window:maximized', callback);
    return () => ipcRenderer.removeListener('window:maximized', callback);
  },
  onUnmaximized: (callback: () => void) => {
    ipcRenderer.on('window:unmaximized', callback);
    return () => ipcRenderer.removeListener('window:unmaximized', callback);
  },

  // Tray status
  updateServersCount: (count: number) => ipcRenderer.send('app:update-servers-count', count),

  // Host status
  getHostStatus: () => ipcRenderer.invoke('host:get-status'),
  getHostPort: () => ipcRenderer.invoke('host:get-port'),

  // Secrets (secure access)
  // scope: 'global' | 'workspace'
  // workspaceId is optional, required for 'workspace' scope
  getSecrets: (serverId: string, scope: string, workspaceId?: string) =>
    ipcRenderer.invoke('secrets:get', serverId, scope, workspaceId),
  setSecret: (serverId: string, key: string, value: string, scope: string, workspaceId?: string) =>
    ipcRenderer.invoke('secrets:set', serverId, key, value, scope, workspaceId),
  deleteSecret: (serverId: string, key: string, scope: string, workspaceId?: string) =>
    ipcRenderer.invoke('secrets:delete', serverId, key, scope, workspaceId),

  // File dialogs
  selectFile: (options?: { filters?: Array<{ name: string; extensions: string[] }> }) =>
    ipcRenderer.invoke('dialog:select-file', options),
  selectDirectory: () =>
    ipcRenderer.invoke('dialog:select-directory'),

  // AI Assistant
  getAIConfig: () =>
    ipcRenderer.invoke('ai:get-config'),
  setAISecret: (key: string, value: string) =>
    ipcRenderer.invoke('ai:set-secret', key, value),
  deleteAISecret: (key: string) =>
    ipcRenderer.invoke('ai:delete-secret', key),
  getAIStatus: () =>
    ipcRenderer.invoke('ai:get-status'),
  reinitializeAI: () =>
    ipcRenderer.invoke('ai:reinitialize'),

  // Platform info
  platform: process.platform,
});

// Type definitions for renderer
declare global {
  interface Window {
    electronAPI: {
      minimize: () => void;
      maximize: () => void;
      close: () => void;
      quit: () => void;
      isMaximized: () => Promise<boolean>;
      onMaximized: (callback: () => void) => () => void;
      onUnmaximized: (callback: () => void) => () => void;
      updateServersCount: (count: number) => void;
      getHostStatus: () => Promise<{ running: boolean; port: number }>;
      getHostPort: () => Promise<number>;
      getSecrets: (serverId: string, scope: string, workspaceId?: string) => Promise<Record<string, string>>;
      setSecret: (serverId: string, key: string, value: string, scope: string, workspaceId?: string) => Promise<void>;
      deleteSecret: (serverId: string, key: string, scope: string, workspaceId?: string) => Promise<void>;
      selectFile: (options?: { filters?: Array<{ name: string; extensions: string[] }> }) => Promise<string | null>;
      selectDirectory: () => Promise<string | null>;
      // AI Assistant
      getAIConfig: () => Promise<{ baseUrl: string | null; defaultModel: string | null; hasApiKey: boolean }>;
      setAISecret: (key: string, value: string) => Promise<void>;
      deleteAISecret: (key: string) => Promise<boolean>;
      getAIStatus: () => Promise<boolean>;
      reinitializeAI: () => Promise<boolean>;
      platform: NodeJS.Platform;
    };
  }
}
