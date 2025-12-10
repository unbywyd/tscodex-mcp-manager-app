import { useState, useEffect } from 'react';
import { X, ExternalLink, Package, User, Building2, Globe } from 'lucide-react';

interface AboutModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function AboutModal({ open, onOpenChange }: AboutModalProps) {
  const [appVersion, setAppVersion] = useState<string>('...');

  useEffect(() => {
    if (open) {
      window.electronAPI?.getAppVersion?.().then(setAppVersion).catch(() => setAppVersion('unknown'));
    }
  }, [open]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/60"
        onClick={() => onOpenChange(false)}
      />

      {/* Modal */}
      <div className="relative bg-bg-card border border-border-default rounded-lg shadow-xl w-full max-w-lg mx-4">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-border-default">
          <h2 className="text-lg font-semibold">About MCP Manager</h2>
          <button
            onClick={() => onOpenChange(false)}
            className="p-1 rounded hover:bg-bg-hover transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 space-y-6">
          {/* App Info */}
          <div className="text-center">
            <h3 className="text-xl font-bold text-white mb-1">MCP Manager</h3>
            <p className="text-sm text-gray-400">Version {appVersion}</p>
          </div>

          {/* Description */}
          <div className="bg-bg-secondary rounded-lg p-4">
            <p className="text-sm text-gray-300 leading-relaxed">
              MCP Manager is a standalone application for registering and managing MCP (Model Context Protocol) servers
              built with the <a
                href="https://www.npmjs.com/package/@tscodex/mcp-sdk"
                target="_blank"
                rel="noopener noreferrer"
                className="text-blue-400 hover:text-blue-300 inline-flex items-center gap-1"
              >
                @tscodex/mcp-sdk
                <ExternalLink className="w-3 h-3" />
              </a>.
            </p>
          </div>

          {/* Links */}
          <div className="space-y-3">
            <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wider">
              Resources
            </h4>

            <a
              href="https://tscodex.com/mcp-manager"
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-3 p-3 bg-bg-secondary rounded-lg hover:bg-bg-hover transition-colors group"
            >
              <Globe className="w-5 h-5 text-gray-400 group-hover:text-white" />
              <div className="flex-1 min-w-0">
                <div className="text-sm font-medium text-gray-200 group-hover:text-white">
                  Official Website
                </div>
                <div className="text-xs text-gray-500">
                  tscodex.com/mcp-manager
                </div>
              </div>
              <ExternalLink className="w-4 h-4 text-gray-500" />
            </a>

            <a
              href="https://www.npmjs.com/package/@tscodex/mcp-server-example"
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-3 p-3 bg-bg-secondary rounded-lg hover:bg-bg-hover transition-colors group"
            >
              <Package className="w-5 h-5 text-gray-400 group-hover:text-white" />
              <div className="flex-1 min-w-0">
                <div className="text-sm font-medium text-gray-200 group-hover:text-white">
                  Example MCP Server
                </div>
                <div className="text-xs text-gray-500">
                  @tscodex/mcp-server-example
                </div>
              </div>
              <ExternalLink className="w-4 h-4 text-gray-500" />
            </a>

            <a
              href="https://www.npmjs.com/search?q=%40tscodex"
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-3 p-3 bg-bg-secondary rounded-lg hover:bg-bg-hover transition-colors group"
            >
              <Package className="w-5 h-5 text-gray-400 group-hover:text-white" />
              <div className="flex-1 min-w-0">
                <div className="text-sm font-medium text-gray-200 group-hover:text-white">
                  All Packages
                </div>
                <div className="text-xs text-gray-500">
                  @tscodex on npm
                </div>
              </div>
              <ExternalLink className="w-4 h-4 text-gray-500" />
            </a>
          </div>

          {/* Author */}
          <div className="space-y-3">
            <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wider">
              Author
            </h4>

            <div className="flex gap-3">
              <a
                href="https://unbywyd.com/"
                target="_blank"
                rel="noopener noreferrer"
                className="flex-1 flex items-center gap-3 p-3 bg-bg-secondary rounded-lg hover:bg-bg-hover transition-colors group"
              >
                <User className="w-5 h-5 text-gray-400 group-hover:text-white" />
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-medium text-gray-200 group-hover:text-white">
                    unbywyd
                  </div>
                  <div className="text-xs text-gray-500">
                    unbywyd.com
                  </div>
                </div>
                <ExternalLink className="w-4 h-4 text-gray-500" />
              </a>

              <a
                href="https://webto.pro/"
                target="_blank"
                rel="noopener noreferrer"
                className="flex-1 flex items-center gap-3 p-3 bg-bg-secondary rounded-lg hover:bg-bg-hover transition-colors group"
              >
                <Building2 className="w-5 h-5 text-gray-400 group-hover:text-white" />
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-medium text-gray-200 group-hover:text-white">
                    WebTo Pro
                  </div>
                  <div className="text-xs text-gray-500">
                    webto.pro
                  </div>
                </div>
                <ExternalLink className="w-4 h-4 text-gray-500" />
              </a>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-border-default text-center">
          <p className="text-xs text-gray-500">
            Built with Electron, React, and TypeScript
          </p>
        </div>
      </div>
    </div>
  );
}
