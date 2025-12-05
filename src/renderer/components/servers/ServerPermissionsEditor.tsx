/**
 * Server Permissions Editor - UI for managing server environment permissions
 */

import { useState, useEffect } from 'react';
import {
  Shield,
  ShieldAlert,
  ShieldCheck,
  FolderOpen,
  Globe,
  Key,
  Terminal,
  Home,
  Languages,
  Thermometer,
  Code,
  Plus,
  X,
  Loader2,
  AlertTriangle,
  Info,
  Sparkles,
} from 'lucide-react';
import type {
  ServerPermissions,
  EnvPermissions,
  ContextPermissions,
  SecretsPermissions,
  AIPermissions,
} from '../../../shared/types';
import { DEFAULT_SERVER_PERMISSIONS, DEFAULT_AI_PERMISSIONS } from '../../../shared/types';
import { cn } from '../../lib/utils';
import { getApiBase } from '../../lib/api';

interface ServerPermissionsEditorProps {
  serverId: string;
  workspaceId: string;
  serverName: string;
}

type TabId = 'global' | 'workspace';

export function ServerPermissionsEditor({
  serverId,
  workspaceId,
  serverName,
}: ServerPermissionsEditorProps) {
  const [activeTab, setActiveTab] = useState<TabId>('global');
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Permissions state
  const [globalPermissions, setGlobalPermissions] = useState<ServerPermissions | null>(null);
  const [workspaceOverride, setWorkspaceOverride] = useState<Partial<ServerPermissions> | null>(null);
  const [isLegacy, setIsLegacy] = useState(false);

  // Current editing state
  const [editingPermissions, setEditingPermissions] = useState<ServerPermissions>(DEFAULT_SERVER_PERMISSIONS);
  const [hasChanges, setHasChanges] = useState(false);

  // Custom env variable input
  const [newEnvVar, setNewEnvVar] = useState('');

  // Load permissions on mount
  useEffect(() => {
    loadPermissions();
  }, [serverId, workspaceId]);

  // Update editing permissions when tab changes
  useEffect(() => {
    if (activeTab === 'global') {
      setEditingPermissions(globalPermissions || DEFAULT_SERVER_PERMISSIONS);
    } else {
      // For workspace tab, show merged or global as base
      if (workspaceOverride) {
        const merged: ServerPermissions = {
          env: { ...(globalPermissions?.env || DEFAULT_SERVER_PERMISSIONS.env), ...workspaceOverride.env },
          context: { ...(globalPermissions?.context || DEFAULT_SERVER_PERMISSIONS.context), ...workspaceOverride.context },
          secrets: workspaceOverride.secrets || globalPermissions?.secrets || DEFAULT_SERVER_PERMISSIONS.secrets,
        };
        setEditingPermissions(merged);
      } else {
        setEditingPermissions(globalPermissions || DEFAULT_SERVER_PERMISSIONS);
      }
    }
    setHasChanges(false);
  }, [activeTab, globalPermissions, workspaceOverride]);

  const loadPermissions = async () => {
    setIsLoading(true);
    setError(null);

    try {
      const response = await fetch(`${getApiBase()}/servers/${serverId}/permissions/${workspaceId}`);
      const data = await response.json();

      if (data.success) {
        setGlobalPermissions(data.data.globalPermissions);
        setWorkspaceOverride(data.data.workspaceOverride);
        setIsLegacy(data.data.isLegacy);
      } else {
        setError(data.error || 'Failed to load permissions');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load permissions');
    } finally {
      setIsLoading(false);
    }
  };

  const savePermissions = async () => {
    setIsSaving(true);
    setError(null);

    try {
      if (activeTab === 'global') {
        // Save global permissions
        const response = await fetch(`${getApiBase()}/servers/${serverId}/permissions`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ permissions: editingPermissions }),
        });
        const data = await response.json();

        if (!data.success) {
          throw new Error(data.error || 'Failed to save');
        }

        setGlobalPermissions(editingPermissions);
        setIsLegacy(false);
      } else {
        // Save workspace override
        const response = await fetch(`${getApiBase()}/servers/${serverId}/permissions/${workspaceId}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ permissionsOverride: editingPermissions }),
        });
        const data = await response.json();

        if (!data.success) {
          throw new Error(data.error || 'Failed to save');
        }

        setWorkspaceOverride(editingPermissions);
      }

      setHasChanges(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save permissions');
    } finally {
      setIsSaving(false);
    }
  };

  const resetWorkspaceOverride = async () => {
    setIsSaving(true);
    setError(null);

    try {
      const response = await fetch(`${getApiBase()}/servers/${serverId}/permissions/${workspaceId}`, {
        method: 'DELETE',
      });
      const data = await response.json();

      if (!data.success) {
        throw new Error(data.error || 'Failed to reset');
      }

      setWorkspaceOverride(null);
      setEditingPermissions(globalPermissions || DEFAULT_SERVER_PERMISSIONS);
      setHasChanges(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to reset permissions');
    } finally {
      setIsSaving(false);
    }
  };

  const updateEnv = (key: keyof EnvPermissions, value: boolean | string[]) => {
    setEditingPermissions((prev) => ({
      ...prev,
      env: { ...prev.env, [key]: value },
    }));
    setHasChanges(true);
  };

  const updateContext = (key: keyof ContextPermissions, value: boolean) => {
    setEditingPermissions((prev) => ({
      ...prev,
      context: { ...prev.context, [key]: value },
    }));
    setHasChanges(true);
  };

  const updateSecrets = (updates: Partial<SecretsPermissions>) => {
    setEditingPermissions((prev) => ({
      ...prev,
      secrets: { ...prev.secrets, ...updates },
    }));
    setHasChanges(true);
  };

  const updateAI = (updates: Partial<AIPermissions>) => {
    setEditingPermissions((prev) => ({
      ...prev,
      ai: { ...(prev.ai || DEFAULT_AI_PERMISSIONS), ...updates },
    }));
    setHasChanges(true);
  };

  const addCustomEnvVar = () => {
    const trimmed = newEnvVar.trim().toUpperCase();
    if (trimmed && !editingPermissions.env.customAllowlist.includes(trimmed)) {
      updateEnv('customAllowlist', [...editingPermissions.env.customAllowlist, trimmed]);
      setNewEnvVar('');
    }
  };

  const removeCustomEnvVar = (varName: string) => {
    updateEnv(
      'customAllowlist',
      editingPermissions.env.customAllowlist.filter((v) => v !== varName)
    );
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="w-6 h-6 animate-spin text-gray-400" />
        <span className="ml-2 text-gray-400">Loading permissions...</span>
      </div>
    );
  }

  const isWorkspaceTab = activeTab === 'workspace';
  const showWorkspaceTab = workspaceId !== 'global';

  return (
    <div className="space-y-6">
      {/* Legacy Warning */}
      {isLegacy && (
        <div className="flex items-start gap-3 p-4 rounded-lg bg-amber-500/10 border border-amber-500/30">
          <ShieldAlert className="w-5 h-5 text-amber-400 flex-shrink-0 mt-0.5" />
          <div>
            <h4 className="text-sm font-medium text-amber-400">Unrestricted Access</h4>
            <p className="text-xs text-amber-400/80 mt-1">
              This server has no permissions configured and uses legacy behavior with full access
              to all environment variables, workspace data, and secrets. Configure permissions below
              to improve security.
            </p>
          </div>
        </div>
      )}

      {/* Error Display */}
      {error && (
        <div className="flex items-start gap-3 p-4 rounded-lg bg-red-500/10 border border-red-500/30">
          <AlertTriangle className="w-5 h-5 text-red-400 flex-shrink-0 mt-0.5" />
          <div>
            <h4 className="text-sm font-medium text-red-400">Error</h4>
            <p className="text-xs text-red-400/80 mt-1">{error}</p>
          </div>
        </div>
      )}

      {/* Tabs */}
      {showWorkspaceTab && (
        <div className="flex gap-1 p-1 bg-gray-800 rounded-lg">
          <button
            onClick={() => setActiveTab('global')}
            className={cn(
              'flex-1 flex items-center justify-center gap-2 px-4 py-2 text-sm font-medium rounded-md transition-colors',
              activeTab === 'global'
                ? 'bg-gray-700 text-white'
                : 'text-gray-400 hover:text-white'
            )}
          >
            <Globe className="w-4 h-4" />
            Global Settings
          </button>
          <button
            onClick={() => setActiveTab('workspace')}
            className={cn(
              'flex-1 flex items-center justify-center gap-2 px-4 py-2 text-sm font-medium rounded-md transition-colors',
              activeTab === 'workspace'
                ? 'bg-gray-700 text-white'
                : 'text-gray-400 hover:text-white'
            )}
          >
            <FolderOpen className="w-4 h-4" />
            Workspace Override
          </button>
        </div>
      )}

      {/* Info about current mode */}
      <div className="flex items-start gap-2 p-3 rounded-lg bg-gray-800/50 text-xs text-gray-400">
        <Info className="w-4 h-4 flex-shrink-0 mt-0.5" />
        <span>
          {isWorkspaceTab
            ? 'Workspace overrides inherit from global settings. Changes here only affect this workspace.'
            : 'Global settings apply to all workspaces unless overridden at workspace level.'}
        </span>
      </div>

      {/* Environment Variables Section */}
      <section className="space-y-4">
        <div className="flex items-center gap-2">
          <Terminal className="w-5 h-5 text-gray-400" />
          <h3 className="text-sm font-medium text-white">System Environment Variables</h3>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <PermissionToggle
            icon={<FolderOpen className="w-4 h-4" />}
            label="PATH Variables"
            description="PATH, PATHEXT, SystemRoot"
            checked={editingPermissions.env.allowPath}
            onChange={(v) => updateEnv('allowPath', v)}
          />
          <PermissionToggle
            icon={<Home className="w-4 h-4" />}
            label="Home Directory"
            description="HOME, USERPROFILE, HOMEPATH"
            checked={editingPermissions.env.allowHome}
            onChange={(v) => updateEnv('allowHome', v)}
          />
          <PermissionToggle
            icon={<Languages className="w-4 h-4" />}
            label="Language/Locale"
            description="LANG, LANGUAGE, LC_*"
            checked={editingPermissions.env.allowLang}
            onChange={(v) => updateEnv('allowLang', v)}
          />
          <PermissionToggle
            icon={<Thermometer className="w-4 h-4" />}
            label="Temp Directories"
            description="TEMP, TMP, TMPDIR"
            checked={editingPermissions.env.allowTemp}
            onChange={(v) => updateEnv('allowTemp', v)}
          />
          <PermissionToggle
            icon={<Code className="w-4 h-4" />}
            label="Node.js Variables"
            description="NODE_*, npm_*, NPM_*"
            checked={editingPermissions.env.allowNode}
            onChange={(v) => updateEnv('allowNode', v)}
          />
        </div>

        {/* Custom Allowlist */}
        <div className="p-4 rounded-lg bg-gray-800/50 space-y-3">
          <label className="text-sm text-gray-300">Custom Variables Allowlist</label>
          <div className="flex gap-2">
            <input
              type="text"
              value={newEnvVar}
              onChange={(e) => setNewEnvVar(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && addCustomEnvVar()}
              placeholder="VARIABLE_NAME"
              className="flex-1 px-3 py-2 bg-bg-secondary border border-border-default rounded-md text-sm text-white placeholder-gray-400 focus:outline-none focus:border-blue-500"
            />
            <button
              onClick={addCustomEnvVar}
              className="px-3 py-2 bg-gray-700 text-white rounded-md hover:bg-gray-600 transition-colors"
            >
              <Plus className="w-4 h-4" />
            </button>
          </div>
          {editingPermissions.env.customAllowlist.length > 0 && (
            <div className="flex flex-wrap gap-2">
              {editingPermissions.env.customAllowlist.map((varName) => (
                <span
                  key={varName}
                  className="flex items-center gap-1 px-2 py-1 bg-gray-700 rounded text-xs text-gray-300"
                >
                  {varName}
                  <button
                    onClick={() => removeCustomEnvVar(varName)}
                    className="text-gray-500 hover:text-white"
                  >
                    <X className="w-3 h-3" />
                  </button>
                </span>
              ))}
            </div>
          )}
        </div>
      </section>

      {/* Context Section */}
      <section className="space-y-4">
        <div className="flex items-center gap-2">
          <FolderOpen className="w-5 h-5 text-gray-400" />
          <h3 className="text-sm font-medium text-white">Workspace Context</h3>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <PermissionToggle
            icon={<FolderOpen className="w-4 h-4" />}
            label="Project Root Path"
            description="MCP_PROJECT_ROOT"
            checked={editingPermissions.context.allowProjectRoot}
            onChange={(v) => updateContext('allowProjectRoot', v)}
          />
          <PermissionToggle
            icon={<Globe className="w-4 h-4" />}
            label="Workspace ID"
            description="MCP_WORKSPACE_ID"
            checked={editingPermissions.context.allowWorkspaceId}
            onChange={(v) => updateContext('allowWorkspaceId', v)}
          />
          <PermissionToggle
            icon={<Shield className="w-4 h-4" />}
            label="User Profile"
            description="Email & name in MCP_AUTH_TOKEN"
            checked={editingPermissions.context.allowUserProfile}
            onChange={(v) => updateContext('allowUserProfile', v)}
          />
        </div>
      </section>

      {/* Secrets Section */}
      <section className="space-y-4">
        <div className="flex items-center gap-2">
          <Key className="w-5 h-5 text-gray-400" />
          <h3 className="text-sm font-medium text-white">Secrets Access</h3>
        </div>

        <div className="space-y-3">
          <RadioOption
            selected={editingPermissions.secrets.mode === 'none'}
            onSelect={() => updateSecrets({ mode: 'none' })}
            label="No Secrets"
            description="Server cannot access any secrets"
          />

          <RadioOption
            selected={editingPermissions.secrets.mode === 'allowlist'}
            onSelect={() => updateSecrets({ mode: 'allowlist' })}
            label="Selected Secrets Only"
            description="Only explicitly allowed secrets are passed"
          />

          <RadioOption
            selected={editingPermissions.secrets.mode === 'all'}
            onSelect={() => updateSecrets({ mode: 'all' })}
            label="All Secrets"
            description="All available secrets are passed to server"
            badge="Not Recommended"
          />
        </div>

        {/* Secrets Allowlist (when mode is 'allowlist') */}
        {editingPermissions.secrets.mode === 'allowlist' && (
          <SecretsAllowlistEditor
            allowlist={editingPermissions.secrets.allowlist}
            onChange={(allowlist) => updateSecrets({ allowlist })}
          />
        )}
      </section>

      {/* AI Access Section */}
      <section className="space-y-4">
        <div className="flex items-center gap-2">
          <Sparkles className="w-5 h-5 text-teal-400" />
          <h3 className="text-sm font-medium text-white">AI Assistant Access</h3>
        </div>

        <PermissionToggle
          icon={<Sparkles className="w-4 h-4 text-teal-400" />}
          label="Allow AI Access"
          description="Server can use AI Assistant API via secure proxy"
          checked={editingPermissions.ai?.allowAccess ?? false}
          onChange={(v) => updateAI({ allowAccess: v })}
        />

        {editingPermissions.ai?.allowAccess && (
          <div className="space-y-4 pl-4 border-l-2 border-teal-500/30">
            {/* Allowed Models */}
            <AIModelsEditor
              allowedModels={editingPermissions.ai?.allowedModels ?? []}
              onChange={(models) => updateAI({ allowedModels: models })}
            />

            {/* Rate Limit */}
            <div className="p-4 rounded-lg bg-gray-800/50 space-y-2">
              <label className="text-sm text-gray-300">Rate Limit (requests/minute)</label>
              <input
                type="number"
                min="0"
                value={editingPermissions.ai?.rateLimit ?? 0}
                onChange={(e) => updateAI({ rateLimit: parseInt(e.target.value) || 0 })}
                placeholder="0 = unlimited"
                className="w-full px-3 py-2 bg-bg-secondary border border-border-default rounded-md text-sm text-white placeholder-gray-400 focus:outline-none focus:border-teal-500 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
              />
              <p className="text-xs text-gray-500">
                Set to 0 for unlimited requests. Recommended: 10-60 per minute.
              </p>
            </div>
          </div>
        )}
      </section>

      {/* Actions */}
      <div className="flex items-center justify-between pt-4 border-t border-gray-700">
        <div>
          {isWorkspaceTab && workspaceOverride && (
            <button
              onClick={resetWorkspaceOverride}
              disabled={isSaving}
              className="px-4 py-2 text-sm text-gray-400 hover:text-white transition-colors"
            >
              Reset to Global
            </button>
          )}
        </div>
        <div className="flex items-center gap-3">
          {hasChanges && (
            <span className="text-xs text-amber-400">Unsaved changes</span>
          )}
          <button
            onClick={savePermissions}
            disabled={isSaving || !hasChanges}
            className={cn(
              'flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition-colors',
              hasChanges
                ? 'bg-blue-500 text-white hover:bg-blue-600'
                : 'bg-gray-700 text-gray-400 cursor-not-allowed'
            )}
          >
            {isSaving ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                Saving...
              </>
            ) : (
              <>
                <ShieldCheck className="w-4 h-4" />
                Save Permissions
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}

// Toggle component for permissions
interface PermissionToggleProps {
  icon: React.ReactNode;
  label: string;
  description: string;
  checked: boolean;
  onChange: (value: boolean) => void;
}

function PermissionToggle({ icon, label, description, checked, onChange }: PermissionToggleProps) {
  return (
    <label className="flex items-center gap-3 p-3 rounded-lg bg-gray-800/50 cursor-pointer hover:bg-gray-800 transition-colors">
      <div className="text-gray-400">{icon}</div>
      <div className="flex-1 min-w-0">
        <span className="text-sm text-white">{label}</span>
        <p className="text-xs text-gray-500 truncate">{description}</p>
      </div>
      <input
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        className="w-4 h-4 text-blue-500 bg-gray-700 border-gray-600 rounded focus:ring-blue-500"
      />
    </label>
  );
}

// Secrets allowlist editor
interface SecretsAllowlistEditorProps {
  allowlist: string[];
  onChange: (allowlist: string[]) => void;
}

function SecretsAllowlistEditor({ allowlist, onChange }: SecretsAllowlistEditorProps) {
  const [newSecret, setNewSecret] = useState('');

  const addSecret = () => {
    const trimmed = newSecret.trim();
    const formatted = trimmed.startsWith('SECRET_') ? trimmed : `SECRET_${trimmed}`;
    if (formatted && !allowlist.includes(formatted)) {
      onChange([...allowlist, formatted]);
      setNewSecret('');
    }
  };

  const removeSecret = (key: string) => {
    onChange(allowlist.filter((k) => k !== key));
  };

  return (
    <div className="p-4 rounded-lg bg-gray-800/50 space-y-3">
      <label className="text-sm text-gray-300">Allowed Secrets</label>
      <div className="flex gap-2">
        <input
          type="text"
          value={newSecret}
          onChange={(e) => setNewSecret(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && addSecret()}
          placeholder="SECRET_NAME or just NAME"
          className="flex-1 px-3 py-2 bg-bg-secondary border border-border-default rounded-md text-sm text-white placeholder-gray-400 focus:outline-none focus:border-blue-500"
        />
        <button
          onClick={addSecret}
          className="px-3 py-2 bg-gray-700 text-white rounded-md hover:bg-gray-600 transition-colors"
        >
          <Plus className="w-4 h-4" />
        </button>
      </div>
      {allowlist.length > 0 ? (
        <div className="flex flex-wrap gap-2">
          {allowlist.map((key) => (
            <span
              key={key}
              className="flex items-center gap-1 px-2 py-1 bg-gray-700 rounded text-xs text-gray-300"
            >
              <Key className="w-3 h-3" />
              {key}
              <button
                onClick={() => removeSecret(key)}
                className="text-gray-500 hover:text-white"
              >
                <X className="w-3 h-3" />
              </button>
            </span>
          ))}
        </div>
      ) : (
        <p className="text-xs text-gray-500">No secrets allowed yet. Add secret keys above.</p>
      )}
    </div>
  );
}

// Radio option component for dark theme
interface RadioOptionProps {
  selected: boolean;
  onSelect: () => void;
  label: string;
  description: string;
  badge?: string;
}

function RadioOption({ selected, onSelect, label, description, badge }: RadioOptionProps) {
  return (
    <button
      type="button"
      onClick={onSelect}
      className={cn(
        'flex items-center gap-3 p-3 rounded-lg w-full text-left transition-colors',
        selected ? 'bg-blue-500/10 border border-blue-500/50' : 'bg-gray-800/50 border border-transparent hover:bg-gray-800'
      )}
    >
      {/* Custom radio circle */}
      <div
        className={cn(
          'w-4 h-4 rounded-full border-2 flex items-center justify-center flex-shrink-0',
          selected ? 'border-blue-500' : 'border-gray-500'
        )}
      >
        {selected && <div className="w-2 h-2 rounded-full bg-blue-500" />}
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className="text-sm text-white">{label}</span>
          {badge && (
            <span className="px-1.5 py-0.5 text-xs bg-amber-500/20 text-amber-400 rounded">
              {badge}
            </span>
          )}
        </div>
        <p className="text-xs text-gray-500">{description}</p>
      </div>
    </button>
  );
}

// AI Models editor
interface AIModelsEditorProps {
  allowedModels: string[];
  onChange: (models: string[]) => void;
}

function AIModelsEditor({ allowedModels, onChange }: AIModelsEditorProps) {
  const [newModel, setNewModel] = useState('');

  const addModel = () => {
    const trimmed = newModel.trim();
    if (trimmed && !allowedModels.includes(trimmed)) {
      onChange([...allowedModels, trimmed]);
      setNewModel('');
    }
  };

  const removeModel = (model: string) => {
    onChange(allowedModels.filter((m) => m !== model));
  };

  return (
    <div className="p-4 rounded-lg bg-gray-800/50 space-y-3">
      <label className="text-sm text-gray-300">Allowed Models</label>
      <p className="text-xs text-gray-500">
        Leave empty to only allow the default model. Add specific models to give the server more options.
      </p>
      <div className="flex gap-2">
        <input
          type="text"
          value={newModel}
          onChange={(e) => setNewModel(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && addModel()}
          placeholder="gpt-4o, gpt-3.5-turbo, etc."
          className="flex-1 px-3 py-2 bg-bg-secondary border border-border-default rounded-md text-sm text-white placeholder-gray-400 focus:outline-none focus:border-teal-500"
        />
        <button
          onClick={addModel}
          className="px-3 py-2 bg-white text-black rounded-md hover:bg-gray-200 transition-colors"
        >
          <Plus className="w-4 h-4" />
        </button>
      </div>
      {allowedModels.length > 0 ? (
        <div className="flex flex-wrap gap-2">
          {allowedModels.map((model) => (
            <span
              key={model}
              className="flex items-center gap-1 px-2 py-1 bg-teal-500/20 rounded text-xs text-teal-300"
            >
              <Sparkles className="w-3 h-3" />
              {model}
              <button
                onClick={() => removeModel(model)}
                className="text-teal-400 hover:text-white"
              >
                <X className="w-3 h-3" />
              </button>
            </span>
          ))}
        </div>
      ) : (
        <p className="text-xs text-gray-500 italic">
          No additional models. Server can only use the default model from AI Assistant settings.
        </p>
      )}
    </div>
  );
}
