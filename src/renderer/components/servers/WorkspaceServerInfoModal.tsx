import { Copy, Check, ExternalLink, X, Link2, Server, Wrench, Package, MessageSquare } from 'lucide-react';
import { useState } from 'react';
import type { ServerInfo } from '../../../shared/types';

interface WorkspaceServerInfoModalProps {
  server: ServerInfo;
  workspaceId: string;
  onClose: () => void;
  onGoToServer: () => void;
}

export function WorkspaceServerInfoModal({
  server,
  workspaceId,
  onClose,
  onGoToServer,
}: WorkspaceServerInfoModalProps) {
  const [copied, setCopied] = useState(false);

  const proxyUrl = `http://127.0.0.1:4040/mcp/${server.id}/${workspaceId}`;

  const handleCopy = async () => {
    await navigator.clipboard.writeText(proxyUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const statusColors = {
    running: 'bg-status-running',
    stopped: 'bg-status-stopped',
    starting: 'bg-status-starting',
    error: 'bg-status-error',
  };

  const statusLabels = {
    running: 'Running',
    stopped: 'Stopped',
    starting: 'Starting...',
    error: 'Error',
  };

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50" onClick={onClose}>
      <div
        className="bg-bg-secondary border border-border-default rounded-lg w-full max-w-lg mx-4 shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-border-default">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-bg-hover flex items-center justify-center">
              <Server className="w-5 h-5 text-gray-400" />
            </div>
            <div>
              <h2 className="text-lg font-semibold">{server.displayName}</h2>
              <div className="flex items-center gap-2 mt-0.5">
                <span className={`w-2 h-2 rounded-full ${statusColors[server.status]}`} />
                <span className="text-xs text-gray-400">{statusLabels[server.status]}</span>
              </div>
            </div>
          </div>
          <button onClick={onClose} className="btn-icon">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-4 space-y-4">
          {/* Description */}
          {server.description && (
            <p className="text-sm text-gray-400">{server.description}</p>
          )}

          {/* Stats */}
          <div className="flex items-center gap-4">
            {server.toolsCount !== undefined && (
              <div className="flex items-center gap-1.5 text-sm text-gray-400">
                <Wrench className="w-4 h-4" />
                <span>{server.toolsCount} tools</span>
              </div>
            )}
            {server.resourcesCount !== undefined && (
              <div className="flex items-center gap-1.5 text-sm text-gray-400">
                <Package className="w-4 h-4" />
                <span>{server.resourcesCount} resources</span>
              </div>
            )}
            {server.promptsCount !== undefined && (
              <div className="flex items-center gap-1.5 text-sm text-gray-400">
                <MessageSquare className="w-4 h-4" />
                <span>{server.promptsCount} prompts</span>
              </div>
            )}
          </div>

          {/* MCP Proxy URL */}
          <div className="space-y-2">
            <label className="text-sm font-medium text-gray-300 flex items-center gap-2">
              <Link2 className="w-4 h-4" />
              MCP Endpoint (Workspace Proxy)
            </label>
            <div className="flex items-center gap-2">
              <code className="flex-1 text-sm text-emerald-400 bg-emerald-900/20 px-3 py-2 rounded border border-emerald-800/30 break-all">
                {proxyUrl}
              </code>
              <button
                onClick={handleCopy}
                className="btn-icon flex-shrink-0 h-9 w-9"
                title="Copy URL"
              >
                {copied ? (
                  <Check className="w-4 h-4 text-emerald-400" />
                ) : (
                  <Copy className="w-4 h-4" />
                )}
              </button>
            </div>
            <p className="text-xs text-gray-500">
              This URL routes through the MCP Gateway with workspace-specific secrets applied.
            </p>
          </div>

          {/* Info about global */}
          <div className="bg-bg-tertiary rounded-lg p-3 border border-border-default">
            <p className="text-sm text-gray-400">
              Server configuration is managed globally. To edit settings, environment variables, or server-specific secrets, go to the global server details.
            </p>
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-3 p-4 border-t border-border-default">
          <button onClick={onClose} className="btn btn-secondary">
            Close
          </button>
          <button onClick={onGoToServer} className="btn btn-primary flex items-center gap-2">
            <ExternalLink className="w-4 h-4" />
            Go to Server Settings
          </button>
        </div>
      </div>
    </div>
  );
}
