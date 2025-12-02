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

interface ServerCardProps {
  server: ServerInfo;
  workspaceId: string;
  onOpenDetails?: (serverId: string) => void;
}

export function ServerCard({ server, workspaceId, onOpenDetails }: ServerCardProps) {
  const { startServer, stopServer, restartServer, deleteServer } = useAppStore();
  const [isLoading, setIsLoading] = useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);

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

  const handleDelete = async () => {
    try {
      await deleteServer(server.id);
    } catch (error) {
      console.error('Failed to delete server:', error);
    }
    setShowDeleteDialog(false);
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
    onOpenDetails?.(server.id);
  };

  return (
    <>
      <div
        className="card p-4 relative group cursor-pointer hover:border-border-hover transition-colors"
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
          </div>

          {/* Actions */}
          <div className="flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
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

            {/* More menu with Radix DropdownMenu */}
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
    </>
  );
}
