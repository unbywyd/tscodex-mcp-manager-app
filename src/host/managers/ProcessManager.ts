/**
 * ProcessManager - MCP server process lifecycle management
 */

import { spawn, ChildProcess, exec } from 'child_process';
import { EventBus } from './EventBus';
import { PortManager } from './PortManager';
import { ServerStore } from '../stores/ServerStore';
import { SecretStore } from '../stores/SecretStore';
import { getSpawnCommand, delay } from '../../shared/utils';
import {
  ServerInstance,
  ServerStatus,
  HEALTH_CHECK_TIMEOUT,
  HEALTH_CHECK_INTERVAL,
  HEALTH_CHECK_MAX_ATTEMPTS,
  DEFAULT_MCP_PATH,
} from '../../shared/types';

interface ProcessInfo {
  process: ChildProcess;
  instance: ServerInstance;
  stopping: boolean; // Flag to prevent auto-restart on intentional stop
}

const RESTART_WINDOW_MS = 5 * 60 * 1000; // 5 minutes
const MAX_RESTART_ATTEMPTS = 3;
const GRACEFUL_SHUTDOWN_TIMEOUT = 5000;

export class ProcessManager {
  private processes: Map<string, ProcessInfo> = new Map();

  constructor(
    private portManager: PortManager,
    private eventBus: EventBus,
    private serverStore: ServerStore,
    private secretStore: SecretStore
  ) {}

  /**
   * Generate unique key for server instance
   */
  private getKey(serverId: string, workspaceId: string): string {
    return `${serverId}:${workspaceId}`;
  }

  /**
   * Start a server instance
   */
  async start(
    serverId: string,
    workspaceId: string,
    projectRoot?: string,
    configOverride?: Record<string, unknown>
  ): Promise<ServerInstance> {
    const key = this.getKey(serverId, workspaceId);

    // Check if already running
    const existing = this.processes.get(key);
    if (existing && existing.instance.status === 'running') {
      return existing.instance;
    }

    // Get server template
    const server = await this.serverStore.get(serverId);
    if (!server) {
      throw new Error(`Server not found: ${serverId}`);
    }

    // Allocate port
    const port = await this.portManager.allocate(key);

    // Create instance - preserve restart attempts from previous instance if exists
    const instance: ServerInstance = {
      serverId,
      workspaceId,
      status: 'starting',
      port,
      restartAttempts: existing?.instance.restartAttempts ?? 0,
      firstStartAt: existing?.instance.firstStartAt ?? Date.now(),
    };

    // Emit starting event
    this.eventBus.emitServerEvent({
      type: 'server-starting',
      serverId,
      workspaceId,
    });

    try {
      // Get spawn command
      const { command, args } = getSpawnCommand(
        server.installType,
        server.packageName,
        server.packageVersion,
        server.localPath
      );

      // Build environment variables
      const env = await this.buildEnvironment(
        serverId,
        workspaceId,
        port,
        projectRoot,
        server.defaultConfig,
        configOverride
      );

      // Spawn process
      const proc = spawn(command, args, {
        env,
        cwd: projectRoot || process.cwd(),
        stdio: ['pipe', 'pipe', 'pipe'],
        shell: process.platform === 'win32',
      });

      instance.pid = proc.pid;

      // Store process info
      this.processes.set(key, { process: proc, instance, stopping: false });

      // Setup process handlers
      this.setupProcessHandlers(key, proc, instance);

      // Wait for health check
      await this.waitForHealth(port, instance);

      // Update status
      instance.status = 'running';
      // Reset restart attempts on successful start
      instance.restartAttempts = 0;
      instance.firstStartAt = Date.now();

      // Emit started event
      this.eventBus.emitServerEvent({
        type: 'server-started',
        serverId,
        workspaceId,
        data: { port },
      });

      return instance;
    } catch (error) {
      // Cleanup on failure
      instance.status = 'error';
      instance.lastError = error instanceof Error ? error.message : String(error);

      this.portManager.release(key);
      // Keep the process info in map to track restart attempts
      // Only delete if we're not going to auto-restart
      const info = this.processes.get(key);
      if (info && instance.restartAttempts >= MAX_RESTART_ATTEMPTS) {
        this.processes.delete(key);
      }

      // Emit error event
      this.eventBus.emitServerEvent({
        type: 'server-error',
        serverId,
        workspaceId,
        data: { error: instance.lastError },
      });

      throw error;
    }
  }

  /**
   * Stop a server instance
   */
  async stop(serverId: string, workspaceId: string): Promise<void> {
    const key = this.getKey(serverId, workspaceId);
    const info = this.processes.get(key);

    if (!info) {
      return;
    }

    // Mark as intentionally stopping to prevent auto-restart
    info.stopping = true;

    const { process: proc, instance } = info;

    try {
      // Try graceful shutdown
      if (proc.pid && !proc.killed) {
        // On Windows, use taskkill to kill the process tree
        if (process.platform === 'win32') {
          await this.killProcessTree(proc.pid);
        } else {
          proc.kill('SIGTERM');

          // Wait for graceful exit
          const exited = await this.waitForExit(proc, GRACEFUL_SHUTDOWN_TIMEOUT);

          if (!exited) {
            // Force kill
            proc.kill('SIGKILL');
          }
        }
      }
    } catch (error) {
      console.error(`Error stopping process ${key}:`, error);
    } finally {
      // Cleanup
      this.portManager.release(key);
      this.processes.delete(key);

      // Emit stopped event
      this.eventBus.emitServerEvent({
        type: 'server-stopped',
        serverId: instance.serverId,
        workspaceId: instance.workspaceId,
      });
    }
  }

  /**
   * Kill process tree on Windows
   */
  private killProcessTree(pid: number): Promise<void> {
    return new Promise((resolve) => {
      // /T kills the process tree, /F forces termination
      exec(`taskkill /PID ${pid} /T /F`, (error) => {
        if (error) {
          console.error(`taskkill error for PID ${pid}:`, error.message);
        }
        resolve();
      });
    });
  }

  /**
   * Restart a server instance
   */
  async restart(
    serverId: string,
    workspaceId: string,
    projectRoot?: string,
    configOverride?: Record<string, unknown>
  ): Promise<ServerInstance> {
    await this.stop(serverId, workspaceId);
    await delay(500); // Brief pause before restart
    return this.start(serverId, workspaceId, projectRoot, configOverride);
  }

  /**
   * Stop all server instances
   */
  async stopAll(): Promise<void> {
    const keys = Array.from(this.processes.keys());
    await Promise.all(
      keys.map((key) => {
        const [serverId, workspaceId] = key.split(':');
        return this.stop(serverId, workspaceId);
      })
    );
  }

  /**
   * Get server instance status
   */
  getInstance(serverId: string, workspaceId: string): ServerInstance | undefined {
    const key = this.getKey(serverId, workspaceId);
    return this.processes.get(key)?.instance;
  }

  /**
   * Get all running instances
   */
  getAllInstances(): ServerInstance[] {
    return Array.from(this.processes.values()).map((p) => p.instance);
  }

  /**
   * Check if a server is running
   */
  isRunning(serverId: string, workspaceId: string): boolean {
    const instance = this.getInstance(serverId, workspaceId);
    return instance?.status === 'running';
  }

  /**
   * Build environment variables for process
   */
  private async buildEnvironment(
    serverId: string,
    workspaceId: string,
    port: number,
    projectRoot?: string,
    defaultConfig?: Record<string, unknown>,
    configOverride?: Record<string, unknown>
  ): Promise<NodeJS.ProcessEnv> {
    // Get secrets
    const globalSecrets = await this.secretStore.getSecrets(serverId, 'global');
    const workspaceSecrets = await this.secretStore.getSecrets(serverId, 'workspace', workspaceId);

    // Merge config
    const config = {
      ...defaultConfig,
      ...configOverride,
    };

    return {
      ...process.env,
      MCP_PORT: String(port),
      MCP_HOST: '127.0.0.1',
      MCP_PATH: DEFAULT_MCP_PATH,
      MCP_PROJECT_ROOT: projectRoot || '',
      MCP_WORKSPACE_ID: workspaceId,
      MCP_SERVER_ID: serverId,
      MCP_CONFIG: JSON.stringify(config),
      NODE_ENV: 'production',
      // Merge secrets (workspace overrides global)
      ...globalSecrets,
      ...workspaceSecrets,
    };
  }

  /**
   * Setup process event handlers
   */
  private setupProcessHandlers(
    key: string,
    proc: ChildProcess,
    instance: ServerInstance
  ): void {
    // Stdout logging
    proc.stdout?.on('data', (data: Buffer) => {
      const message = data.toString().trim();
      if (message) {
        this.eventBus.emitServerEvent({
          type: 'server-log',
          serverId: instance.serverId,
          workspaceId: instance.workspaceId,
          data: { message, level: 'info' },
        });
      }
    });

    // Stderr logging
    proc.stderr?.on('data', (data: Buffer) => {
      const message = data.toString().trim();
      if (message) {
        this.eventBus.emitServerEvent({
          type: 'server-log',
          serverId: instance.serverId,
          workspaceId: instance.workspaceId,
          data: { message, level: 'error' },
        });
      }
    });

    // Process exit
    proc.on('exit', (code, signal) => {
      console.log(`Process ${key} exited with code ${code}, signal ${signal}`);

      const info = this.processes.get(key);
      if (info) {
        info.instance.status = 'stopped';

        // Check if we should auto-restart (only if not intentionally stopped)
        if (!info.stopping && code !== 0 && !signal) {
          this.handleCrash(key, info);
        }
      }
    });

    // Process error
    proc.on('error', (error) => {
      console.error(`Process ${key} error:`, error);

      const info = this.processes.get(key);
      if (info) {
        info.instance.status = 'error';
        info.instance.lastError = error.message;

        this.eventBus.emitServerEvent({
          type: 'server-error',
          serverId: instance.serverId,
          workspaceId: instance.workspaceId,
          data: { error: error.message },
        });
      }
    });
  }

  /**
   * Handle process crash with auto-restart logic
   */
  private async handleCrash(key: string, info: ProcessInfo): Promise<void> {
    const { instance } = info;
    const now = Date.now();

    // Reset restart count if outside window
    if (now - instance.firstStartAt > RESTART_WINDOW_MS) {
      instance.restartAttempts = 0;
      instance.firstStartAt = now;
    }

    // Increment restart attempts BEFORE checking limit
    instance.restartAttempts++;

    // Check restart limit
    if (instance.restartAttempts > MAX_RESTART_ATTEMPTS) {
      console.log(`Process ${key} exceeded restart limit (${instance.restartAttempts}/${MAX_RESTART_ATTEMPTS})`);
      instance.status = 'error';
      instance.lastError = 'Exceeded restart attempts';

      // Clean up - don't try anymore
      this.portManager.release(key);
      this.processes.delete(key);

      this.eventBus.emitServerEvent({
        type: 'server-error',
        serverId: instance.serverId,
        workspaceId: instance.workspaceId,
        data: { error: 'Exceeded restart attempts' },
      });
      return;
    }

    console.log(`Restarting process ${key}, attempt ${instance.restartAttempts}/${MAX_RESTART_ATTEMPTS}`);

    try {
      await delay(1000 * instance.restartAttempts); // Backoff

      // Check if server still exists before restarting
      const server = await this.serverStore.get(instance.serverId);
      if (!server) {
        console.log(`Server ${instance.serverId} no longer exists, skipping restart`);
        this.portManager.release(key);
        this.processes.delete(key);
        return;
      }

      // Check if we've been stopped intentionally
      const currentInfo = this.processes.get(key);
      if (currentInfo?.stopping) {
        console.log(`Process ${key} was stopped intentionally, skipping restart`);
        return;
      }

      await this.start(instance.serverId, instance.workspaceId);
    } catch (error) {
      console.error(`Failed to restart process ${key}:`, error);
      // Don't recursively call handleCrash - the exit handler will do it
    }
  }

  /**
   * Wait for health check to pass
   */
  private async waitForHealth(port: number, instance: ServerInstance): Promise<void> {
    const url = `http://127.0.0.1:${port}/health`;

    for (let attempt = 0; attempt < HEALTH_CHECK_MAX_ATTEMPTS; attempt++) {
      try {
        const response = await fetch(url, {
          signal: AbortSignal.timeout(HEALTH_CHECK_TIMEOUT),
        });

        if (response.ok) {
          const data = (await response.json()) as {
            tools?: number;
            resources?: number;
            prompts?: number;
          };
          // Update instance with server info
          if (data.tools) instance.toolsCount = data.tools;
          if (data.resources) instance.resourcesCount = data.resources;
          if (data.prompts) instance.promptsCount = data.prompts;
          return;
        }
      } catch {
        // Ignore and retry
      }

      await delay(HEALTH_CHECK_INTERVAL);
    }

    throw new Error(`Health check failed after ${HEALTH_CHECK_MAX_ATTEMPTS} attempts`);
  }

  /**
   * Wait for process to exit
   */
  private waitForExit(proc: ChildProcess, timeout: number): Promise<boolean> {
    return new Promise((resolve) => {
      const timer = setTimeout(() => {
        resolve(false);
      }, timeout);

      proc.once('exit', () => {
        clearTimeout(timer);
        resolve(true);
      });
    });
  }
}
