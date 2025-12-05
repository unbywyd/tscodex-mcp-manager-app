import { useState, useEffect } from 'react';
import { Server, Key, RotateCcw, Globe, Folder } from 'lucide-react';
import { useAppStore } from '../../stores/appStore';
import { ServerList } from '../servers/ServerList';
import { SecretsView } from '../secrets/SecretsView';
import { ServerDetailPage } from '../servers/ServerDetailPage';
import { McpToolsPage } from '../mcp-tools';
import { AIAssistantPage } from '../pages/AIAssistantPage';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '../ui/alert-dialog';

interface MainContentProps {
  workspaceId: string;
}

export function MainContent({ workspaceId }: MainContentProps) {
  const { selectedTab, setSelectedTab, workspaces, resetWorkspaceSecrets } = useAppStore();
  const [selectedServerId, setSelectedServerId] = useState<string | null>(null);
  const [showMcpTools, setShowMcpTools] = useState(false);
  const [showAIAssistant, setShowAIAssistant] = useState(false);
  const [showResetDialog, setShowResetDialog] = useState(false);
  const [isResetting, setIsResetting] = useState(false);

  // Handle hash-based routing
  useEffect(() => {
    const handleHashChange = () => {
      const hash = window.location.hash.slice(1); // Remove #
      if (hash === '/ai-assistant') {
        setShowAIAssistant(true);
      } else {
        setShowAIAssistant(false);
      }
    };

    // Check initial hash
    handleHashChange();

    // Listen for hash changes
    window.addEventListener('hashchange', handleHashChange);
    return () => window.removeEventListener('hashchange', handleHashChange);
  }, []);

  const isGlobal = workspaceId === 'global';
  const workspace = isGlobal
    ? null
    : workspaces.find((ws) => ws.id === workspaceId);

  const title = workspace?.label || 'Global';

  const handleReset = async () => {
    if (isGlobal || !workspace) return;

    setIsResetting(true);
    try {
      await resetWorkspaceSecrets(workspaceId);
      setShowResetDialog(false);
    } catch (error) {
      console.error('Failed to reset workspace:', error);
    } finally {
      setIsResetting(false);
    }
  };

  // If AI Assistant is selected, show its page
  if (showAIAssistant) {
    return (
      <AIAssistantPage
        onBack={() => {
          setShowAIAssistant(false);
          window.location.hash = '';
        }}
      />
    );
  }

  // If MCP Tools is selected, show its page
  if (showMcpTools) {
    return (
      <McpToolsPage onBack={() => setShowMcpTools(false)} />
    );
  }

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
    <div className="flex-1 flex flex-col overflow-hidden main-content-bg">
      {/* Header with workspace name and tabs */}
      <div className="border-b border-border-default relative z-10">
        {/* Workspace title */}
        <div className="px-6 pt-4 pb-2">
          <div className="flex items-start justify-between gap-4">
            <div className="flex items-center gap-3 min-w-0">
              {isGlobal ? (
                <Globe className="w-5 h-5 text-gray-400 flex-shrink-0" />
              ) : (
                <Folder className="w-5 h-5 text-gray-400 flex-shrink-0" />
              )}
              <div className="min-w-0">
                <h1 className="text-lg font-semibold truncate">{title}</h1>
                {workspace ? (
                  <p className="text-sm text-gray-500 truncate">{workspace.projectRoot}</p>
                ) : (
                  <p className="text-sm text-gray-500">Default settings for all workspaces</p>
                )}
              </div>
            </div>

            {/* Reset button - only for non-global workspaces */}
            {!isGlobal && workspace && (
              <button
                onClick={() => setShowResetDialog(true)}
                className="btn btn-secondary text-sm flex-shrink-0"
                title="Reset workspace secrets to use global values"
              >
                <RotateCcw className="w-4 h-4 mr-1.5" />
                Reset to Global
              </button>
            )}
          </div>
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
      <div className="flex-1 overflow-y-auto p-6 relative z-10">
        {selectedTab === 'servers' ? (
          <ServerList
            workspaceId={workspaceId}
            onOpenServerDetails={setSelectedServerId}
            onOpenMcpTools={() => setShowMcpTools(true)}
          />
        ) : (
          <SecretsView workspaceId={workspaceId} />
        )}
      </div>

      {/* Reset confirmation dialog */}
      <AlertDialog open={showResetDialog} onOpenChange={setShowResetDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Reset Workspace Secrets?</AlertDialogTitle>
            <AlertDialogDescription>
              This will delete all workspace-specific secrets for "{workspace?.label}".
              The workspace will inherit all secrets from the Global workspace.
              This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isResetting}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleReset}
              disabled={isResetting}
              className="bg-orange-600 hover:bg-orange-700 text-white"
            >
              {isResetting ? 'Resetting...' : 'Reset Secrets'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
