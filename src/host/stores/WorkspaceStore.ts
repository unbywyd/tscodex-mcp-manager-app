/**
 * WorkspaceStore - Manages workspace configurations
 */

import { app } from 'electron';
import fs from 'fs/promises';
import path from 'path';
import { v4 as uuid } from 'uuid';
import type {
  WorkspaceConfig,
  WorkspaceServerConfig,
  WorkspaceSource,
  GLOBAL_WORKSPACE_ID,
} from '../../shared/types';

interface WorkspacesData {
  workspaces: WorkspaceConfig[];
  workspaceServers: Record<string, Record<string, WorkspaceServerConfig>>;
}

export class WorkspaceStore {
  private workspaces: Map<string, WorkspaceConfig> = new Map();
  private workspaceServers: Map<string, Map<string, WorkspaceServerConfig>> = new Map();
  private filePath: string;

  constructor() {
    const userDataPath = app?.getPath?.('userData') || process.cwd();
    this.filePath = path.join(userDataPath, 'config', 'workspaces.json');
  }

  /**
   * Load workspaces from disk
   */
  async load(): Promise<void> {
    try {
      const dir = path.dirname(this.filePath);
      await fs.mkdir(dir, { recursive: true });

      const data = await fs.readFile(this.filePath, 'utf-8');
      const parsed: WorkspacesData = JSON.parse(data);

      this.workspaces.clear();
      this.workspaceServers.clear();

      for (const ws of parsed.workspaces) {
        this.workspaces.set(ws.id, ws);
      }

      for (const [wsId, servers] of Object.entries(parsed.workspaceServers)) {
        const serverMap = new Map<string, WorkspaceServerConfig>();
        for (const [serverId, config] of Object.entries(servers)) {
          serverMap.set(serverId, config);
        }
        this.workspaceServers.set(wsId, serverMap);
      }

      console.log(`Loaded ${this.workspaces.size} workspaces`);
    } catch (error: unknown) {
      if ((error as NodeJS.ErrnoException).code !== 'ENOENT') {
        console.error('Failed to load workspaces:', error);
      }
    }
  }

  /**
   * Save workspaces to disk
   */
  async save(): Promise<void> {
    try {
      const dir = path.dirname(this.filePath);
      await fs.mkdir(dir, { recursive: true });

      const data: WorkspacesData = {
        workspaces: Array.from(this.workspaces.values()),
        workspaceServers: {},
      };

      for (const [wsId, servers] of this.workspaceServers) {
        data.workspaceServers[wsId] = Object.fromEntries(servers);
      }

      const tempPath = `${this.filePath}.tmp`;
      await fs.writeFile(tempPath, JSON.stringify(data, null, 2));
      await fs.rename(tempPath, this.filePath);
    } catch (error) {
      console.error('Failed to save workspaces:', error);
      throw error;
    }
  }

  /**
   * Get all workspaces
   */
  getAll(): WorkspaceConfig[] {
    return Array.from(this.workspaces.values());
  }

  /**
   * Get workspace by ID
   */
  get(id: string): WorkspaceConfig | undefined {
    return this.workspaces.get(id);
  }

  /**
   * Find workspace by project root
   */
  findByProjectRoot(projectRoot: string): WorkspaceConfig | undefined {
    const normalized = this.normalizePath(projectRoot);
    for (const ws of this.workspaces.values()) {
      if (this.normalizePath(ws.projectRoot) === normalized) {
        return ws;
      }
    }
    return undefined;
  }

  /**
   * Create a new workspace
   */
  async create(data: {
    label: string;
    projectRoot: string;
    source?: WorkspaceSource;
    sourceInstanceId?: string;
  }): Promise<WorkspaceConfig> {
    // Check if workspace already exists for this path
    const existing = this.findByProjectRoot(data.projectRoot);
    if (existing) {
      return existing;
    }

    const now = Date.now();

    const workspace: WorkspaceConfig = {
      id: uuid(),
      label: data.label,
      projectRoot: data.projectRoot,
      source: data.source || 'manual',
      sourceInstanceId: data.sourceInstanceId,
      createdAt: now,
      updatedAt: now,
    };

    this.workspaces.set(workspace.id, workspace);
    await this.save();

    return workspace;
  }

  /**
   * Update a workspace
   */
  async update(id: string, data: Partial<WorkspaceConfig>): Promise<WorkspaceConfig | undefined> {
    const workspace = this.workspaces.get(id);
    if (!workspace) {
      return undefined;
    }

    const updated: WorkspaceConfig = {
      ...workspace,
      ...data,
      id, // Prevent ID change
      updatedAt: Date.now(),
    };

    this.workspaces.set(id, updated);
    await this.save();

    return updated;
  }

  /**
   * Delete a workspace
   */
  async delete(id: string): Promise<boolean> {
    const deleted = this.workspaces.delete(id);
    this.workspaceServers.delete(id);

    if (deleted) {
      await this.save();
    }
    return deleted;
  }

  /**
   * Get server config for a workspace
   */
  getServerConfig(workspaceId: string, serverId: string): WorkspaceServerConfig | undefined {
    return this.workspaceServers.get(workspaceId)?.get(serverId);
  }

  /**
   * Get all server configs for a workspace
   */
  getAllServerConfigs(workspaceId: string): Record<string, WorkspaceServerConfig> {
    const servers = this.workspaceServers.get(workspaceId);
    if (!servers) {
      return {};
    }
    return Object.fromEntries(servers);
  }

  /**
   * Set server config for a workspace
   */
  async setServerConfig(
    workspaceId: string,
    serverId: string,
    config: WorkspaceServerConfig
  ): Promise<void> {
    let servers = this.workspaceServers.get(workspaceId);
    if (!servers) {
      servers = new Map();
      this.workspaceServers.set(workspaceId, servers);
    }

    servers.set(serverId, config);
    await this.save();
  }

  /**
   * Delete server config for a workspace
   */
  async deleteServerConfig(workspaceId: string, serverId: string): Promise<void> {
    const servers = this.workspaceServers.get(workspaceId);
    if (servers) {
      servers.delete(serverId);
      await this.save();
    }
  }

  /**
   * Normalize path for comparison
   */
  private normalizePath(p: string): string {
    return p.replace(/\\/g, '/').toLowerCase();
  }
}
