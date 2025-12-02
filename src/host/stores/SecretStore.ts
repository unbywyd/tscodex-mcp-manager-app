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
}
