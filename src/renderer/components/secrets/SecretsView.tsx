import { useState, useEffect } from 'react';
import { Key, Plus, Trash2, Eye, EyeOff, Save, Info } from 'lucide-react';
import { useAppStore } from '../../stores/appStore';

interface SecretsViewProps {
  workspaceId: string;
}

interface SecretEntry {
  key: string;
  value: string;
  isNew?: boolean;
  isDirty?: boolean;
}

// Scope tag colors - same as in ServerSecretsManager for consistency
type SecretScope = 'global' | 'workspace';
const scopeColors: Record<SecretScope, { bg: string; text: string; label: string }> = {
  global: { bg: 'bg-gray-600', text: 'text-gray-200', label: 'Global' },
  workspace: { bg: 'bg-blue-600', text: 'text-blue-200', label: 'Workspace' },
};

export function SecretsView({ workspaceId }: SecretsViewProps) {
  const { servers } = useAppStore();
  const [selectedServerId, setSelectedServerId] = useState<string | null>(null);
  const [secrets, setSecrets] = useState<SecretEntry[]>([]);
  const [showValues, setShowValues] = useState<Record<string, boolean>>({});
  const [isLoading, setIsLoading] = useState(false);
  const [hasChanges, setHasChanges] = useState(false);
  const [keyErrors, setKeyErrors] = useState<Record<number, string>>({});

  // Determine scope based on workspaceId
  const scope: SecretScope = workspaceId === 'global' ? 'global' : 'workspace';
  const scopeInfo = scopeColors[scope];

  // Prefix for secret keys
  const SECRET_PREFIX = 'SECRET_';

  // Validate secret key format: only Latin letters, numbers, underscore, and hyphen
  const validateSecretKey = (key: string): string | null => {
    if (!key) return null; // Empty is OK (will be validated on save)

    // Remove SECRET_ prefix if present for validation
    const cleanKey = key.toUpperCase().startsWith(SECRET_PREFIX)
      ? key.slice(SECRET_PREFIX.length)
      : key;

    // Only allow: A-Z, a-z, 0-9, _, -
    const validPattern = /^[A-Za-z0-9_-]+$/;
    if (!validPattern.test(cleanKey)) {
      return 'Key can only contain letters, numbers, underscore (_), and hyphen (-)';
    }

    return null;
  };

  // Load secrets when server is selected
  useEffect(() => {
    if (selectedServerId) {
      loadSecrets(selectedServerId);
    } else {
      setSecrets([]);
    }
  }, [selectedServerId, workspaceId]);

  const loadSecrets = async (serverId: string) => {
    setIsLoading(true);
    try {
      // Use IPC to get secrets (secure)
      const serverSecrets = await window.electronAPI?.getSecrets(
        serverId,
        scope,
        scope === 'workspace' ? workspaceId : undefined
      );

      if (serverSecrets) {
        setSecrets(
          Object.entries(serverSecrets).map(([key, value]) => ({
            key,
            value: value as string,
          }))
        );
      } else {
        setSecrets([]);
      }
      setHasChanges(false);
    } catch (error) {
      console.error('Failed to load secrets:', error);
      setSecrets([]);
    }
    setIsLoading(false);
  };

  const addSecret = () => {
    setSecrets([...secrets, { key: '', value: '', isNew: true }]);
    setHasChanges(true);
  };

  const updateSecret = (index: number, field: 'key' | 'value', newValue: string) => {
    const updated = [...secrets];

    if (field === 'key') {
      // Convert to uppercase automatically
      const upperValue = newValue.toUpperCase();

      // Ensure SECRET_ prefix is present
      const finalKey = upperValue.startsWith(SECRET_PREFIX)
        ? upperValue
        : SECRET_PREFIX + upperValue;

      // Validate key format (without prefix)
      const cleanKey = finalKey.slice(SECRET_PREFIX.length);
      const validationError = validateSecretKey(cleanKey);
      if (validationError) {
        setKeyErrors({ ...keyErrors, [index]: validationError });
      } else {
        const newErrors = { ...keyErrors };
        delete newErrors[index];
        setKeyErrors(newErrors);
      }

      updated[index] = { ...updated[index], key: finalKey, isDirty: true };
    } else {
      updated[index] = { ...updated[index], [field]: newValue, isDirty: true };
    }

    setSecrets(updated);
    setHasChanges(true);
  };

  const deleteSecret = async (index: number) => {
    const secret = secrets[index];
    if (secret.key && selectedServerId && !secret.isNew) {
      try {
        await window.electronAPI?.deleteSecret(
          selectedServerId,
          secret.key,
          scope,
          scope === 'workspace' ? workspaceId : undefined
        );
      } catch (error) {
        console.error('Failed to delete secret:', error);
      }
    }
    setSecrets(secrets.filter((_, i) => i !== index));
    setHasChanges(true);
  };

  const saveSecrets = async () => {
    if (!selectedServerId) return;

    // Validate all keys before saving
    const validationErrors: Record<number, string> = {};
    secrets.forEach((secret, index) => {
      if (secret.key) {
        const cleanKey = secret.key.startsWith(SECRET_PREFIX)
          ? secret.key.slice(SECRET_PREFIX.length)
          : secret.key;
        const error = validateSecretKey(cleanKey);
        if (error) {
          validationErrors[index] = error;
        }
      }
    });

    if (Object.keys(validationErrors).length > 0) {
      setKeyErrors(validationErrors);
      return;
    }

    // Set loading and clear changes immediately to prevent button flickering
    setIsLoading(true);
    setHasChanges(false);

    try {
      for (const secret of secrets) {
        if ((secret.isNew || secret.isDirty) && secret.key && secret.value) {
          await window.electronAPI?.setSecret(
            selectedServerId,
            secret.key,
            secret.value,
            scope,
            scope === 'workspace' ? workspaceId : undefined
          );
        }
      }
      // Reload to get clean state (this will also set hasChanges to false)
      await loadSecrets(selectedServerId);
      setKeyErrors({});
    } catch (error) {
      console.error('Failed to save secrets:', error);
      // Restore hasChanges if save failed
      setHasChanges(true);
    } finally {
      setIsLoading(false);
    }
  };

  const toggleShowValue = (key: string) => {
    setShowValues({ ...showValues, [key]: !showValues[key] });
  };

  return (
    <div className="space-y-6 max-w-3xl">
      {/* Header with scope indicator */}
      <div className="flex items-center gap-3">
        <h2 className="text-lg font-semibold">Secrets</h2>
        <span className={`px-2 py-0.5 text-xs font-medium rounded ${scopeInfo.bg} ${scopeInfo.text}`}>
          {scopeInfo.label}
        </span>
      </div>

      {/* Server selector */}
      <div>
        <label className="block text-sm font-medium text-gray-400 mb-2">
          Select Server
        </label>
        <select
          value={selectedServerId || ''}
          onChange={(e) => setSelectedServerId(e.target.value || null)}
          className="select"
        >
          <option value="">Choose a server...</option>
          {servers.map((server) => (
            <option key={server.id} value={server.id}>
              {server.displayName}
            </option>
          ))}
        </select>
      </div>

      {/* Secrets list */}
      {selectedServerId && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-medium text-gray-400">
              Secrets for {servers.find((s) => s.id === selectedServerId)?.displayName}
            </h3>
            <div className="flex items-center gap-2">

              <button
                onClick={saveSecrets}
                disabled={isLoading || !hasChanges}
                className="btn btn-primary text-sm"
              >
                <Save className="w-4 h-4 mr-1" />
                Save
              </button>
              <button
                onClick={addSecret}
                className="btn btn-secondary text-sm"
                disabled={isLoading}
              >
                <Plus className="w-4 h-4 mr-1" />
                Add Secret
              </button>
            </div>
          </div>

          {isLoading ? (
            <div className="text-center py-8 text-gray-500">Loading...</div>
          ) : secrets.length === 0 ? (
            <div className="text-center py-8">
              <Key className="w-12 h-12 text-gray-600 mx-auto mb-3" />
              <p className="text-gray-500 mb-4">No secrets configured</p>
              <button onClick={addSecret} className="btn btn-secondary text-sm">
                <Plus className="w-4 h-4 mr-1" />
                Add Your First Secret
              </button>
            </div>
          ) : (
            <div className="space-y-3">
              {secrets.map((secret, index) => (
                <div key={index} className="card p-4">
                  <div className="flex items-center gap-4">
                    {/* Key input */}
                    <div className="flex-1">
                      <label className="block text-xs text-gray-500 mb-1">Key</label>
                      <div className="flex flex-col">
                        <input
                          type="text"
                          value={secret.key}
                          onChange={(e) => updateSecret(index, 'key', e.target.value)}
                          placeholder="SECRET_API_KEY"
                          className={`input font-mono text-sm uppercase ${keyErrors[index] ? 'border-red-500' : ''
                            }`}
                          disabled={!secret.isNew}
                          style={{ textTransform: 'uppercase' }}
                        />
                        {keyErrors[index] && (
                          <p className="text-xs text-red-400 mt-1">{keyErrors[index]}</p>
                        )}
                      </div>
                    </div>

                    {/* Value input */}
                    <div className="flex-1">
                      <label className="block text-xs text-gray-500 mb-1">Value</label>
                      <div className="relative">
                        <input
                          type={showValues[secret.key] ? 'text' : 'password'}
                          value={secret.value}
                          onChange={(e) => updateSecret(index, 'value', e.target.value)}
                          placeholder="Enter secret value"
                          className="input font-mono text-sm pr-10"
                        />
                        <button
                          type="button"
                          onClick={() => toggleShowValue(secret.key)}
                          className="absolute right-2 top-1/2 -translate-y-1/2 p-1 text-gray-500 hover:text-white"
                        >
                          {showValues[secret.key] ? (
                            <EyeOff className="w-4 h-4" />
                          ) : (
                            <Eye className="w-4 h-4" />
                          )}
                        </button>
                      </div>
                    </div>

                    {/* Status indicators */}
                    <div className="flex items-center gap-2 mt-5">
                      {secret.isNew && (
                        <span className="px-2 py-0.5 text-xs font-medium rounded bg-yellow-600 text-yellow-200">
                          New
                        </span>
                      )}
                      {secret.isDirty && !secret.isNew && (
                        <span className="px-2 py-0.5 text-xs font-medium rounded bg-orange-600 text-orange-200">
                          Modified
                        </span>
                      )}

                      {/* Delete button */}
                      <button
                        onClick={() => deleteSecret(index)}
                        className="btn-icon text-red-400 hover:text-red-300"
                        title="Delete secret"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Info about secret hierarchy */}
          <div className="card p-4 bg-bg-tertiary border-dashed">
            <div className="flex items-start gap-3">
              <Info className="w-5 h-5 text-gray-500 flex-shrink-0 mt-0.5" />
              <div className="space-y-2">
                <p className="text-sm text-gray-400">
                  <strong>Secret Priority:</strong> When the server starts, secrets are merged in this order:
                </p>
                <ol className="text-sm text-gray-500 list-decimal list-inside space-y-1">
                  <li>
                    <span className={`px-1.5 py-0.5 text-xs font-medium rounded ${scopeColors.global.bg} ${scopeColors.global.text}`}>
                      Global
                    </span>
                    {' '}secrets (lowest priority)
                  </li>
                  <li>
                    <span className={`px-1.5 py-0.5 text-xs font-medium rounded ${scopeColors.workspace.bg} ${scopeColors.workspace.text}`}>
                      Workspace
                    </span>
                    {' '}secrets override global
                  </li>
                  <li>
                    <span className="px-1.5 py-0.5 text-xs font-medium rounded bg-emerald-600 text-emerald-200">
                      Server
                    </span>
                    {' '}secrets override all (highest priority)
                  </li>
                </ol>
                <p className="text-sm text-gray-500 mt-2">
                  {scope === 'global'
                    ? 'You are editing Global secrets that apply to all workspaces.'
                    : 'You are editing Workspace secrets that override Global secrets for this workspace.'}
                </p>
              </div>
            </div>
          </div>

          {/* Info about auth token */}
          <div className="card p-4 bg-bg-tertiary border-dashed">
            <div className="flex items-start gap-3">
              <Key className="w-5 h-5 text-gray-500 flex-shrink-0 mt-0.5" />
              <div>
                <p className="text-sm text-gray-400">
                  <strong>SECRET_MCP_AUTH_TOKEN</strong> is a special secret that gets passed
                  to the server for authentication. Set it here to authenticate with servers
                  that require it.
                </p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* No server selected */}
      {!selectedServerId && servers.length > 0 && (
        <div className="text-center py-12">
          <Key className="w-12 h-12 text-gray-600 mx-auto mb-3" />
          <p className="text-gray-500">Select a server to manage its secrets</p>
        </div>
      )}

      {/* No servers */}
      {servers.length === 0 && (
        <div className="text-center py-12">
          <p className="text-gray-500">Add a server first to manage secrets</p>
        </div>
      )}
    </div>
  );
}
