/**
 * ServerStore - Manages server templates
 */

import { app } from 'electron';
import fs from 'fs/promises';
import path from 'path';
import { v4 as uuid } from 'uuid';
import type { ServerTemplate, InstallType } from '../../shared/types';

export class ServerStore {
  private servers: Map<string, ServerTemplate> = new Map();
  private filePath: string;

  constructor() {
    const userDataPath = app?.getPath?.('userData') || process.cwd();
    this.filePath = path.join(userDataPath, 'config', 'servers.json');
  }

  /**
   * Load servers from disk
   */
  async load(): Promise<void> {
    try {
      const dir = path.dirname(this.filePath);
      await fs.mkdir(dir, { recursive: true });

      const data = await fs.readFile(this.filePath, 'utf-8');
      const servers: ServerTemplate[] = JSON.parse(data);

      this.servers.clear();
      for (const server of servers) {
        this.servers.set(server.id, server);
      }

      console.log(`Loaded ${this.servers.size} servers`);
    } catch (error: unknown) {
      if ((error as NodeJS.ErrnoException).code !== 'ENOENT') {
        console.error('Failed to load servers:', error);
      }
      // Start with empty map if file doesn't exist
    }
  }

  /**
   * Save servers to disk
   */
  async save(): Promise<void> {
    try {
      const dir = path.dirname(this.filePath);
      await fs.mkdir(dir, { recursive: true });

      const servers = Array.from(this.servers.values());
      const tempPath = `${this.filePath}.tmp`;

      await fs.writeFile(tempPath, JSON.stringify(servers, null, 2));
      await fs.rename(tempPath, this.filePath);
    } catch (error) {
      console.error('Failed to save servers:', error);
      throw error;
    }
  }

  /**
   * Get all servers
   */
  getAll(): ServerTemplate[] {
    return Array.from(this.servers.values());
  }

  /**
   * Get server by ID
   */
  async get(id: string): Promise<ServerTemplate | undefined> {
    return this.servers.get(id);
  }

  /**
   * Create a new server
   */
  async create(data: {
    installType: InstallType;
    packageName?: string;
    packageVersion?: string;
    localPath?: string;
    displayName?: string;
    description?: string;
    packageInfo?: {
      homepage?: string;
      repository?: string;
      readme?: string;
      author?: string | { name?: string; email?: string; url?: string };
    };
  }): Promise<ServerTemplate> {
    const now = Date.now();

    const server: ServerTemplate = {
      id: uuid(),
      installType: data.installType,
      packageName: data.packageName,
      packageVersion: data.packageVersion,
      localPath: data.localPath,
      displayName: data.displayName || data.packageName || 'Unknown Server',
      description: data.description,
      defaultConfig: {},
      packageInfo: data.packageInfo,
      createdAt: now,
      updatedAt: now,
    };

    this.servers.set(server.id, server);
    await this.save();

    return server;
  }

  /**
   * Update a server
   */
  async update(id: string, data: Partial<ServerTemplate>): Promise<ServerTemplate | undefined> {
    const server = this.servers.get(id);
    if (!server) {
      return undefined;
    }

    const updated: ServerTemplate = {
      ...server,
      ...data,
      id, // Prevent ID change
      updatedAt: Date.now(),
    };

    this.servers.set(id, updated);
    await this.save();

    return updated;
  }

  /**
   * Delete a server
   */
  async delete(id: string): Promise<boolean> {
    const deleted = this.servers.delete(id);
    if (deleted) {
      await this.save();
    }
    return deleted;
  }

  /**
   * Update server metadata from --meta response
   */
  async updateMetadata(
    id: string,
    metadata: {
      name?: string;
      version?: string;
      description?: string;
      configSchema?: Record<string, unknown>;
      tools?: number;
      resources?: number;
      prompts?: number;
    }
  ): Promise<ServerTemplate | undefined> {
    const server = this.servers.get(id);
    if (!server) {
      return undefined;
    }

    const updated: ServerTemplate = {
      ...server,
      displayName: metadata.name || server.displayName,
      version: metadata.version || server.version,
      description: metadata.description || server.description,
      configSchema: metadata.configSchema || server.configSchema,
      updatedAt: Date.now(),
    };

    this.servers.set(id, updated);
    await this.save();

    return updated;
  }
}
