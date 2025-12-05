/**
 * SecretStore - Secure secret storage using OS keychain
 *
 * On Linux, this requires libsecret and a secret service (GNOME Keyring or KDE Wallet).
 * If not available, operations will fail gracefully with appropriate error messages.
 */

import keytar from 'keytar';

const SERVICE_NAME = 'mcp-manager';
const GLOBAL_SCOPE = 'global';

/**
 * Check if we're running on Linux and keytar might have issues
 */
const isLinux = process.platform === 'linux';

/**
 * Flag to track if keytar is available (set on first error)
 */
let keytarAvailable = true;
let keytarErrorMessage: string | null = null;

/**
 * Wrapper to handle keytar errors gracefully on Linux
 */
async function safeKeytarOperation<T>(
  operation: () => Promise<T>,
  fallback: T,
  context: string
): Promise<T> {
  if (!keytarAvailable) {
    console.warn(`[SecretStore] Keytar unavailable, skipping ${context}: ${keytarErrorMessage}`);
    return fallback;
  }

  try {
    return await operation();
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : String(error);

    // Check for common Linux keytar errors
    if (isLinux && (
      errorMsg.includes('libsecret') ||
      errorMsg.includes('Secret Service') ||
      errorMsg.includes('org.freedesktop.secrets') ||
      errorMsg.includes('Cannot autolaunch D-Bus')
    )) {
      keytarAvailable = false;
      keytarErrorMessage = 'Secure storage unavailable. On Linux, install libsecret-1-dev and ensure GNOME Keyring or KDE Wallet is running.';
      console.error(`[SecretStore] ${keytarErrorMessage}`);
    } else {
      console.error(`[SecretStore] Failed to ${context}:`, error);
    }

    return fallback;
  }
}

export class SecretStore {
  /**
   * Check if secure storage is available
   */
  isAvailable(): boolean {
    return keytarAvailable;
  }

  /**
   * Get the error message if keytar is unavailable
   */
  getUnavailableReason(): string | null {
    return keytarErrorMessage;
  }
  /**
   * Get all secrets for a server
   */
  async getSecrets(
    serverId: string,
    scope: 'global' | 'workspace',
    workspaceId?: string
  ): Promise<Record<string, string>> {
    const prefix = this.getPrefix(serverId, scope, workspaceId);

    return safeKeytarOperation(
      async () => {
        const secrets: Record<string, string> = {};
        const credentials = await keytar.findCredentials(SERVICE_NAME);

        for (const cred of credentials) {
          if (cred.account.startsWith(prefix)) {
            const key = cred.account.slice(prefix.length);
            secrets[key] = cred.password;
          }
        }
        return secrets;
      },
      {},
      `get secrets for ${serverId}`
    );
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

    return safeKeytarOperation(
      async () => {
        const keys: string[] = [];
        const credentials = await keytar.findCredentials(SERVICE_NAME);

        for (const cred of credentials) {
          if (cred.account.startsWith(prefix)) {
            const key = cred.account.slice(prefix.length);
            keys.push(key);
          }
        }
        return keys;
      },
      [],
      `get secret keys for ${serverId}`
    );
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

    if (!keytarAvailable) {
      throw new Error(keytarErrorMessage || 'Secure storage unavailable');
    }

    try {
      await keytar.setPassword(SERVICE_NAME, account, value);
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error);

      // Check for Linux-specific errors
      if (isLinux && (
        errorMsg.includes('libsecret') ||
        errorMsg.includes('Secret Service') ||
        errorMsg.includes('org.freedesktop.secrets') ||
        errorMsg.includes('Cannot autolaunch D-Bus')
      )) {
        keytarAvailable = false;
        keytarErrorMessage = 'Secure storage unavailable. On Linux, install libsecret-1-dev and ensure GNOME Keyring or KDE Wallet is running.';
        throw new Error(keytarErrorMessage);
      }

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

    return safeKeytarOperation(
      () => keytar.deletePassword(SERVICE_NAME, account),
      false,
      `delete secret ${key} for ${serverId}`
    );
  }

  /**
   * Delete all secrets for a server
   */
  async deleteAllSecrets(serverId: string): Promise<void> {
    await safeKeytarOperation(
      async () => {
        const credentials = await keytar.findCredentials(SERVICE_NAME);
        const serverPrefix = `${serverId}:`;

        for (const cred of credentials) {
          if (cred.account.startsWith(serverPrefix)) {
            await keytar.deletePassword(SERVICE_NAME, cred.account);
          }
        }
      },
      undefined,
      `delete all secrets for ${serverId}`
    );
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
    return safeKeytarOperation(
      async () => {
        const data = await keytar.getPassword(SERVICE_NAME, this.PROFILE_KEY);
        if (data) {
          return JSON.parse(data);
        }
        return null;
      },
      null,
      'get profile'
    );
  }

  /**
   * Set user profile
   */
  async setProfile(fullName: string, email: string): Promise<void> {
    if (!keytarAvailable) {
      throw new Error(keytarErrorMessage || 'Secure storage unavailable');
    }

    try {
      const data = JSON.stringify({ fullName, email });
      await keytar.setPassword(SERVICE_NAME, this.PROFILE_KEY, data);
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error);

      if (isLinux && (
        errorMsg.includes('libsecret') ||
        errorMsg.includes('Secret Service') ||
        errorMsg.includes('org.freedesktop.secrets') ||
        errorMsg.includes('Cannot autolaunch D-Bus')
      )) {
        keytarAvailable = false;
        keytarErrorMessage = 'Secure storage unavailable. On Linux, install libsecret-1-dev and ensure GNOME Keyring or KDE Wallet is running.';
        throw new Error(keytarErrorMessage);
      }

      console.error('Failed to set profile:', error);
      throw error;
    }
  }

  /**
   * Delete user profile
   */
  async deleteProfile(): Promise<void> {
    await safeKeytarOperation(
      () => keytar.deletePassword(SERVICE_NAME, this.PROFILE_KEY),
      false,
      'delete profile'
    );
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

  // ============================================================================
  // AI Assistant Secrets
  // ============================================================================

  private readonly AI_ASSISTANT_KEY = '__ai-assistant__';

  /**
   * Get an AI Assistant secret
   * Keys: API_KEY, BASE_URL, DEFAULT_MODEL
   */
  async getAISecret(key: string): Promise<string | null> {
    return safeKeytarOperation(
      () => keytar.getPassword(SERVICE_NAME, `${this.AI_ASSISTANT_KEY}:${key}`),
      null,
      `get AI secret ${key}`
    );
  }

  /**
   * Set an AI Assistant secret
   */
  async setAISecret(key: string, value: string): Promise<void> {
    if (!keytarAvailable) {
      throw new Error(keytarErrorMessage || 'Secure storage unavailable');
    }

    try {
      await keytar.setPassword(SERVICE_NAME, `${this.AI_ASSISTANT_KEY}:${key}`, value);
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error);

      if (isLinux && (
        errorMsg.includes('libsecret') ||
        errorMsg.includes('Secret Service') ||
        errorMsg.includes('org.freedesktop.secrets') ||
        errorMsg.includes('Cannot autolaunch D-Bus')
      )) {
        keytarAvailable = false;
        keytarErrorMessage = 'Secure storage unavailable. On Linux, install libsecret-1-dev and ensure GNOME Keyring or KDE Wallet is running.';
        throw new Error(keytarErrorMessage);
      }

      console.error('Failed to set AI secret:', error);
      throw error;
    }
  }

  /**
   * Delete an AI Assistant secret
   */
  async deleteAISecret(key: string): Promise<boolean> {
    return safeKeytarOperation(
      () => keytar.deletePassword(SERVICE_NAME, `${this.AI_ASSISTANT_KEY}:${key}`),
      false,
      `delete AI secret ${key}`
    );
  }

  /**
   * Get AI Assistant config (without API key value)
   */
  async getAIConfig(): Promise<{ baseUrl: string | null; defaultModel: string | null; hasApiKey: boolean }> {
    const baseUrl = await this.getAISecret('BASE_URL');
    const defaultModel = await this.getAISecret('DEFAULT_MODEL');
    const apiKey = await this.getAISecret('API_KEY');

    return {
      baseUrl,
      defaultModel,
      hasApiKey: !!apiKey,
    };
  }
}
