/**
 * AIConfigDialog - Dialog to configure AI Assistant when not set up
 */

import { useState, useEffect } from 'react';
import { X, Loader2, CheckCircle, XCircle, Eye, EyeOff, AlertCircle, Trash2 } from 'lucide-react';
import { useConfirmDialog } from '../../hooks/useDialog';
import { ConfirmDialog } from '../ui/dialogs';
import { getApiBase } from '../../lib/api';

interface AIConfigDialogProps {
  open: boolean;
  onClose: () => void;
  onConfigured: () => void;
}

export function AIConfigDialog({ open, onClose, onConfigured }: AIConfigDialogProps) {
  const [baseUrl, setBaseUrl] = useState('');
  const [apiKey, setApiKey] = useState('');
  const [defaultModel, setDefaultModel] = useState('');
  const [showApiKey, setShowApiKey] = useState(false);
  const [hasExistingKey, setHasExistingKey] = useState(false);

  const [isSaving, setIsSaving] = useState(false);
  const [isClearing, setIsClearing] = useState(false);
  const [saveResult, setSaveResult] = useState<'success' | 'error' | null>(null);
  const [errorMessage, setErrorMessage] = useState('');

  const { state: confirmState, confirm: showConfirm, cancel } = useConfirmDialog();

  // Load existing config on open
  useEffect(() => {
    if (open) {
      loadConfig();
    }
  }, [open]);

  const loadConfig = async () => {
    try {
      const response = await fetch(`${getApiBase()}/ai/config`);
      if (response.ok) {
        const data = await response.json();
        if (data.success && data.config) {
          setBaseUrl(data.config.baseUrl || '');
          setDefaultModel(data.config.defaultModel || '');
          setHasExistingKey(data.config.hasApiKey || false);
          setApiKey('');
        }
      }
    } catch {
      // Ignore errors on load
    }
  };

  const handleSave = async () => {
    // Validate
    if (!baseUrl.trim()) {
      setErrorMessage('Base URL is required');
      setSaveResult('error');
      return;
    }
    if (!defaultModel.trim()) {
      setErrorMessage('Default Model is required');
      setSaveResult('error');
      return;
    }
    if (!apiKey.trim() && !hasExistingKey) {
      setErrorMessage('API Key is required');
      setSaveResult('error');
      return;
    }

    setIsSaving(true);
    setSaveResult(null);
    setErrorMessage('');

    try {
      const response = await fetch(`${getApiBase()}/ai/verify`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          baseUrl: baseUrl.trim(),
          apiKey: apiKey.trim() || undefined,
          defaultModel: defaultModel.trim(),
        }),
      });

      const data = await response.json();

      if (data.success) {
        setSaveResult('success');
        setHasExistingKey(true);
        setApiKey('');
        // Auto close after success
        setTimeout(() => {
          onConfigured();
          onClose();
        }, 1000);
      } else {
        setSaveResult('error');
        setErrorMessage(data.error || 'Failed to verify configuration');
      }
    } catch {
      setSaveResult('error');
      setErrorMessage('Network error - failed to connect to host');
    } finally {
      setIsSaving(false);
    }
  };

  const handleClear = async () => {
    const confirmed = await showConfirm({
      title: 'Clear AI Configuration',
      description: 'Are you sure you want to clear AI configuration? This will remove the API key and all settings.',
      confirmText: 'Clear',
      cancelText: 'Cancel',
      variant: 'danger',
    });

    if (!confirmed) {
      return;
    }

    setIsClearing(true);
    setSaveResult(null);
    setErrorMessage('');

    try {
      const response = await fetch(`${getApiBase()}/ai/config`, {
        method: 'DELETE',
      });

      const data = await response.json();

      if (data.success) {
        setBaseUrl('');
        setApiKey('');
        setDefaultModel('');
        setHasExistingKey(false);
        setSaveResult('success');
        setErrorMessage('Configuration cleared');
      } else {
        setSaveResult('error');
        setErrorMessage(data.error || 'Failed to clear configuration');
      }
    } catch {
      setSaveResult('error');
      setErrorMessage('Network error - failed to connect to host');
    } finally {
      setIsClearing(false);
    }
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/70 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Dialog */}
      <div className="relative bg-bg-primary border border-border-default rounded-lg shadow-xl w-full max-w-md mx-4">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-border-default">
          <div className="flex items-center gap-2">
            <AlertCircle className="w-5 h-5 text-yellow-500" />
            <h2 className="text-lg font-semibold">Configure AI Assistant</h2>
          </div>
          <button
            onClick={onClose}
            className="p-1 text-gray-400 hover:text-white transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-4 space-y-4">
          <p className="text-sm text-gray-400">
            AI Assistant is not configured. Please set up your OpenAI-compatible API
            provider to use AI features.
          </p>

          {/* Base URL */}
          <div>
            <label className="block text-sm font-medium text-gray-400 mb-1.5">
              Base URL <span className="text-red-400">*</span>
            </label>
            <input
              type="text"
              value={baseUrl}
              onChange={(e) => setBaseUrl(e.target.value)}
              placeholder="https://api.openai.com/v1"
              className="input w-full"
            />
          </div>

          {/* API Key */}
          <div>
            <label className="block text-sm font-medium text-gray-400 mb-1.5">
              API Key <span className="text-red-400">*</span>
              {hasExistingKey && (
                <span className="ml-2 text-xs text-green-500">(saved)</span>
              )}
            </label>
            <div className="relative">
              <input
                type={showApiKey ? 'text' : 'password'}
                value={apiKey}
                onChange={(e) => setApiKey(e.target.value)}
                placeholder={hasExistingKey ? '••••••••••••••••' : 'sk-...'}
                className="input w-full pr-10"
              />
              <button
                type="button"
                onClick={() => setShowApiKey(!showApiKey)}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-500 hover:text-white"
              >
                {showApiKey ? (
                  <EyeOff className="w-4 h-4" />
                ) : (
                  <Eye className="w-4 h-4" />
                )}
              </button>
            </div>
          </div>

          {/* Default Model */}
          <div>
            <label className="block text-sm font-medium text-gray-400 mb-1.5">
              Default Model <span className="text-red-400">*</span>
            </label>
            <input
              type="text"
              value={defaultModel}
              onChange={(e) => setDefaultModel(e.target.value)}
              placeholder="gpt-4o"
              className="input w-full"
            />
          </div>

          {/* Status message */}
          {saveResult && (
            <div
              className={`flex items-center gap-2 p-3 rounded-md text-sm ${
                saveResult === 'success'
                  ? 'bg-green-500/10 text-green-400 border border-green-500/30'
                  : 'bg-red-500/10 text-red-400 border border-red-500/30'
              }`}
            >
              {saveResult === 'success' ? (
                <>
                  <CheckCircle className="w-4 h-4 flex-shrink-0" />
                  Configuration verified and saved
                </>
              ) : (
                <>
                  <XCircle className="w-4 h-4 flex-shrink-0" />
                  {errorMessage}
                </>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between p-4 border-t border-border-default">
          <button
            onClick={handleClear}
            disabled={isClearing || isSaving || !hasExistingKey}
            className="flex items-center gap-1.5 px-3 py-2 text-red-400 hover:text-red-300 hover:bg-red-500/10 rounded transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            title="Clear all AI configuration"
          >
            {isClearing ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Trash2 className="w-4 h-4" />
            )}
            Clear
          </button>
          <div className="flex items-center gap-2">
            <button
              onClick={onClose}
              className="px-4 py-2 text-gray-400 hover:text-white transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={handleSave}
              disabled={isSaving || isClearing}
              className="btn btn-primary flex items-center gap-2"
            >
              {isSaving ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Verifying...
                </>
              ) : (
                'Save & Verify'
              )}
            </button>
          </div>
        </div>
      </div>

      {/* Confirm dialog */}
      <ConfirmDialog
        open={confirmState.isOpen}
        title={confirmState.title}
        description={confirmState.description}
        confirmText={confirmState.confirmText}
        cancelText={confirmState.cancelText}
        variant={confirmState.variant}
        onConfirm={confirmState.onConfirm}
        onCancel={cancel}
      />
    </div>
  );
}
