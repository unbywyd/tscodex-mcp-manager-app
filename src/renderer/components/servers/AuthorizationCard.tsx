import { useState, useEffect } from 'react';
import {
  ShieldCheck,
  ShieldX,
  ShieldAlert,
  Key,
  Loader2,
  Info,
  Eye,
  EyeOff,
} from 'lucide-react';
import { Alert } from '../ui/alert';

interface AuthorizationCardProps {
  serverId: string;
  workspaceId: string;
  serverStatus: 'starting' | 'running' | 'stopped' | 'error';
  authInfo?: {
    required: boolean;
    hasSession: boolean;
    roles?: string[];
  };
  onRestartServer: () => Promise<void>;
}

export function AuthorizationCard({
  serverId,
  workspaceId,
  serverStatus,
  authInfo,
  onRestartServer,
}: AuthorizationCardProps) {
  const [authToken, setAuthToken] = useState('');
  const [existingToken, setExistingToken] = useState<string | null>(null);
  const [showToken, setShowToken] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Load existing token on mount
  useEffect(() => {
    const loadExistingToken = async () => {
      setIsLoading(true);
      try {
        // getSecrets returns all secrets for the server, we need to find SECRET_MCP_AUTH_TOKEN
        const secrets = await window.electronAPI?.getSecrets(
          serverId,
          'workspace',
          workspaceId
        );
        const token = secrets?.['SECRET_MCP_AUTH_TOKEN'];
        if (token) {
          setExistingToken(token);
          setAuthToken(token);
        }
      } catch (err) {
        console.error('Failed to load auth token:', err);
      } finally {
        setIsLoading(false);
      }
    };

    loadExistingToken();
  }, [serverId, workspaceId]);

  const handleSaveAndRestart = async () => {
    if (!authToken.trim()) {
      setError('Please enter an auth token');
      return;
    }

    setIsSaving(true);
    setError(null);
    setSuccess(false);

    try {
      // Set the secret via IPC
      await window.electronAPI?.setSecret(
        serverId,
        'SECRET_MCP_AUTH_TOKEN',
        authToken.trim(),
        'workspace',
        workspaceId
      );

      setExistingToken(authToken.trim());
      setSuccess(true);

      // Restart server to apply the new token
      await onRestartServer();

      // Clear success after a delay
      setTimeout(() => setSuccess(false), 3000);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save token');
    } finally {
      setIsSaving(false);
    }
  };

  const handleRemoveToken = async () => {
    setIsSaving(true);
    setError(null);
    setSuccess(false);

    try {
      await window.electronAPI?.deleteSecret(
        serverId,
        'SECRET_MCP_AUTH_TOKEN',
        'workspace',
        workspaceId
      );

      setAuthToken('');
      setExistingToken(null);

      // Restart server
      await onRestartServer();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to remove token');
    } finally {
      setIsSaving(false);
    }
  };

  // Determine authorization state
  const getAuthState = () => {
    if (serverStatus !== 'running') {
      return {
        status: 'server-stopped' as const,
        icon: ShieldAlert,
        color: 'text-gray-400',
        bgColor: 'bg-gray-600',
        message: 'Start the server to check authorization status',
      };
    }

    // No authInfo means server doesn't support authorization at all
    if (!authInfo) {
      return {
        status: 'not-supported' as const,
        icon: ShieldAlert,
        color: 'text-gray-400',
        bgColor: 'bg-gray-600',
        message: 'This server does not support authorization',
      };
    }

    if (authInfo.hasSession) {
      return {
        status: 'authorized' as const,
        icon: ShieldCheck,
        color: 'text-emerald-400',
        bgColor: 'bg-emerald-600',
        message: 'Successfully authorized with server',
      };
    }

    // Authorization is required but not authorized
    if (authInfo.required) {
      return {
        status: 'not-authorized' as const,
        icon: ShieldX,
        color: 'text-amber-400',
        bgColor: 'bg-amber-600',
        message: existingToken
          ? 'Token is set but authorization failed - check if token is valid'
          : 'This server requires authorization - add your auth token below',
      };
    }

    // Authorization is optional (authInfo.required === false)
    return {
      status: 'optional' as const,
      icon: ShieldAlert,
      color: 'text-blue-400',
      bgColor: 'bg-blue-600',
      message: existingToken
        ? 'Token is set but not validated yet'
        : 'Authorization is optional - add a token for personalized features',
    };
  };

  const authState = getAuthState();
  const AuthIcon = authState.icon;

  const hasChanges = authToken !== (existingToken || '');

  return (
    <div className="card p-4">
      <h3 className="text-sm font-medium text-gray-400 mb-4">Authorization</h3>

      {/* Status Display */}
      <div className="flex items-start gap-3 mb-4">
        <div className={`p-2 rounded-lg ${authState.bgColor}/20`}>
          <AuthIcon className={`w-5 h-5 ${authState.color}`} />
        </div>
        <div className="flex-1">
          <p className={`font-medium ${authState.color}`}>
            {authState.status === 'authorized' && 'Authorized'}
            {authState.status === 'not-authorized' && 'Not Authorized'}
            {authState.status === 'server-stopped' && 'Server Not Running'}
            {authState.status === 'not-supported' && 'No Authorization'}
            {authState.status === 'optional' && 'Authorization Optional'}
          </p>
          <p className="text-sm text-gray-400 mt-1">{authState.message}</p>
        </div>
      </div>

      {/* Token Input Section */}
      <div className="border-t border-border-default pt-4 mt-4 space-y-4">
        {/* Info */}
        <div className="card p-3 bg-bg-tertiary border-dashed">
          <div className="flex items-start gap-2">
            <Info className="w-4 h-4 text-gray-500 flex-shrink-0 mt-0.5" />
            <p className="text-xs text-gray-400">
              Get your auth token from the MCP server's website or admin panel,
              then paste it here. The token will be saved as{' '}
              <code className="px-1 py-0.5 bg-bg-secondary rounded font-mono">
                SECRET_MCP_AUTH_TOKEN
              </code>{' '}
              and the server will restart to apply it.
            </p>
          </div>
        </div>

        {/* Token Input */}
        <div>
          <label className="block text-sm font-medium text-gray-400 mb-2">
            <div className="flex items-center gap-2">
              <Key className="w-4 h-4" />
              <span>Auth Token</span>
            </div>
          </label>
          <div className="flex items-center gap-2">
            <div className="relative flex-1">
              <input
                type={showToken ? 'text' : 'password'}
                value={authToken}
                onChange={(e) => {
                  setAuthToken(e.target.value);
                  setError(null);
                }}
                placeholder="Paste your auth token here..."
                className="input w-full pr-10"
                disabled={isLoading || isSaving}
              />
              <button
                type="button"
                onClick={() => setShowToken(!showToken)}
                className="absolute right-2 top-1/2 -translate-y-1/2 p-1 text-gray-400 hover:text-white"
                title={showToken ? 'Hide token' : 'Show token'}
              >
                {showToken ? (
                  <EyeOff className="w-4 h-4" />
                ) : (
                  <Eye className="w-4 h-4" />
                )}
              </button>
            </div>
          </div>
        </div>

        {/* Error */}
        {error && <Alert variant="error">{error}</Alert>}

        {/* Success */}
        {success && (
          <Alert variant="success">
            Token saved! Server is restarting...
          </Alert>
        )}

        {/* Actions */}
        <div className="flex items-center gap-2">
          <button
            onClick={handleSaveAndRestart}
            disabled={isSaving || isLoading || !authToken.trim() || !hasChanges}
            className="btn btn-primary flex-1"
          >
            {isSaving ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Saving...
              </>
            ) : (
              <>
                <Key className="w-4 h-4 mr-2" />
                {existingToken ? 'Update Token & Restart' : 'Save Token & Restart'}
              </>
            )}
          </button>
          {existingToken && (
            <button
              onClick={handleRemoveToken}
              disabled={isSaving || isLoading}
              className="btn btn-secondary"
            >
              Remove
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
