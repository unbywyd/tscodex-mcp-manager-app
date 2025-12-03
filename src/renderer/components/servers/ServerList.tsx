import { useState } from 'react';
import { Plus, Server, RotateCcw, Loader2 } from 'lucide-react';
import { useAppStore } from '../../stores/appStore';
import { ServerCard } from './ServerCard';
import { AddServerFlow } from './AddServerFlow';

interface ServerListProps {
  workspaceId: string;
  onOpenServerDetails?: (serverId: string) => void;
}

export function ServerList({ workspaceId, onOpenServerDetails }: ServerListProps) {
  const { servers, isLoading, fetchServers, restartAllServers, restartServer, isServerEnabledForWorkspace } = useAppStore();
  const [showAddServer, setShowAddServer] = useState(false);
  const [isRestarting, setIsRestarting] = useState(false);

  const isGlobalWorkspace = workspaceId === 'global';

  // For global: count all running servers
  // For workspace: count running servers that are enabled for this workspace
  const runningServersCount = isGlobalWorkspace
    ? servers.filter((s) => s.status === 'running').length
    : servers.filter((s) => s.status === 'running' && isServerEnabledForWorkspace(workspaceId, s.id)).length;

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

  // Empty state
  if (servers.length === 0) {
    return (
      <>
        <div className="flex items-center justify-center min-h-[500px]">
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
              No MCP Servers Yet
            </h3>
            <p className="text-gray-400 mb-6 leading-relaxed">
              Get started by adding your first MCP server. Connect to powerful tools and resources to enhance your workflow.
            </p>
            <button
              onClick={() => setShowAddServer(true)}
              className="btn btn-primary flex items-center mx-auto"
            >
              <Plus className="w-4 h-4 mr-2" />
              Add Your First Server
            </button>
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
        {/* Header with Restart All button */}
        <div className="flex items-center justify-end">
          <button
            onClick={handleRestartAll}
            disabled={isRestarting || runningServersCount === 0}
            className="btn btn-secondary text-sm"
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

        {/* Server cards */}
        {servers.map((server) => (
          <ServerCard
            key={server.id}
            server={server}
            workspaceId={workspaceId}
            onOpenDetails={onOpenServerDetails}
          />
        ))}

        {/* Add server card */}
        <button
          onClick={() => setShowAddServer(true)}
          className="w-full card card-hover p-4 flex items-center justify-center gap-2 text-gray-400 hover:text-white"
        >
          <Plus className="w-5 h-5" />
          <span>Add MCP Server</span>
        </button>
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
