import { useState, useEffect } from 'react';
import { Key, Plus, Trash2, Eye, EyeOff, Save, Info, AlertCircle, Loader2 } from 'lucide-react';

interface SecretsViewProps {
  workspaceId: string;
}

interface SecretEntry {
  key: string;
  value: string;
  isNew?: boolean;
  isDirty?: boolean;
  isDeleted?: boolean;
}

// Global secrets are stored with a special "app" serverId
const GLOBAL_SERVER_ID = '__app__';

// Scope tag colors
const scopeColors = {
  global: { bg: 'bg-gray-600', text: 'text-gray-200', label: 'Global' },
  workspace: { bg: 'bg-blue-600', text: 'text-blue-200', label: 'Workspace' },
};

export function SecretsView({ workspaceId }: SecretsViewProps) {
  const [secrets, setSecrets] = useState<SecretEntry[]>([]);
  const [showValues, setShowValues] = useState<Record<string, boolean>>({});
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [hasChanges, setHasChanges] = useState(false);
  const [keyErrors, setKeyErrors] = useState<Record<number, string>>({});
  const [error, setError] = useState<string | null>(null);

  // Determine scope based on workspaceId
  const isGlobal = workspaceId === 'global';
  const scope = isGlobal ? 'global' : 'workspace';
  const scopeInfo = isGlobal ? scopeColors.global : scopeColors.workspace;

  // Prefix for secret keys
  const SECRET_PREFIX = 'SECRET_';

  // Validate secret key format
  const validateSecretKey = (key: string): string | null => {
    if (!key) return null;

    const validPattern = /^[A-Za-z0-9_-]+$/;
    if (!validPattern.test(key)) {
      return 'Key can only contain letters, numbers, underscore (_), and hyphen (-)';
    }

    return null;
  };

  // Load secrets on mount
  useEffect(() => {
    loadSecrets();
  }, [workspaceId]);

  const loadSecrets = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const serverSecrets = await window.electronAPI?.getSecrets(
        GLOBAL_SERVER_ID,
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
    } catch (err) {
      console.error('Failed to load secrets:', err);
      setError('Failed to load secrets');
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

      // Remove SECRET_ prefix if user accidentally typed it
      const cleanKey = upperValue.startsWith(SECRET_PREFIX)
        ? upperValue.slice(SECRET_PREFIX.length)
        : upperValue;

      // Validate key format
      const validationError = validateSecretKey(cleanKey);
      if (validationError) {
        setKeyErrors({ ...keyErrors, [index]: validationError });
      } else {
        const newErrors = { ...keyErrors };
        delete newErrors[index];
        setKeyErrors(newErrors);
      }

      updated[index] = { ...updated[index], key: SECRET_PREFIX + cleanKey, isDirty: true };
    } else {
      updated[index] = { ...updated[index], [field]: newValue, isDirty: true };
    }

    setSecrets(updated);
    setHasChanges(true);
  };

  // Get display key (without SECRET_ prefix) for input field
  const getDisplayKey = (key: string): string => {
    return key.startsWith(SECRET_PREFIX) ? key.slice(SECRET_PREFIX.length) : key;
  };

  const deleteSecret = (index: number) => {
    const secret = secrets[index];
    if (secret.isNew) {
      // New secrets can be removed immediately (not saved yet)
      setSecrets(secrets.filter((_, i) => i !== index));
    } else {
      // Mark existing secrets for deletion on save
      const updated = [...secrets];
      updated[index] = { ...updated[index], isDeleted: true };
      setSecrets(updated);
    }
    setHasChanges(true);
  };

  const cancelChanges = () => {
    loadSecrets();
    setKeyErrors({});
    setError(null);
  };

  const saveSecrets = async () => {
    // Validate all keys before saving (skip deleted ones)
    const validationErrors: Record<number, string> = {};
    secrets.forEach((secret, index) => {
      if (secret.key && !secret.isDeleted) {
        const displayKey = getDisplayKey(secret.key);
        const err = validateSecretKey(displayKey);
        if (err) {
          validationErrors[index] = err;
        }
      }
    });

    if (Object.keys(validationErrors).length > 0) {
      setKeyErrors(validationErrors);
      setError('Please fix validation errors before saving');
      return;
    }

    setIsSaving(true);
    setError(null);
    setHasChanges(false);

    try {
      for (const secret of secrets) {
        // Delete marked secrets
        if (secret.isDeleted && secret.key) {
          await window.electronAPI?.deleteSecret(
            GLOBAL_SERVER_ID,
            secret.key,
            scope,
            scope === 'workspace' ? workspaceId : undefined
          );
          continue;
        }

        // Save new or modified secrets
        if ((secret.isNew || secret.isDirty) && secret.key && secret.value) {
          await window.electronAPI?.setSecret(
            GLOBAL_SERVER_ID,
            secret.key,
            secret.value,
            scope,
            scope === 'workspace' ? workspaceId : undefined
          );
        }
      }
      await loadSecrets();
      setKeyErrors({});
    } catch (err) {
      console.error('Failed to save secrets:', err);
      setError('Failed to save secrets');
      setHasChanges(true);
    } finally {
      setIsSaving(false);
    }
  };

  const toggleShowValue = (key: string) => {
    setShowValues({ ...showValues, [key]: !showValues[key] });
  };

  // Loading state
  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="flex flex-col items-center gap-3">
          <Loader2 className="w-8 h-8 animate-spin text-gray-500" />
          <p className="text-sm text-gray-500">Loading secrets...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      {/* Header - full width */}
      <div className="flex flex-wrap items-center justify-between gap-3 mb-6">
        <div className="flex items-center gap-3">
          <h3 className="text-sm font-medium text-gray-400">
            {isGlobal ? 'Global Secrets' : 'Workspace Secrets'}
          </h3>
          <span
            className={`px-2 py-0.5 text-xs font-medium rounded ${scopeInfo.bg} ${scopeInfo.text}`}
          >
            {scopeInfo.label}
          </span>
        </div>
        <div className="flex items-center gap-2">
          {hasChanges && (
            <button
              onClick={cancelChanges}
              disabled={isSaving}
              className="btn btn-secondary text-sm"
            >
              Cancel
            </button>
          )}
          <button
            onClick={saveSecrets}
            disabled={isSaving || !hasChanges}
            className="btn btn-primary text-sm"
          >
            <Save className="w-4 h-4 sm:mr-1" />
            <span className="hidden sm:inline">Save</span>
          </button>
          <button onClick={addSecret} className="btn btn-secondary text-sm" disabled={isSaving}>
            <Plus className="w-4 h-4 sm:mr-1" />
            <span className="hidden sm:inline">Add Secret</span>
          </button>
        </div>
      </div>

      {/* Scrollable content */}
      <div className="flex-1 overflow-y-auto custom-scrollbar">
        <div className="max-w-3xl mx-auto space-y-6">
          {/* Error message */}
          {error && (
            <div className="card p-4 bg-red-950/30 border-red-900">
              <div className="flex items-center gap-2 text-red-400">
                <AlertCircle className="w-5 h-5" />
                <span>{error}</span>
              </div>
            </div>
          )}

          {/* Secrets list */}
          {isLoading ? (
            <div className="text-center py-12 text-gray-500">Loading secrets...</div>
          ) : secrets.filter(s => !s.isDeleted).length === 0 ? (
            <div className="flex items-center justify-center min-h-[260px]">
              <div className="text-center max-w-md">
                <h3 className="text-xl font-semibold text-white mb-2">No Secrets Configured</h3>
                <p className="text-gray-400 mb-6 leading-relaxed">
                  {isGlobal
                    ? 'Add secrets to securely store API keys, tokens, and other sensitive information that will be available to all MCP servers.'
                    : 'Add workspace-specific secrets that will override global secrets for this workspace. Leave empty to use global secrets.'}
                </p>
                <p className="text-sm text-gray-500 mb-4">
                  Use the "Add Secret" button above to get started.
                </p>
              </div>
            </div>
          ) : (
            <div className="space-y-3">
              {secrets.map((secret, index) => secret.isDeleted ? null : (
                <div key={index} className="card p-4">
                  {/* Responsive: stack on mobile, row on larger screens */}
                  <div className="flex flex-col sm:flex-row sm:items-start gap-4">
                    {/* Key input with SECRET_ prefix */}
                    <div className="flex-1 min-w-0">
                      <label className="block text-xs text-gray-500 mb-1">Key</label>
                      <div className="flex">
                        <span className="inline-flex items-center px-2 sm:px-3 text-xs sm:text-sm font-mono text-gray-400 bg-bg-tertiary border border-r-0 border-border-default rounded-l-md select-none whitespace-nowrap">
                          SECRET_
                        </span>
                        <input
                          type="text"
                          value={getDisplayKey(secret.key)}
                          onChange={(e) => updateSecret(index, 'key', e.target.value)}
                          placeholder="API_KEY"
                          className={`input font-mono text-sm rounded-l-none flex-1 min-w-0 uppercase ${
                            keyErrors[index] ? 'border-red-500' : ''
                          }`}
                          disabled={!secret.isNew}
                          style={{ textTransform: 'uppercase' }}
                        />
                      </div>
                      {/* Validation error - absolute position to not affect layout */}
                      <div className="h-5">
                        {keyErrors[index] && (
                          <p className="text-xs text-red-400 mt-1">{keyErrors[index]}</p>
                        )}
                      </div>
                    </div>

                    {/* Value input */}
                    <div className="flex-1 min-w-0">
                      <label className="block text-xs text-gray-500 mb-1">Value</label>
                      <div className="relative">
                        <input
                          type={showValues[secret.key] ? 'text' : 'password'}
                          value={secret.value}
                          onChange={(e) => updateSecret(index, 'value', e.target.value)}
                          placeholder="Enter secret value"
                          className="input font-mono text-sm pr-10 w-full"
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
                      {/* Spacer to align with key input's validation area */}
                      <div className="h-5" />
                    </div>

                    {/* Status indicators and delete */}
                    <div className="flex items-center gap-2 sm:mt-6 justify-end sm:justify-start">
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
                  <strong>Secret Priority:</strong> When a server starts, secrets are merged in this
                  order:
                </p>
                <ol className="text-sm text-gray-500 list-decimal list-inside space-y-1">
                  <li>
                    <span className="px-1.5 py-0.5 text-xs font-medium rounded bg-gray-600 text-gray-200">
                      Global
                    </span>{' '}
                    secrets (lowest priority)
                  </li>
                  {!isGlobal && (
                    <li>
                      <span className="px-1.5 py-0.5 text-xs font-medium rounded bg-blue-600 text-blue-200">
                        Workspace
                      </span>{' '}
                      secrets override global
                    </li>
                  )}
                  <li>
                    <span className="px-1.5 py-0.5 text-xs font-medium rounded bg-emerald-600 text-emerald-200">
                      Server
                    </span>{' '}
                    secrets override {isGlobal ? 'global' : 'workspace'} (highest priority)
                  </li>
                </ol>
                <p className="text-sm text-gray-500 mt-2">
                  {isGlobal
                    ? 'Global secrets apply to all workspaces unless overridden.'
                    : 'Workspace secrets override global secrets. Use "Reset to Global" to clear workspace-specific secrets.'}
                </p>
              </div>
            </div>
          </div>

          {/* SECRET_ prefix info */}
          <div className="card p-4 bg-bg-tertiary border-dashed">
            <div className="flex items-start gap-3">
              <Key className="w-5 h-5 text-gray-500 flex-shrink-0 mt-0.5" />
              <div className="space-y-2">
                <p className="text-sm text-gray-400">
                  <strong>SECRET_ Prefix:</strong> All secrets are automatically prefixed with{' '}
                  <code className="px-1.5 py-0.5 bg-bg-secondary rounded text-xs font-mono">
                    SECRET_
                  </code>{' '}
                  to prevent conflicts when merging environment variables.
                </p>
                <p className="text-sm text-gray-500">
                  Example: Enter{' '}
                  <code className="px-1 py-0.5 bg-bg-secondary rounded text-xs font-mono">
                    OPENAI_API_KEY
                  </code>{' '}
                  → stored as{' '}
                  <code className="px-1 py-0.5 bg-bg-secondary rounded text-xs font-mono">
                    SECRET_OPENAI_API_KEY
                  </code>
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
