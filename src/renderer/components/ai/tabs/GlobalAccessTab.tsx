/**
 * GlobalAccessTab - Global token management for local development access
 */

import { useState, useEffect } from 'react';
import { Copy, RefreshCw, CheckCircle, AlertCircle } from 'lucide-react';
import { getApiBase } from '../../../lib/api';

interface GlobalAccessTabProps {
  isConfigured: boolean;
}

export function GlobalAccessTab({ isConfigured }: GlobalAccessTabProps) {
  const [proxyUrl, setProxyUrl] = useState('');
  const [hasToken, setHasToken] = useState(false);
  const [createdAt, setCreatedAt] = useState<number | undefined>();
  const [isLoading, setIsLoading] = useState(false);
  const [copySuccess, setCopySuccess] = useState<'url' | 'token' | null>(null);
  const [showRegenerateConfirm, setShowRegenerateConfirm] = useState(false);

  // Load global token info on mount
  useEffect(() => {
    loadTokenInfo();
  }, []);

  const loadTokenInfo = async () => {
    try {
      const response = await fetch(`${getApiBase()}/ai/global-token`);
      if (response.ok) {
        const data = await response.json();
        if (data.success) {
          setProxyUrl(data.proxyUrl || '');
          setHasToken(data.hasToken || false);
          setCreatedAt(data.createdAt);
        }
      }
    } catch {
      // Ignore errors
    }
  };

  const handleCopyUrl = async () => {
    try {
      await navigator.clipboard.writeText(proxyUrl);
      setCopySuccess('url');
      setTimeout(() => setCopySuccess(null), 2000);
    } catch {
      // Ignore clipboard errors
    }
  };

  const handleCopyToken = async () => {
    setIsLoading(true);
    try {
      const response = await fetch(`${getApiBase()}/ai/global-token/copy`, {
        method: 'POST',
      });
      if (response.ok) {
        const data = await response.json();
        if (data.success && data.token) {
          await navigator.clipboard.writeText(data.token);
          setCopySuccess('token');
          setHasToken(true);
          setTimeout(() => setCopySuccess(null), 2000);
        }
      }
    } catch {
      // Ignore errors
    } finally {
      setIsLoading(false);
    }
  };

  const handleRegenerate = async () => {
    setIsLoading(true);
    setShowRegenerateConfirm(false);
    try {
      const response = await fetch(`${getApiBase()}/ai/global-token/regenerate`, {
        method: 'POST',
      });
      if (response.ok) {
        const data = await response.json();
        if (data.success && data.token) {
          await navigator.clipboard.writeText(data.token);
          setCopySuccess('token');
          setHasToken(true);
          setCreatedAt(Date.now());
          setTimeout(() => setCopySuccess(null), 2000);
        }
      }
    } catch {
      // Ignore errors
    } finally {
      setIsLoading(false);
    }
  };

  const formatDate = (timestamp: number) => {
    return new Date(timestamp).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  if (!isConfigured) {
    return (
      <div className="flex flex-col items-center justify-center py-8 text-center">
        <AlertCircle className="w-12 h-12 text-yellow-500 mb-4" />
        <h3 className="text-lg font-medium text-white mb-2">Not Configured</h3>
        <p className="text-sm text-gray-400 max-w-sm">
          Please configure your AI provider in the Connection tab first before using global access.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Status */}
      <div className="flex items-center gap-2">
        <div className={`w-2 h-2 rounded-full ${hasToken ? 'bg-green-500' : 'bg-yellow-500'}`} />
        <span className="text-sm text-gray-400">
          {hasToken ? 'Global token active' : 'No global token yet'}
        </span>
        {createdAt && (
          <span className="text-xs text-gray-500 ml-auto">
            Created: {formatDate(createdAt)}
          </span>
        )}
      </div>

      {/* Proxy URL */}
      <div>
        <label className="block text-sm font-medium text-gray-400 mb-2">
          Proxy URL
        </label>
        <div className="flex gap-2">
          <input
            type="text"
            value={proxyUrl}
            readOnly
            className="input flex-1 bg-bg-tertiary text-gray-300"
          />
          <button
            onClick={handleCopyUrl}
            className="btn btn-secondary px-3"
            title="Copy URL"
          >
            {copySuccess === 'url' ? (
              <CheckCircle className="w-4 h-4 text-green-500" />
            ) : (
              <Copy className="w-4 h-4" />
            )}
          </button>
        </div>
      </div>

      {/* Global Token */}
      <div>
        <label className="block text-sm font-medium text-gray-400 mb-2">
          Global Token
        </label>
        <div className="flex gap-2">
          <input
            type="password"
            value={hasToken ? '••••••••••••••••••••••••••••••••' : '(not generated)'}
            readOnly
            className="input flex-1 bg-bg-tertiary text-gray-500"
          />
          <button
            onClick={handleCopyToken}
            disabled={isLoading}
            className="btn btn-secondary px-3"
            title="Copy token to clipboard"
          >
            {copySuccess === 'token' ? (
              <CheckCircle className="w-4 h-4 text-green-500" />
            ) : (
              <Copy className="w-4 h-4" />
            )}
          </button>
          {hasToken && (
            <button
              onClick={() => setShowRegenerateConfirm(true)}
              disabled={isLoading}
              className="btn btn-secondary px-3"
              title="Regenerate token"
            >
              <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
            </button>
          )}
        </div>
        <p className="text-xs text-gray-500 mt-1">
          {hasToken
            ? 'Click copy to copy token to clipboard. Token is never displayed for security.'
            : 'Click copy to generate and copy a new token.'}
        </p>
      </div>

      {/* Regenerate Confirmation */}
      {showRegenerateConfirm && (
        <div className="bg-yellow-500/10 border border-yellow-500/30 rounded-md p-4">
          <p className="text-sm text-yellow-400 mb-3">
            Are you sure you want to regenerate the global token? The old token will be immediately invalidated and any applications using it will stop working.
          </p>
          <div className="flex gap-2">
            <button
              onClick={handleRegenerate}
              disabled={isLoading}
              className="btn btn-primary text-sm"
            >
              {isLoading ? 'Regenerating...' : 'Yes, Regenerate'}
            </button>
            <button
              onClick={() => setShowRegenerateConfirm(false)}
              className="btn btn-secondary text-sm"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Usage Example */}
      <div>
        <label className="block text-sm font-medium text-gray-400 mb-2">
          Usage Example
        </label>
        <div className="bg-bg-tertiary rounded-md p-3 text-xs font-mono text-gray-400 overflow-x-auto">
          <pre className="whitespace-pre-wrap">{`curl ${proxyUrl}/chat/completions \\
  -H "Authorization: Bearer <your-token>" \\
  -H "Content-Type: application/json" \\
  -d '{
    "model": "gpt-4o",
    "messages": [{"role": "user", "content": "Hello!"}]
  }'`}</pre>
        </div>
        <p className="text-xs text-gray-500 mt-2">
          Use this endpoint for local development. It's OpenAI-compatible, so you can use it with any OpenAI SDK.
        </p>
      </div>
    </div>
  );
}
