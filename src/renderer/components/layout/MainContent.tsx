import { useState } from 'react';
import { Server, Key } from 'lucide-react';
import { useAppStore } from '../../stores/appStore';
import { ServerList } from '../servers/ServerList';
import { SecretsView } from '../secrets/SecretsView';
import { ServerDetailPage } from '../servers/ServerDetailPage';

interface MainContentProps {
  workspaceId: string;
}

export function MainContent({ workspaceId }: MainContentProps) {
  const { selectedTab, setSelectedTab, workspaces } = useAppStore();
  const [selectedServerId, setSelectedServerId] = useState<string | null>(null);

  const workspace = workspaceId === 'global'
    ? null
    : workspaces.find((ws) => ws.id === workspaceId);

  const title = workspace?.label || 'Global';

  // If a server is selected, show its detail page
  if (selectedServerId) {
    return (
      <ServerDetailPage
        serverId={selectedServerId}
        workspaceId={workspaceId}
        onBack={() => setSelectedServerId(null)}
      />
    );
  }

  return (
    <div className="flex-1 flex flex-col overflow-hidden">
      {/* Header with workspace name and tabs */}
      <div className="border-b border-border-default">
        {/* Workspace title */}
        <div className="px-6 pt-4 pb-2">
          <h1 className="text-lg font-semibold">{title}</h1>
          {workspace && (
            <p className="text-sm text-gray-500 truncate">{workspace.projectRoot}</p>
          )}
        </div>

        {/* Tabs */}
        <div className="flex px-6 gap-1">
          <button
            onClick={() => setSelectedTab('servers')}
            className={`flex items-center gap-2 px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
              selectedTab === 'servers'
                ? 'border-white text-white'
                : 'border-transparent text-gray-400 hover:text-white'
            }`}
          >
            <Server className="w-4 h-4" />
            Servers
          </button>
          <button
            onClick={() => setSelectedTab('secrets')}
            className={`flex items-center gap-2 px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
              selectedTab === 'secrets'
                ? 'border-white text-white'
                : 'border-transparent text-gray-400 hover:text-white'
            }`}
          >
            <Key className="w-4 h-4" />
            Secrets
          </button>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-6">
        {selectedTab === 'servers' ? (
          <ServerList
            workspaceId={workspaceId}
            onOpenServerDetails={setSelectedServerId}
          />
        ) : (
          <SecretsView workspaceId={workspaceId} />
        )}
      </div>
    </div>
  );
}
