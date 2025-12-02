/**
 * Electron Main Process Entry Point
 */

import { app, BrowserWindow, Tray, Menu, nativeImage, ipcMain, dialog } from 'electron';
import path from 'path';
import { fileURLToPath } from 'url';
import { McpHost } from '../host';
import { DEFAULT_HOST_PORT } from '../shared/types';

// ESM compatibility - define __dirname for this module
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

let mainWindow: BrowserWindow | null = null;
let tray: Tray | null = null;
let mcpHost: McpHost | null = null;
let isQuitting = false;

const isDev = process.env.NODE_ENV === 'development' || !app.isPackaged;

// In dev mode, disable state persistence to ensure fresh start every time
if (isDev) {
  // Clear all user data on startup to prevent state persistence
  app.commandLine.appendSwitch('disable-features', 'VizDisplayCompositor');
  // Disable DevTools state persistence
  app.commandLine.appendSwitch('disable-dev-shm-usage');
}

/**
 * Create the main application window
 */
async function createWindow(): Promise<void> {
  // Window icon path
  const iconPath = isDev
    ? path.join(__dirname, '../../resources/icons/icon.png')
    : path.join(process.resourcesPath, 'icons/icon.png');

  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    minWidth: 900,
    minHeight: 600,
    show: false,
    frame: false, // Frameless for custom titlebar
    backgroundColor: '#0a0a0a',
    icon: iconPath,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: path.join(__dirname, 'preload.cjs'),  // CommonJS for Electron
      // Disable DevTools state persistence in dev mode
      devTools: isDev,
      // Clear partition to prevent state persistence
      partition: isDev ? 'temp' : undefined,
    },
  });

  // Load the app
  if (isDev) {
    // Clear ALL caches and storage before loading to ensure fresh content
    const session = mainWindow.webContents.session;
    
    // Clear all caches
    await session.clearCache();
    
    // Clear ALL storage data (localStorage, sessionStorage, IndexedDB, etc.)
    await session.clearStorageData({
      storages: [
        'cookies',
        'filesystem',
        'indexdb',
        'localstorage',
        'shadercache',
        'websql',
        'serviceworkers',
        'cachestorage',
      ],
    });

    // Disable cache headers
    session.webRequest.onBeforeSendHeaders((details, callback) => {
      callback({
        requestHeaders: {
          ...details.requestHeaders,
          'Cache-Control': 'no-cache, no-store, must-revalidate',
          'Pragma': 'no-cache',
          'Expires': '0',
        },
      });
    });

    // Block caching in responses
    session.webRequest.onHeadersReceived((details, callback) => {
      callback({
        responseHeaders: {
          ...details.responseHeaders,
          'Cache-Control': ['no-cache, no-store, must-revalidate'],
          'Pragma': ['no-cache'],
          'Expires': ['0'],
        },
      });
    });

    mainWindow.loadURL('http://localhost:5173');
    
    // Always open DevTools in dev mode (ignore saved state)
    mainWindow.webContents.once('did-finish-load', () => {
      if (mainWindow && !mainWindow.webContents.isDevToolsOpened()) {
        mainWindow.webContents.openDevTools();
      }
    });
  } else {
    // In production, load from the same directory structure
    // __dirname points to dist/main, renderer is in dist/renderer
    const rendererPath = path.join(__dirname, '../renderer/index.html');
    console.log('[Main] Loading renderer from:', rendererPath);
    mainWindow.loadFile(rendererPath);
  }

  // Show window when ready
  mainWindow.once('ready-to-show', () => {
    mainWindow?.show();
  });

  // Handle close - minimize to tray instead of quitting
  mainWindow.on('close', (event) => {
    if (!isQuitting) {
      event.preventDefault();
      mainWindow?.hide();
    }
  });

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

/**
 * Create system tray icon
 */
function createTray(): void {
  // Create tray icon
  const iconPath = isDev
    ? path.join(__dirname, '../../resources/icons/icon.png')
    : path.join(process.resourcesPath, 'icons/icon.png');

  // Create icon from file
  let icon: Electron.NativeImage;
  try {
    icon = nativeImage.createFromPath(iconPath);
    if (icon.isEmpty()) {
      throw new Error('Icon not found');
    }
    // Resize for tray (16x16 on Windows, 22x22 on macOS)
    const traySize = process.platform === 'darwin' ? 22 : 16;
    icon = icon.resize({ width: traySize, height: traySize });
  } catch {
    // Create a simple 16x16 icon as fallback
    icon = nativeImage.createEmpty();
  }

  tray = new Tray(icon);
  tray.setToolTip('MCP Manager');

  const contextMenu = Menu.buildFromTemplate([
    {
      label: 'Open MCP Manager',
      click: () => {
        if (mainWindow) {
          mainWindow.show();
          mainWindow.focus();
        } else {
          createWindow();
        }
      },
    },
    { type: 'separator' },
    {
      label: `Host: http://127.0.0.1:${DEFAULT_HOST_PORT}`,
      enabled: false,
    },
    { type: 'separator' },
    {
      label: 'Quit',
      click: () => {
        isQuitting = true;
        app.quit();
      },
    },
  ]);

  tray.setContextMenu(contextMenu);

  // Double-click to open window
  tray.on('double-click', () => {
    if (mainWindow) {
      mainWindow.show();
      mainWindow.focus();
    } else {
      createWindow();
    }
  });
}

/**
 * Setup IPC handlers for renderer communication
 */
function setupIpcHandlers(): void {
  // Window controls
  ipcMain.on('app:minimize', () => {
    mainWindow?.minimize();
  });

  ipcMain.on('app:maximize', () => {
    if (mainWindow?.isMaximized()) {
      mainWindow.unmaximize();
    } else {
      mainWindow?.maximize();
    }
  });

  ipcMain.on('app:close', () => {
    mainWindow?.hide();
  });

  ipcMain.on('app:quit', () => {
    isQuitting = true;
    app.quit();
  });

  // Host status
  ipcMain.handle('host:get-status', () => {
    return {
      running: mcpHost?.isRunning() ?? false,
      port: mcpHost?.getPort() ?? DEFAULT_HOST_PORT,
    };
  });

  ipcMain.handle('host:get-port', () => {
    return mcpHost?.getPort() ?? DEFAULT_HOST_PORT;
  });

  // Secrets (via keytar in host)
  ipcMain.handle('secrets:get', async (_event, serverId: string, scope: string, workspaceId?: string) => {
    return mcpHost?.getSecretStore().getSecrets(serverId, scope as 'global' | 'workspace', workspaceId);
  });

  ipcMain.handle('secrets:set', async (_event, serverId: string, key: string, value: string, scope: string, workspaceId?: string) => {
    return mcpHost?.getSecretStore().setSecret(serverId, key, value, scope as 'global' | 'workspace', workspaceId);
  });

  ipcMain.handle('secrets:delete', async (_event, serverId: string, key: string, scope: string, workspaceId?: string) => {
    return mcpHost?.getSecretStore().deleteSecret(serverId, key, scope as 'global' | 'workspace', workspaceId);
  });

  // File dialogs
  ipcMain.handle('dialog:select-file', async (_event, options?: { filters?: Array<{ name: string; extensions: string[] }> }) => {
    const result = await dialog.showOpenDialog(mainWindow!, {
      properties: ['openFile'],
      filters: options?.filters || [
        { name: 'All Files', extensions: ['*'] },
      ],
    });

    if (result.canceled || result.filePaths.length === 0) {
      return null;
    }
    return result.filePaths[0];
  });

  ipcMain.handle('dialog:select-directory', async () => {
    const result = await dialog.showOpenDialog(mainWindow!, {
      properties: ['openDirectory'],
    });

    if (result.canceled || result.filePaths.length === 0) {
      return null;
    }
    return result.filePaths[0];
  });
}

/**
 * Start the MCP Host server
 */
async function startHost(): Promise<void> {
  try {
    console.log('[Main] Creating McpHost...');
    mcpHost = new McpHost();
    console.log('[Main] Starting McpHost on port', DEFAULT_HOST_PORT);
    await mcpHost.start(DEFAULT_HOST_PORT);
    console.log(`[Main] MCP Host started on port ${DEFAULT_HOST_PORT}`);
  } catch (error) {
    console.error('[Main] Failed to start MCP Host:', error);
    throw error;
  }
}

/**
 * Stop the MCP Host server
 */
async function stopHost(): Promise<void> {
  if (mcpHost) {
    await mcpHost.stop();
    mcpHost = null;
  }
}

// ============================================================================
// App Lifecycle
// ============================================================================

// Prevent multiple instances
const gotTheLock = app.requestSingleInstanceLock();

if (!gotTheLock) {
  app.quit();
} else {
  app.on('second-instance', () => {
    // Focus the window if someone tries to open another instance
    if (mainWindow) {
      if (mainWindow.isMinimized()) mainWindow.restore();
      mainWindow.show();
      mainWindow.focus();
    }
  });

  app.whenReady().then(async () => {
    // In dev mode, clear all user data on startup to prevent state persistence
    if (isDev) {
      const userDataPath = app.getPath('userData');
      console.log('[Main] Dev mode: User data path:', userDataPath);
      // Note: We use partition: 'temp' in webPreferences to avoid state persistence
      // This ensures DevTools state and other settings don't persist between runs
    }

    // Start MCP Host first
    await startHost();

    // Setup IPC
    setupIpcHandlers();

    // Create window and tray
    await createWindow();
    createTray();

    app.on('activate', () => {
      if (BrowserWindow.getAllWindows().length === 0) {
        createWindow();
      } else {
        mainWindow?.show();
      }
    });
  });
}

app.on('window-all-closed', () => {
  // On macOS, keep app running in tray
  if (process.platform !== 'darwin') {
    // Don't quit - keep running in tray
  }
});

app.on('before-quit', (event) => {
  if (!isQuitting) {
    event.preventDefault();
    isQuitting = true;

    console.log('[Main] Stopping host before quit...');
    // Stop host and then quit
    stopHost()
      .then(() => console.log('[Main] Host stopped successfully'))
      .catch((err) => console.error('[Main] Error stopping host:', err))
      .finally(() => {
        console.log('[Main] Quitting app...');
        app.quit();
      });
  }
});

// Handle uncaught exceptions
process.on('uncaughtException', (error) => {
  console.error('Uncaught exception:', error);
});

process.on('unhandledRejection', (reason) => {
  console.error('Unhandled rejection:', reason);
});
