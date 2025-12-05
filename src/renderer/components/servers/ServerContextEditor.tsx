import React, { useState, useEffect } from 'react';
import { Save, AlertCircle, CheckCircle, Info, Loader2 } from 'lucide-react';
import { getApiBase } from '../../lib/api';

interface ServerContextEditorProps {
  serverId: string;
  workspaceId: string;
  /** Header names declared by server (e.g., ['project-id', 'api-key']) */
  contextHeaders: string[];
}

export function ServerContextEditor({
  serverId,
  workspaceId,
  contextHeaders,
}: ServerContextEditorProps) {
  const [values, setValues] = useState<Record<string, string>>({});
  const [originalValues, setOriginalValues] = useState<Record<string, string>>({});
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [hasChanges, setHasChanges] = useState(false);

  // Load current context values on mount
  useEffect(() => {
    loadContextValues();
  }, [serverId, workspaceId]);

  // Check for changes
  useEffect(() => {
    if (isLoading) return;
    const changed = JSON.stringify(values) !== JSON.stringify(originalValues);
    setHasChanges(changed);
  }, [values, originalValues, isLoading]);

  const loadContextValues = async () => {
    setIsLoading(true);
    try {
      const response = await fetch(
        `${getApiBase()}/workspaces/${workspaceId}/servers/${serverId}/config`
      );
      if (response.ok) {
        const data = await response.json();
        if (data.success && data.config?.contextHeaders) {
          setValues(data.config.contextHeaders);
          setOriginalValues(data.config.contextHeaders);
        }
      }
    } catch {
      // Use empty values if not found
    }
    setIsLoading(false);
  };

  const handleSave = async () => {
    setIsSaving(true);
    setError(null);
    setSuccess(null);

    try {
      const response = await fetch(
        `${getApiBase()}/workspaces/${workspaceId}/servers/${serverId}`,
        {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ contextHeaders: values }),
        }
      );

      const data = await response.json();
      if (!data.success) {
        throw new Error(data.error || 'Failed to save context headers');
      }

      setOriginalValues(values);
      setSuccess('Context headers saved successfully');
      setTimeout(() => setSuccess(null), 3000);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save');
    }

    setIsSaving(false);
  };

  const handleReset = () => {
    setValues(originalValues);
    setError(null);
    setSuccess(null);
  };

  const updateValue = (key: string, value: string) => {
    setValues((prev) => ({ ...prev, [key]: value }));
  };

  // Format header name for display (project-id -> Project Id)
  const formatHeaderName = (name: string): string => {
    return name
      .split('-')
      .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
      .join(' ');
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-32">
        <Loader2 className="w-6 h-6 animate-spin text-gray-500" />
      </div>
    );
  }

  if (!contextHeaders || contextHeaders.length === 0) {
    return (
      <div className="card p-4 bg-bg-tertiary border-dashed">
        <div className="flex items-start gap-3">
          <Info className="w-5 h-5 text-gray-500 flex-shrink-0 mt-0.5" />
          <div>
            <p className="text-sm text-gray-400">
              This server does not declare any custom context headers.
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Status messages */}
      {error && (
        <div className="card p-3 bg-red-950/30 border-red-900">
          <div className="flex items-center gap-2 text-red-400 text-sm">
            <AlertCircle className="w-4 h-4" />
            <span>{error}</span>
          </div>
        </div>
      )}

      {success && (
        <div className="card p-3 bg-emerald-950/30 border-emerald-900">
          <div className="flex items-center gap-2 text-emerald-400 text-sm">
            <CheckCircle className="w-4 h-4" />
            <span>{success}</span>
          </div>
        </div>
      )}

      {/* Header fields */}
      <div className="space-y-3">
        {contextHeaders.map((header) => (
          <div key={header} className="space-y-1">
            <label className="text-sm font-medium text-gray-400">
              {formatHeaderName(header)}
            </label>
            <input
              type="text"
              value={values[header] || ''}
              onChange={(e) => updateValue(header, e.target.value)}
              className="input font-mono text-sm w-full"
              placeholder={`Enter ${header}...`}
            />
            <p className="text-xs text-gray-500">
              Sent as <code className="bg-bg-tertiary px-1 rounded">X-MCP-CTX-{header}</code> header
            </p>
          </div>
        ))}
      </div>

      {/* Info */}
      <div className="card p-3 bg-bg-tertiary border-dashed">
        <div className="flex items-start gap-2">
          <Info className="w-4 h-4 text-gray-500 flex-shrink-0 mt-0.5" />
          <p className="text-xs text-gray-500">
            These values are sent with every request to the server through the MCP Gateway.
            The server uses them to identify the workspace context.
          </p>
        </div>
      </div>

      {/* Actions */}
      {hasChanges && (
        <div className="flex items-center gap-3 pt-2">
          <button
            onClick={handleSave}
            disabled={isSaving}
            className="btn btn-primary"
          >
            <Save className="w-4 h-4 mr-2" />
            {isSaving ? 'Saving...' : 'Save'}
          </button>
          <button onClick={handleReset} className="btn btn-secondary">
            Reset
          </button>
        </div>
      )}
    </div>
  );
}
