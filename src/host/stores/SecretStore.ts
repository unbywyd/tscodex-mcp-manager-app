/**
 * SecretStore - Secure secret storage using OS keychain
 */

import keytar from 'keytar';

const SERVICE_NAME = 'mcp-manager';
const GLOBAL_SCOPE = 'global';

export class SecretStore {
  /**
   * Get all secrets for a server
   */
  async getSecrets(
    serverId: string,
    scope: 'global' | 'workspace',
    workspaceId?: string
  ): Promise<Record<string, string>> {
    const prefix = this.getPrefix(serverId, scope, workspaceId);
    const secrets: Record<string, string> = {};

    try {
      const credentials = await keytar.findCredentials(SERVICE_NAME);

      for (const cred of credentials) {
        if (cred.account.startsWith(prefix)) {
          const key = cred.account.slice(prefix.length);
          secrets[key] = cred.password;
        }
      }
    } catch (error) {
      console.error('Failed to get secrets:', error);
    }

    return secrets;
  }

  /**
   * Get secret keys only (no values)
   */
  async getSecretKeys(
    serverId: string,
    scope: 'global' | 'workspace',
    workspaceId?: string
  ): Promise<string[]> {
    const prefix = this.getPrefix(serverId, scope, workspaceId);
    const keys: string[] = [];

    try {
      const credentials = await keytar.findCredentials(SERVICE_NAME);

      for (const cred of credentials) {
        if (cred.account.startsWith(prefix)) {
          const key = cred.account.slice(prefix.length);
          keys.push(key);
        }
      }
    } catch (error) {
      console.error('Failed to get secret keys:', error);
    }

    return keys;
  }

  /**
   * Set a secret
   */
  async setSecret(
    serverId: string,
    key: string,
    value: string,
    scope: 'global' | 'workspace',
    workspaceId?: string
  ): Promise<void> {
    const account = this.getAccount(serverId, key, scope, workspaceId);

    try {
      await keytar.setPassword(SERVICE_NAME, account, value);
    } catch (error) {
      console.error('Failed to set secret:', error);
      throw error;
    }
  }

  /**
   * Delete a secret
   */
  async deleteSecret(
    serverId: string,
    key: string,
    scope: 'global' | 'workspace',
    workspaceId?: string
  ): Promise<boolean> {
    const account = this.getAccount(serverId, key, scope, workspaceId);

    try {
      return await keytar.deletePassword(SERVICE_NAME, account);
    } catch (error) {
      console.error('Failed to delete secret:', error);
      return false;
    }
  }

  /**
   * Delete all secrets for a server
   */
  async deleteAllSecrets(serverId: string): Promise<void> {
    try {
      const credentials = await keytar.findCredentials(SERVICE_NAME);
      const serverPrefix = `${serverId}:`;

      for (const cred of credentials) {
        if (cred.account.startsWith(serverPrefix)) {
          await keytar.deletePassword(SERVICE_NAME, cred.account);
        }
      }
    } catch (error) {
      console.error('Failed to delete all secrets:', error);
    }
  }

  /**
   * Get merged secrets (global + workspace, workspace overrides global)
   */
  async getMergedSecrets(serverId: string, workspaceId: string): Promise<Record<string, string>> {
    const globalSecrets = await this.getSecrets(serverId, 'global');
    const workspaceSecrets = await this.getSecrets(serverId, 'workspace', workspaceId);

    return {
      ...globalSecrets,
      ...workspaceSecrets,
    };
  }

  /**
   * Get account key for keytar
   */
  private getAccount(
    serverId: string,
    key: string,
    scope: 'global' | 'workspace',
    workspaceId?: string
  ): string {
    return `${this.getPrefix(serverId, scope, workspaceId)}${key}`;
  }

  /**
   * Get prefix for secrets
   */
  private getPrefix(
    serverId: string,
    scope: 'global' | 'workspace',
    workspaceId?: string
  ): string {
    if (scope === 'workspace' && workspaceId) {
      return `${serverId}:workspace:${workspaceId}:`;
    }
    return `${serverId}:${GLOBAL_SCOPE}:`;
  }

  // ============================================================================
  // User Profile
  // ============================================================================

  private readonly PROFILE_KEY = '__profile__';

  /**
   * Get user profile
   */
  async getProfile(): Promise<{ fullName: string; email: string } | null> {
    try {
      const data = await keytar.getPassword(SERVICE_NAME, this.PROFILE_KEY);
      if (data) {
        return JSON.parse(data);
      }
    } catch (error) {
      console.error('Failed to get profile:', error);
    }
    return null;
  }

  /**
   * Set user profile
   */
  async setProfile(fullName: string, email: string): Promise<void> {
    try {
      const data = JSON.stringify({ fullName, email });
      await keytar.setPassword(SERVICE_NAME, this.PROFILE_KEY, data);
    } catch (error) {
      console.error('Failed to set profile:', error);
      throw error;
    }
  }

  /**
   * Delete user profile
   */
  async deleteProfile(): Promise<void> {
    try {
      await keytar.deletePassword(SERVICE_NAME, this.PROFILE_KEY);
    } catch (error) {
      console.error('Failed to delete profile:', error);
    }
  }

  // ============================================================================
  // MCP Tools Secrets
  // ============================================================================

  private readonly MCP_TOOLS_SERVER_ID = '__mcp-tools__';

  /**
   * Get a single secret value by key name for MCP Tools
   * Looks up in workspace-specific secrets first, then falls back to global
   *
   * @param keyName - The secret key name (e.g., "API_KEY", "AUTH_TOKEN")
   * @param workspaceId - The workspace ID to check for workspace-specific overrides
   * @returns The secret value or undefined if not found
   */
  getSecret(keyName: string, workspaceId: string): string | undefined {
    // Note: This is synchronous for simplicity in executor context
    // We cache secrets on load for MCP Tools
    const cached = this.mcpToolsSecretsCache.get(workspaceId);
    if (cached) {
      return cached[keyName];
    }
    return undefined;
  }

  /**
   * Cache for MCP Tools secrets (per workspace)
   */
  private mcpToolsSecretsCache = new Map<string, Record<string, string>>();

  /**
   * Load MCP Tools secrets into cache for a workspace
   * Priority: app global < mcp-tools global < mcp-tools workspace
   */
  async loadMcpToolsSecrets(workspaceId: string): Promise<void> {
    // Same priority as regular servers: app global < server global < server workspace
    const appGlobalSecrets = await this.getSecrets('__app__', 'global');
    const mcpToolsGlobalSecrets = await this.getSecrets(this.MCP_TOOLS_SERVER_ID, 'global');
    const mcpToolsWorkspaceSecrets = await this.getSecrets(this.MCP_TOOLS_SERVER_ID, 'workspace', workspaceId);

    const merged = {
      ...appGlobalSecrets,
      ...mcpToolsGlobalSecrets,
      ...mcpToolsWorkspaceSecrets,
    };

    this.mcpToolsSecretsCache.set(workspaceId, merged);
  }

  /**
   * Clear MCP Tools secrets cache
   */
  clearMcpToolsSecretsCache(): void {
    this.mcpToolsSecretsCache.clear();
  }

  /**
   * Get all MCP Tools secret keys (no values) for a workspace
   */
  async getMcpToolsSecretKeys(workspaceId: string): Promise<string[]> {
    const globalKeys = await this.getSecretKeys(this.MCP_TOOLS_SERVER_ID, 'global');
    const workspaceKeys = await this.getSecretKeys(this.MCP_TOOLS_SERVER_ID, 'workspace', workspaceId);
    return [...new Set([...globalKeys, ...workspaceKeys])];
  }

  /**
   * Set an MCP Tools secret
   */
  async setMcpToolsSecret(
    key: string,
    value: string,
    scope: 'global' | 'workspace',
    workspaceId?: string
  ): Promise<void> {
    await this.setSecret(this.MCP_TOOLS_SERVER_ID, key, value, scope, workspaceId);
    // Clear cache to reload on next access
    if (workspaceId) {
      this.mcpToolsSecretsCache.delete(workspaceId);
    } else {
      this.mcpToolsSecretsCache.clear();
    }
  }

  /**
   * Delete an MCP Tools secret
   */
  async deleteMcpToolsSecret(
    key: string,
    scope: 'global' | 'workspace',
    workspaceId?: string
  ): Promise<boolean> {
    const result = await this.deleteSecret(this.MCP_TOOLS_SERVER_ID, key, scope, workspaceId);
    // Clear cache
    if (workspaceId) {
      this.mcpToolsSecretsCache.delete(workspaceId);
    } else {
      this.mcpToolsSecretsCache.clear();
    }
    return result;
  }
}
