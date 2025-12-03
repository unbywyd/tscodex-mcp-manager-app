import React, { useState } from 'react';
import {
  Play,
  Square,
  RotateCcw,
  Settings,
  MoreVertical,
  Trash2,
  Copy,
  Info,
  Wrench,
  Package,
  MessageSquare,
  Lock,
  Unlock,
  ChevronRight,
  Loader2,
  Power,
  PowerOff,
  Link2,
  Check,
  ArrowUpCircle,
} from 'lucide-react';
import { useAppStore } from '../../stores/appStore';
import type { ServerInfo } from '../../../shared/types';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '../ui/dropdown-menu';
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
import { WorkspaceServerInfoModal } from './WorkspaceServerInfoModal';

interface ServerCardProps {
  server: ServerInfo;
  workspaceId: string;
  onOpenDetails?: (serverId: string) => void;
}

export function ServerCard({ server, workspaceId, onOpenDetails }: ServerCardProps) {
  const {
    startServer,
    stopServer,
    restartServer,
    deleteServer,
    updateServer,
    isServerEnabledForWorkspace,
    setServerEnabledForWorkspace,
    setSelectedWorkspace,
  } = useAppStore();
  const [isLoading, setIsLoading] = useState(false);
  const [isUpdating, setIsUpdating] = useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [showWorkspaceInfoModal, setShowWorkspaceInfoModal] = useState(false);

  // Check if server can be updated (has fixed version, not local, has update available)
  const canUpdate = server.hasUpdate && server.installType !== 'local' && server.packageVersion && server.packageVersion !== 'latest';

  const isGlobalWorkspace = workspaceId === 'global';
  const isEnabledForWorkspace = isServerEnabledForWorkspace(workspaceId, server.id);

  const statusColors = {
    running: 'bg-status-running',
    stopped: 'bg-status-stopped',
    starting: 'bg-status-starting status-starting',
    error: 'bg-status-error',
  };

  const statusLabels = {
    running: 'Running',
    stopped: 'Stopped',
    starting: 'Starting...',
    error: 'Error',
  };

  const handleStart = async (e: React.MouseEvent) => {
    e.stopPropagation();
    setIsLoading(true);
    try {
      await startServer(server.id);
    } catch (error) {
      console.error('Failed to start server:', error);
    }
    setIsLoading(false);
  };

  const handleStop = async (e: React.MouseEvent) => {
    e.stopPropagation();
    setIsLoading(true);
    try {
      await stopServer(server.id);
    } catch (error) {
      console.error('Failed to stop server:', error);
    }
    setIsLoading(false);
  };

  const handleRestart = async (e: React.MouseEvent) => {
    e.stopPropagation();
    setIsLoading(true);
    try {
      await restartServer(server.id);
    } catch (error) {
      console.error('Failed to restart server:', error);
    }
    setIsLoading(false);
  };

  const handleToggleEnabled = async (e: React.MouseEvent) => {
    e.stopPropagation();
    setIsLoading(true);
    try {
      const newEnabled = !isEnabledForWorkspace;
      await setServerEnabledForWorkspace(workspaceId, server.id, newEnabled);

      // If enabling and server is stopped globally, start it
      if (newEnabled && server.status === 'stopped') {
        await startServer(server.id);
      }
    } catch (error) {
      console.error('Failed to toggle server enabled:', error);
    }
    setIsLoading(false);
  };

  const handleDelete = async () => {
    try {
      await deleteServer(server.id);
    } catch (error) {
      console.error('Failed to delete server:', error);
    }
    setShowDeleteDialog(false);
  };

  const handleUpdate = async () => {
    setIsUpdating(true);
    try {
      await updateServer(server.id);
    } catch (error) {
      console.error('Failed to update server:', error);
    }
    setIsUpdating(false);
  };

  const copyUrl = () => {
    if (server.port) {
      const url = `http://127.0.0.1:${server.port}/mcp`;
      navigator.clipboard.writeText(url);
    }
  };

  const handleSettingsClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    onOpenDetails?.(server.id);
  };

  const handleCardClick = () => {
    if (!isGlobalWorkspace) {
      // From workspace view, show info modal first
      setShowWorkspaceInfoModal(true);
    } else {
      onOpenDetails?.(server.id);
    }
  };

  const handleGoToServerFromModal = () => {
    setShowWorkspaceInfoModal(false);
    setSelectedWorkspace('global');
    onOpenDetails?.(server.id);
  };

  // For workspace view, show dimmed if disabled
  const cardOpacity = !isGlobalWorkspace && !isEnabledForWorkspace ? 'opacity-50' : '';

  return (
    <>
      <div
        className={`card p-4 relative group cursor-pointer hover:border-border-hover transition-colors ${cardOpacity}`}
        onClick={handleCardClick}
      >
        <div className="flex items-start gap-4">
          {/* Icon */}
          <div className="w-10 h-10 rounded-lg bg-bg-hover flex items-center justify-center flex-shrink-0">
            <Package className="w-5 h-5 text-gray-400" />
          </div>

          {/* Content */}
          <div className="flex-1 min-w-0">
            {/* Header */}
            <div className="flex items-center gap-3">
              <h3 className="font-medium truncate">{server.displayName}</h3>
              <div className="flex items-center gap-1.5">
                <span className={`w-2 h-2 rounded-full ${statusColors[server.status]}`} />
                <span className="text-xs text-gray-400">{statusLabels[server.status]}</span>
              </div>
              {/* Workspace enabled/disabled badge */}
              {!isGlobalWorkspace && (
                <span
                  className={`px-1.5 py-0.5 text-xs font-medium rounded ${
                    isEnabledForWorkspace
                      ? 'bg-emerald-900/50 text-emerald-400'
                      : 'bg-gray-700 text-gray-400'
                  }`}
                >
                  {isEnabledForWorkspace ? 'Enabled' : 'Disabled'}
                </span>
              )}
              {/* Update available badge */}
              {canUpdate && (
                <span className="px-1.5 py-0.5 text-xs font-medium rounded bg-amber-900/50 text-amber-400 flex items-center gap-1">
                  <ArrowUpCircle className="w-3 h-3" />
                  {server.latestVersion}
                </span>
              )}
            </div>

            {/* Description */}
            <p className="text-sm text-gray-500 truncate mt-1">
              {server.description || 'No description'}
            </p>

            {/* Stats */}
            <div className="flex items-center gap-4 mt-2">
              {server.toolsCount !== undefined && (
                <div className="flex items-center gap-1 text-xs text-gray-500">
                  <Wrench className="w-3.5 h-3.5" />
                  <span>{server.toolsCount}</span>
                </div>
              )}
              {server.resourcesCount !== undefined && (
                <div className="flex items-center gap-1 text-xs text-gray-500">
                  <Package className="w-3.5 h-3.5" />
                  <span>{server.resourcesCount}</span>
                </div>
              )}
              {server.promptsCount !== undefined && (
                <div className="flex items-center gap-1 text-xs text-gray-500">
                  <MessageSquare className="w-3.5 h-3.5" />
                  <span>{server.promptsCount}</span>
                </div>
              )}
              {server.authStatus && (
                <div className="flex items-center gap-1 text-xs">
                  {server.authStatus === 'authorized' ? (
                    <>
                      <Lock className="w-3.5 h-3.5 text-status-running" />
                      <span className="text-status-running">Authorized</span>
                    </>
                  ) : (
                    <>
                      <Unlock className="w-3.5 h-3.5 text-gray-500" />
                      <span className="text-gray-500">Not authorized</span>
                    </>
                  )}
                </div>
              )}
            </div>

            {/* MCP URL - only show if running (and enabled for non-global workspace) */}
            {server.status === 'running' && server.port && (isGlobalWorkspace || isEnabledForWorkspace) && (
              <div className="flex items-center gap-2 mt-2">
                <Link2 className="w-3.5 h-3.5 text-gray-500 flex-shrink-0" />
                <code className="text-xs text-emerald-400 bg-emerald-900/20 px-1.5 py-0.5 rounded truncate">
                  {isGlobalWorkspace
                    ? `http://127.0.0.1:${server.port}/mcp`
                    : `http://127.0.0.1:4040/mcp/${server.id}/${workspaceId}`}
                </code>
              </div>
            )}
          </div>

          {/* Actions */}
          <div className="flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
            {isGlobalWorkspace ? (
              // Global workspace: Show Start/Stop/Restart controls + Settings + Menu
              <>
                {server.status === 'running' ? (
                  <>
                    <button
                      onClick={handleRestart}
                      disabled={isLoading}
                      className="btn-icon"
                      title="Restart"
                    >
                      {isLoading ? (
                        <Loader2 className="w-4 h-4 animate-spin" />
                      ) : (
                        <RotateCcw className="w-4 h-4" />
                      )}
                    </button>
                    <button
                      onClick={handleStop}
                      disabled={isLoading}
                      className="btn-icon"
                      title="Stop"
                    >
                      {isLoading ? (
                        <Loader2 className="w-4 h-4 animate-spin" />
                      ) : (
                        <Square className="w-4 h-4" />
                      )}
                    </button>
                  </>
                ) : (
                  <button
                    onClick={handleStart}
                    disabled={isLoading || server.status === 'starting'}
                    className="btn-icon"
                    title="Start"
                  >
                    {isLoading || server.status === 'starting' ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <Play className="w-4 h-4" />
                    )}
                  </button>
                )}

                <button
                  onClick={handleSettingsClick}
                  className="btn-icon"
                  title="Configure"
                >
                  <Settings className="w-4 h-4" />
                </button>

                {/* More menu - only in Global */}
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <button className="btn-icon">
                      <MoreVertical className="w-4 h-4" />
                    </button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    {server.port && (
                      <DropdownMenuItem onClick={copyUrl}>
                        <Copy className="w-4 h-4 mr-2" />
                        Copy URL
                      </DropdownMenuItem>
                    )}
                    <DropdownMenuItem onClick={() => onOpenDetails?.(server.id)}>
                      <Info className="w-4 h-4 mr-2" />
                      Details
                    </DropdownMenuItem>
                    {canUpdate && (
                      <>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem
                          onClick={handleUpdate}
                          disabled={isUpdating}
                          className="text-amber-400 focus:text-amber-400"
                        >
                          {isUpdating ? (
                            <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                          ) : (
                            <ArrowUpCircle className="w-4 h-4 mr-2" />
                          )}
                          Update to {server.latestVersion}
                        </DropdownMenuItem>
                      </>
                    )}
                    <DropdownMenuSeparator />
                    <DropdownMenuItem
                      onClick={() => setShowDeleteDialog(true)}
                      className="text-red-400 focus:text-red-400"
                    >
                      <Trash2 className="w-4 h-4 mr-2" />
                      Delete
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </>
            ) : (
              // Workspace view: Enable/Disable toggle + Start button if stopped
              <>
                {/* Start button - show if enabled for workspace but server is stopped */}
                {isEnabledForWorkspace && server.status === 'stopped' && (
                  <button
                    onClick={handleStart}
                    disabled={isLoading}
                    className="btn-icon text-emerald-400 hover:text-emerald-300"
                    title="Start server"
                  >
                    {isLoading ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <Play className="w-4 h-4" />
                    )}
                  </button>
                )}
                {/* Enable/Disable toggle */}
                <button
                  onClick={handleToggleEnabled}
                  disabled={isLoading}
                  className={`btn-icon ${
                    isEnabledForWorkspace ? 'text-emerald-400 hover:text-emerald-300' : 'text-gray-500 hover:text-gray-400'
                  }`}
                  title={isEnabledForWorkspace ? 'Disable for this workspace' : 'Enable for this workspace'}
                >
                  {isLoading ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : isEnabledForWorkspace ? (
                    <Power className="w-4 h-4" />
                  ) : (
                    <PowerOff className="w-4 h-4" />
                  )}
                </button>
              </>
            )}

            {/* Navigation indicator */}
            <ChevronRight className="w-5 h-5 text-gray-600 opacity-0 group-hover:opacity-100 transition-opacity" />
          </div>
        </div>
      </div>

      {/* Delete confirmation dialog */}
      <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Server</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete "{server.displayName}"? This action cannot be undone.
              The server will be stopped if running and removed from your configuration.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              className="bg-red-600 hover:bg-red-700 text-white"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Workspace server info modal */}
      {showWorkspaceInfoModal && (
        <WorkspaceServerInfoModal
          server={server}
          workspaceId={workspaceId}
          onClose={() => setShowWorkspaceInfoModal(false)}
          onGoToServer={handleGoToServerFromModal}
        />
      )}
    </>
  );
}
