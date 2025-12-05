import { useState, useEffect, useMemo } from 'react';
import { Plus, Server, RotateCcw, Loader2, Search } from 'lucide-react';
import { useAppStore } from '../../stores/appStore';
import { useMcpToolsStore } from '../../stores/mcpToolsStore';
import { ServerCard } from './ServerCard';
import { McpToolsCard } from './McpToolsCard';
import { AddServerFlow } from './AddServerFlow';

interface ServerListProps {
  workspaceId: string;
  onOpenServerDetails?: (serverId: string) => void;
  onOpenMcpTools?: () => void;
}

export function ServerList({ workspaceId, onOpenServerDetails, onOpenMcpTools }: ServerListProps) {
  const { servers, isLoading, fetchServers, restartAllServers, restartServer, isServerEnabledForWorkspace } = useAppStore();
  const { fetchStatus: fetchMcpToolsStatus } = useMcpToolsStore();
  const [showAddServer, setShowAddServer] = useState(false);
  const [isRestarting, setIsRestarting] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [debouncedSearchQuery, setDebouncedSearchQuery] = useState('');

  const isGlobalWorkspace = workspaceId === 'global';

  // Debounce search query
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearchQuery(searchQuery);
    }, 300);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  // Filter servers by name
  const filteredServers = useMemo(() => {
    if (!debouncedSearchQuery.trim()) {
      return servers;
    }
    const query = debouncedSearchQuery.toLowerCase().trim();
    return servers.filter((server) =>
      server.displayName.toLowerCase().includes(query) ||
      server.packageName?.toLowerCase().includes(query)
    );
  }, [servers, debouncedSearchQuery]);

  // Fetch MCP Tools status on mount
  useEffect(() => {
    fetchMcpToolsStatus();
  }, [fetchMcpToolsStatus]);

  // For global: count all running servers
  // For workspace: count running servers that are enabled for this workspace
  const runningServersCount = isGlobalWorkspace
    ? filteredServers.filter((s) => s.status === 'running').length
    : filteredServers.filter((s) => s.status === 'running' && isServerEnabledForWorkspace(workspaceId, s.id)).length;

  const handleRestartAll = async () => {
    setIsRestarting(true);
    try {
      if (isGlobalWorkspace) {
        // Global: restart all running servers
        await restartAllServers();
      } else {
        // Workspace: restart only servers enabled for this workspace
        const serversToRestart = servers.filter(
          (s) => s.status === 'running' && isServerEnabledForWorkspace(workspaceId, s.id)
        );
        await Promise.all(serversToRestart.map((s) => restartServer(s.id)));
      }
    } catch (err) {
      console.error('Failed to restart servers:', err);
    } finally {
      setIsRestarting(false);
    }
  };

  const handleServerAdded = () => {
    fetchServers();
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="flex flex-col items-center gap-3">
          <Loader2 className="w-8 h-8 animate-spin text-gray-500" />
          <p className="text-sm text-gray-500">Loading servers...</p>
        </div>
      </div>
    );
  }

  // Empty state - still show MCP Tools card
  if (servers.length === 0) {
    return (
      <>
        <div className="space-y-6">
          {/* MCP Tools card - only for global workspace */}
          {isGlobalWorkspace && (
            <McpToolsCard
              workspaceId={workspaceId}
              onOpenDetails={onOpenMcpTools}
            />
          )}

          {/* Empty state for external servers */}
          <div className="flex items-center justify-center min-h-[400px]">
            <div className="text-center max-w-md">
              <div className="mb-6 flex justify-center">
                <div className="relative">
                  <div className="absolute inset-0 bg-primary/20 blur-2xl rounded-full"></div>
                  <div className="relative bg-bg-secondary border border-border-default rounded-2xl p-8">
                    <Server className="w-16 h-16 text-gray-400 mx-auto" />
                  </div>
                </div>
              </div>
              <h3 className="text-xl font-semibold text-white mb-2">
                No External MCP Servers Yet
              </h3>
              <p className="text-gray-400 mb-6 leading-relaxed">
                Add external MCP servers to connect to more tools and resources.
              </p>
              {isGlobalWorkspace && (
                <button
                  onClick={() => setShowAddServer(true)}
                  className="btn btn-primary flex items-center mx-auto"
                >
                  <Plus className="w-4 h-4 mr-2" />
                  Add MCP Server
                </button>
              )}
            </div>
          </div>
        </div>

        {showAddServer && (
          <AddServerFlow
            onClose={() => setShowAddServer(false)}
            onServerAdded={handleServerAdded}
          />
        )}
      </>
    );
  }

  return (
    <>
      <div className="space-y-4">
        {/* Header with Search and Restart All button */}
        <div className="flex items-center justify-between gap-3">
          {/* Search input */}
          <div className="relative max-w-xs">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search servers..."
              className="w-full pl-10 pr-3 py-2 bg-bg-secondary border border-border-default rounded-md text-sm text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-white/50"
            />
          </div>

          {/* Right side buttons */}
          <div className="flex items-center gap-2">
            {/* Add Server button (icon only) - only for global workspace */}
            {isGlobalWorkspace && (
              <button
                onClick={() => setShowAddServer(true)}
                className="btn btn-primary p-2 flex-shrink-0"
                title="Add MCP Server"
              >
                <Plus className="w-4 h-4" />
              </button>
            )}

            {/* Restart All button */}
            <button
              onClick={handleRestartAll}
              disabled={isRestarting || runningServersCount === 0}
              className="btn btn-secondary text-sm flex-shrink-0"
              title={
                runningServersCount === 0
                  ? 'No running servers'
                  : 'Restart all running servers'
              }
            >
              {isRestarting ? (
                <>
                  <Loader2 className="w-4 h-4 mr-1 animate-spin" />
                  Restarting...
                </>
              ) : (
                <>
                  <RotateCcw className="w-4 h-4 mr-1" />
                  Restart All ({runningServersCount})
                </>
              )}
            </button>
          </div>
        </div>

        {/* MCP Tools card - only for global workspace */}
        {isGlobalWorkspace && (
          <McpToolsCard
            workspaceId={workspaceId}
            onOpenDetails={onOpenMcpTools}
          />
        )}

        {/* Server cards */}
        {filteredServers.length === 0 ? (
          <div className="flex items-center justify-center py-12 text-center">
            <div className="max-w-md">
              <Search className="w-12 h-12 text-gray-600 mx-auto mb-4" />
              <h3 className="text-lg font-medium text-gray-400 mb-2">No servers found</h3>
              <p className="text-sm text-gray-500">
                {debouncedSearchQuery.trim()
                  ? `No servers match "${debouncedSearchQuery}"`
                  : 'No servers available'}
              </p>
            </div>
          </div>
        ) : (
          filteredServers.map((server) => (
            <ServerCard
              key={server.id}
              server={server}
              workspaceId={workspaceId}
              onOpenDetails={onOpenServerDetails}
            />
          ))
        )}

        {/* Add server card - only for global workspace */}
        {isGlobalWorkspace && (
          <button
            onClick={() => setShowAddServer(true)}
            className="w-full card card-hover p-4 flex items-center justify-center gap-2 text-gray-400 hover:text-white"
          >
            <Plus className="w-5 h-5" />
            <span>Add MCP Server</span>
          </button>
        )}
      </div>

      {showAddServer && (
        <AddServerFlow
          onClose={() => setShowAddServer(false)}
          onServerAdded={handleServerAdded}
        />
      )}
    </>
  );
}
