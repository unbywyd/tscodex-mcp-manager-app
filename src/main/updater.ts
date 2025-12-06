/**
 * Auto-updater module for electron-updater
 * Handles checking, downloading, and installing updates from GitHub Releases
 */

import pkg from 'electron-updater';
const { autoUpdater } = pkg;
import type { UpdateInfo, ProgressInfo } from 'electron-updater';
import { BrowserWindow, ipcMain } from 'electron';
import { EventEmitter } from 'events';

export interface UpdateStatus {
  status: 'idle' | 'checking' | 'available' | 'not-available' | 'downloading' | 'downloaded' | 'error';
  version?: string;
  releaseNotes?: string;
  progress?: number;
  error?: string;
}

class AppUpdater extends EventEmitter {
  private mainWindow: BrowserWindow | null = null;
  private currentStatus: UpdateStatus = { status: 'idle' };

  constructor() {
    super();
    this.setupAutoUpdater();
  }

  private setupAutoUpdater(): void {
    // Configure auto-updater
    autoUpdater.autoDownload = false; // Don't auto-download, let user decide
    autoUpdater.autoInstallOnAppQuit = true;

    // Disable auto-update in development
    if (process.env.NODE_ENV === 'development') {
      autoUpdater.forceDevUpdateConfig = true;
    }

    // Event handlers
    autoUpdater.on('checking-for-update', () => {
      this.updateStatus({ status: 'checking' });
    });

    autoUpdater.on('update-available', (info: UpdateInfo) => {
      this.updateStatus({
        status: 'available',
        version: info.version,
        releaseNotes: typeof info.releaseNotes === 'string'
          ? info.releaseNotes
          : Array.isArray(info.releaseNotes)
            ? info.releaseNotes.map(n => n.note).join('\n')
            : undefined,
      });
    });

    autoUpdater.on('update-not-available', () => {
      this.updateStatus({ status: 'not-available' });
    });

    autoUpdater.on('download-progress', (progress: ProgressInfo) => {
      this.updateStatus({
        status: 'downloading',
        progress: Math.round(progress.percent),
      });
    });

    autoUpdater.on('update-downloaded', (info: UpdateInfo) => {
      this.updateStatus({
        status: 'downloaded',
        version: info.version,
      });
    });

    autoUpdater.on('error', (error: Error) => {
      this.updateStatus({
        status: 'error',
        error: error.message,
      });
    });
  }

  private updateStatus(status: UpdateStatus): void {
    this.currentStatus = { ...this.currentStatus, ...status };
    this.emit('status-changed', this.currentStatus);

    // Send to renderer
    if (this.mainWindow && !this.mainWindow.isDestroyed()) {
      this.mainWindow.webContents.send('updater:status', this.currentStatus);
    }
  }

  /**
   * Set the main window for IPC communication
   */
  setMainWindow(window: BrowserWindow): void {
    this.mainWindow = window;
  }

  /**
   * Check for updates
   */
  async checkForUpdates(): Promise<UpdateStatus> {
    try {
      await autoUpdater.checkForUpdates();
      return this.currentStatus;
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error);
      this.updateStatus({ status: 'error', error: errorMsg });
      return this.currentStatus;
    }
  }

  /**
   * Download the update
   */
  async downloadUpdate(): Promise<void> {
    try {
      await autoUpdater.downloadUpdate();
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error);
      this.updateStatus({ status: 'error', error: errorMsg });
    }
  }

  /**
   * Install the update and restart the app
   */
  quitAndInstall(): void {
    autoUpdater.quitAndInstall(false, true);
  }

  /**
   * Get current status
   */
  getStatus(): UpdateStatus {
    return this.currentStatus;
  }
}

// Singleton instance
export const appUpdater = new AppUpdater();

/**
 * Setup IPC handlers for updater
 */
export function setupUpdaterIpc(): void {
  ipcMain.handle('updater:check', async () => {
    return appUpdater.checkForUpdates();
  });

  ipcMain.handle('updater:download', async () => {
    await appUpdater.downloadUpdate();
  });

  ipcMain.handle('updater:install', () => {
    appUpdater.quitAndInstall();
  });

  ipcMain.handle('updater:get-status', () => {
    return appUpdater.getStatus();
  });
}
