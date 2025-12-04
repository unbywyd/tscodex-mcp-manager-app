/**
 * MCP Tools Card - Built-in server card for dynamic tools/prompts/resources
 */

import { useState } from 'react';
import {
  Wrench,
  MessageSquare,
  Package,
  Power,
  PowerOff,
  ChevronRight,
  Loader2,
  Sparkles,
} from 'lucide-react';
import { useMcpToolsStore } from '../../stores/mcpToolsStore';

interface McpToolsCardProps {
  workspaceId: string;
  onOpenDetails?: () => void;
}

export function McpToolsCard({ workspaceId, onOpenDetails }: McpToolsCardProps) {
  const { status, enable, disable, isLoading, fetchStatus } = useMcpToolsStore();
  const [isToggling, setIsToggling] = useState(false);

  const isGlobalWorkspace = workspaceId === 'global';
  const isEnabled = status?.enabled ?? false;
  const toolsCount = status?.enabledToolsCount ?? 0;
  const promptsCount = status?.enabledPromptsCount ?? 0;
  const resourcesCount = status?.enabledResourcesCount ?? 0;
  const totalCount = toolsCount + promptsCount + resourcesCount;

  const handleToggleEnabled = async (e: React.MouseEvent) => {
    e.stopPropagation();
    setIsToggling(true);
    try {
      if (isEnabled) {
        await disable();
      } else {
        await enable();
      }
      await fetchStatus();
    } catch (error) {
      console.error('Failed to toggle MCP Tools:', error);
    }
    setIsToggling(false);
  };

  const handleCardClick = () => {
    onOpenDetails?.();
  };

  // Card styling based on enabled state
  const cardOpacity = !isEnabled ? 'opacity-60' : '';

  return (
    <div
      className={`card p-4 relative group cursor-pointer hover:border-border-hover transition-colors border-l-4 border-l-purple-500 ${cardOpacity}`}
      onClick={handleCardClick}
    >
      <div className="flex items-start gap-4">
        {/* Icon */}
        <div className="w-10 h-10 rounded-lg bg-purple-900/30 flex items-center justify-center flex-shrink-0">
          <Sparkles className="w-5 h-5 text-purple-400" />
        </div>

        {/* Content */}
        <div className="flex-1 min-w-0">
          {/* Header */}
          <div className="flex items-center gap-3">
            <h3 className="font-medium truncate">MCP Tools</h3>
            <span className="px-1.5 py-0.5 text-xs font-medium rounded bg-purple-900/50 text-purple-400">
              Built-in
            </span>
            <div className="flex items-center gap-1.5">
              <span
                className={`w-2 h-2 rounded-full ${isEnabled ? 'bg-status-running' : 'bg-status-stopped'}`}
              />
              <span className="text-xs text-gray-400">
                {isEnabled ? 'Enabled' : 'Disabled'}
              </span>
            </div>
          </div>

          {/* Description */}
          <p className="text-sm text-gray-500 truncate mt-1">
            Create custom tools, prompts, and resources
          </p>

          {/* Stats */}
          <div className="flex items-center gap-4 mt-2">
            <div className="flex items-center gap-1 text-xs text-gray-500">
              <Wrench className="w-3.5 h-3.5" />
              <span>{toolsCount}</span>
            </div>
            <div className="flex items-center gap-1 text-xs text-gray-500">
              <MessageSquare className="w-3.5 h-3.5" />
              <span>{promptsCount}</span>
            </div>
            <div className="flex items-center gap-1 text-xs text-gray-500">
              <Package className="w-3.5 h-3.5" />
              <span>{resourcesCount}</span>
            </div>
            {totalCount === 0 && (
              <span className="text-xs text-gray-500 italic">No items yet</span>
            )}
          </div>
        </div>

        {/* Actions */}
        <div className="flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
          {/* Enable/Disable toggle - only in global view */}
          {isGlobalWorkspace && (
            <button
              onClick={handleToggleEnabled}
              disabled={isToggling || isLoading}
              className={`btn-icon ${
                isEnabled ? 'text-emerald-400 hover:text-emerald-300' : 'text-gray-500 hover:text-gray-400'
              }`}
              title={isEnabled ? 'Disable MCP Tools' : 'Enable MCP Tools'}
            >
              {isToggling ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : isEnabled ? (
                <Power className="w-4 h-4" />
              ) : (
                <PowerOff className="w-4 h-4" />
              )}
            </button>
          )}

          {/* Navigation indicator */}
          <ChevronRight className="w-5 h-5 text-gray-600 opacity-0 group-hover:opacity-100 transition-opacity" />
        </div>
      </div>
    </div>
  );
}
