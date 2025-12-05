/**
 * MCP Tools Page - Main page for managing dynamic tools, prompts, and resources
 */

import { useEffect, useState } from 'react';
import {
  Wrench,
  MessageSquare,
  FileText,
  Power,
  PowerOff,
  ArrowLeft,
  Copy,
  Check,
  Link,
} from 'lucide-react';
import { useMcpToolsStore } from '../../stores/mcpToolsStore';
import { ToolsList } from './ToolsList';
import { PromptsList } from './PromptsList';
import { ResourcesList } from './ResourcesList';
import { ToolEditor } from './ToolEditor';
import { PromptEditor } from './PromptEditor';
import { ResourceEditor } from './ResourceEditor';
import { cn } from '../../lib/utils';
import { MCP_TOOLS_URL } from '../../lib/api';

interface McpToolsPageProps {
  onBack?: () => void;
}

export function McpToolsPage({ onBack }: McpToolsPageProps) {
  const {
    status,
    selectedTab,
    isLoading,
    isEditorOpen,
    editingEntity,
    fetchAll,
    enable,
    disable,
    setSelectedTab,
    closeEditor,
  } = useMcpToolsStore();

  const [copiedUrl, setCopiedUrl] = useState(false);

  const handleCopyUrl = async () => {
    try {
      await navigator.clipboard.writeText(MCP_TOOLS_URL);
      setCopiedUrl(true);
      setTimeout(() => setCopiedUrl(false), 2000);
    } catch (err) {
      console.error('Failed to copy URL:', err);
    }
  };

  useEffect(() => {
    fetchAll();
  }, [fetchAll]);

  // Handle ESC key to close modal
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isEditorOpen) {
        closeEditor();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isEditorOpen, closeEditor]);

  const handleToggleEnabled = async () => {
    try {
      if (status?.enabled) {
        await disable();
      } else {
        await enable();
      }
    } catch (error) {
      console.error('Failed to toggle MCP Tools:', error);
    }
  };

  const tabs = [
    {
      id: 'tools' as const,
      label: 'Tools',
      icon: Wrench,
      count: status?.toolsCount || 0,
      enabledCount: status?.enabledToolsCount || 0,
    },
    {
      id: 'resources' as const,
      label: 'Resources',
      icon: FileText,
      count: status?.resourcesCount || 0,
      enabledCount: status?.enabledResourcesCount || 0,
    },
    {
      id: 'prompts' as const,
      label: 'Prompts',
      icon: MessageSquare,
      count: status?.promptsCount || 0,
      enabledCount: status?.enabledPromptsCount || 0,
    },
  ];

  if (isLoading && !status) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-white" />
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full flex-1">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 px-4 py-3 border-b border-gray-700">
        <div className="flex items-center gap-3">
          {onBack && (
            <button
              onClick={onBack}
              className="p-1 text-gray-400 hover:text-white transition-colors"
            >
              <ArrowLeft size={20} />
            </button>
          )}
          <h1 className="text-lg font-semibold text-white">MCP Tools</h1>
          <span className="hidden sm:inline text-xs text-gray-400">
            Dynamic tools, prompts & resources
          </span>
        </div>

        <div className="flex items-center gap-2">
          {/* Enable/Disable toggle */}
          <button
            onClick={handleToggleEnabled}
            className={cn(
              'flex items-center gap-2 px-3 py-1.5 rounded-md text-sm font-medium transition-colors',
              status?.enabled
                ? 'bg-green-500/20 text-green-400 hover:bg-green-500/30'
                : 'bg-gray-600/50 text-gray-400 hover:bg-gray-600'
            )}
          >
            {status?.enabled ? (
              <>
                <Power size={14} />
                Enabled
              </>
            ) : (
              <>
                <PowerOff size={14} />
                Disabled
              </>
            )}
          </button>
        </div>
      </div>

      {/* Connection Info - show when enabled */}
      {status?.enabled && (
        <div className="px-4 py-2 bg-bg-secondary border-b border-border-default">
          <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-3">
            <div className="flex items-center gap-2">
              <Link size={14} className="text-gray-500 flex-shrink-0" />
              <span className="text-xs text-gray-400">MCP Endpoint:</span>
            </div>
            <div className="flex items-center gap-2 min-w-0">
              <code className="px-2 py-0.5 bg-bg-tertiary rounded text-xs font-mono text-emerald-400 truncate">
                {MCP_TOOLS_URL}
              </code>
              <button
                onClick={handleCopyUrl}
                className="p-1 text-gray-400 hover:text-white transition-colors flex-shrink-0"
                title="Copy URL"
              >
                {copiedUrl ? (
                  <Check size={14} className="text-green-400" />
                ) : (
                  <Copy size={14} />
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Tabs - responsive full width */}
      <div className="flex border-b border-gray-700">
        {tabs.map((tab) => {
          const Icon = tab.icon;
          const isActive = selectedTab === tab.id;

          return (
            <button
              key={tab.id}
              onClick={() => setSelectedTab(tab.id)}
              className={cn(
                'flex-1 flex items-center justify-center gap-2 px-4 py-2.5 text-sm font-medium transition-colors border-b-2',
                isActive
                  ? 'text-white border-white'
                  : 'text-gray-400 border-transparent hover:text-gray-300 hover:border-gray-600'
              )}
            >
              <Icon size={16} />
              {tab.label}
              <span
                className={cn(
                  'px-1.5 py-0.5 rounded text-xs',
                  isActive ? 'bg-white/20' : 'bg-gray-700'
                )}
              >
                {tab.enabledCount}/{tab.count}
              </span>
            </button>
          );
        })}
      </div>

      {/* Content - centered */}
      <div className="flex-1 overflow-auto p-4">
        {!status?.enabled ? (
          <div className="flex flex-col items-center justify-center h-full text-center">
            <PowerOff size={48} className="text-gray-600 mb-4" />
            <h2 className="text-lg font-medium text-gray-400 mb-2">
              MCP Tools is disabled
            </h2>
            <p className="text-sm text-gray-500 mb-4 max-w-md">
              Enable MCP Tools to create and manage dynamic tools, prompts, and resources
              that will be available to AI assistants through the MCP protocol.
            </p>
            <button
              onClick={handleToggleEnabled}
              className="flex items-center gap-2 px-4 py-2 bg-white text-gray-900 rounded-md hover:bg-gray-200 transition-colors font-medium"
            >
              <Power size={16} />
              Enable MCP Tools
            </button>
          </div>
        ) : (
          <div className="max-w-4xl mx-auto">
            {selectedTab === 'tools' && <ToolsList />}
            {selectedTab === 'prompts' && <PromptsList />}
            {selectedTab === 'resources' && <ResourcesList />}
          </div>
        )}
      </div>

      {/* Editor Modal */}
      {isEditorOpen && (
        <div
          className="fixed inset-0 bg-black/50 flex items-center justify-center z-50"
          onClick={(e) => {
            if (e.target === e.currentTarget) closeEditor();
          }}
        >
          <div className="bg-gray-800 rounded-lg shadow-xl w-full max-w-3xl max-h-[90vh] overflow-hidden">
            {selectedTab === 'tools' && (
              <ToolEditor
                tool={editingEntity?.type === 'tool' ? editingEntity : undefined}
                onClose={closeEditor}
              />
            )}
            {selectedTab === 'prompts' && (
              <PromptEditor
                prompt={editingEntity?.type === 'prompt' ? editingEntity : undefined}
                onClose={closeEditor}
              />
            )}
            {selectedTab === 'resources' && (
              <ResourceEditor
                resource={editingEntity?.type === 'resource' ? editingEntity : undefined}
                onClose={closeEditor}
              />
            )}
          </div>
        </div>
      )}
    </div>
  );
}
