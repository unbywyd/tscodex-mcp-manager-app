import { useState } from 'react';
import { Globe, Folder, Plus, MoreVertical, Trash2, Pencil, HelpCircle, RotateCcw, AlertCircle } from 'lucide-react';
import { useAppStore } from '../../stores/appStore';
import { CreateWorkspaceModal } from '../workspaces/CreateWorkspaceModal';
import { EditWorkspaceModal } from '../workspaces/EditWorkspaceModal';
import { AboutModal } from './AboutModal';
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
import type { WorkspaceConfig } from '../../../shared/types';

export function Sidebar() {
  const {
    workspaces,
    selectedWorkspaceId,
    setSelectedWorkspace,
    createWorkspace,
    updateWorkspace,
    deleteWorkspace,
    resetWorkspace,
  } = useAppStore();

  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showAboutModal, setShowAboutModal] = useState(false);
  const [editingWorkspace, setEditingWorkspace] = useState<WorkspaceConfig | null>(null);
  const [deleteDialog, setDeleteDialog] = useState<{ open: boolean; workspaceId: string | null; workspaceName: string }>({
    open: false,
    workspaceId: null,
    workspaceName: '',
  });
  const [resetDialog, setResetDialog] = useState<{ open: boolean; workspaceId: string | null; workspaceName: string }>({
    open: false,
    workspaceId: null,
    workspaceName: '',
  });

  const handleEdit = (ws: WorkspaceConfig) => {
    setEditingWorkspace(ws);
    setShowEditModal(true);
  };

  const handleDeleteClick = (id: string, name: string) => {
    setDeleteDialog({ open: true, workspaceId: id, workspaceName: name });
  };

  const handleDeleteConfirm = async () => {
    if (deleteDialog.workspaceId) {
      await deleteWorkspace(deleteDialog.workspaceId);
      setDeleteDialog({ open: false, workspaceId: null, workspaceName: '' });
    }
  };

  const handleResetClick = (id: string, name: string) => {
    setResetDialog({ open: true, workspaceId: id, workspaceName: name });
  };

  const handleResetConfirm = async () => {
    if (resetDialog.workspaceId) {
      await resetWorkspace(resetDialog.workspaceId);
      setResetDialog({ open: false, workspaceId: null, workspaceName: '' });
    }
  };

  const handleCreateWorkspace = async (label: string, projectRoot: string) => {
    await createWorkspace(label, projectRoot);
  };

  const handleUpdateWorkspace = async (id: string, label: string, projectRoot: string) => {
    await updateWorkspace(id, label, projectRoot);
  };

  return (
    <>
      <div className="w-56 bg-bg-secondary border-r border-border-default flex flex-col">
        {/* Header */}
        <div className="p-4 border-b border-border-default">
          <h2 className="text-xs font-semibold text-gray-500 uppercase tracking-wider">
            Workspaces
          </h2>
        </div>

        {/* Workspace list */}
        <div className="flex-1 overflow-y-auto p-2">
          {/* Global workspace */}
          <button
            onClick={() => setSelectedWorkspace('global')}
            className={`w-full flex items-center gap-3 px-3 py-2 rounded-md text-left transition-colors ${
              selectedWorkspaceId === 'global'
                ? 'bg-bg-hover text-white'
                : 'text-gray-400 hover:bg-bg-hover hover:text-white'
            }`}
          >
            <Globe className="w-4 h-4 flex-shrink-0" />
            <div className="flex-1 min-w-0">
              <div className="text-sm font-medium truncate">Global</div>
              <div className="text-xs text-gray-500">Default settings</div>
            </div>
          </button>

          {/* Divider */}
          {workspaces.length > 0 && (
            <div className="my-2 border-t border-border-default" />
          )}

          {/* User workspaces */}
          {workspaces.map((ws) => (
            <div key={ws.id} className="relative group">
              <button
                onClick={() => setSelectedWorkspace(ws.id)}
                className={`w-full flex items-center gap-3 px-3 py-2 rounded-md text-left transition-colors ${
                  selectedWorkspaceId === ws.id
                    ? 'bg-bg-hover text-white'
                    : 'text-gray-400 hover:bg-bg-hover hover:text-white'
                }`}
              >
                <Folder className="w-4 h-4 flex-shrink-0" />
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-medium truncate">{ws.label}</div>
                  <div className="text-xs text-gray-500 truncate">
                    {ws.source === 'api'
                      ? (ws.sourceLabel || 'API')
                      : 'Manual'}
                  </div>
                </div>
              </button>

              {/* Dropdown menu with portal */}
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <button
                    className="absolute right-2 top-1/2 -translate-y-1/2 p-1 rounded opacity-0 group-hover:opacity-100 hover:bg-bg-tertiary transition-all"
                  >
                    <MoreVertical className="w-4 h-4" />
                  </button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" sideOffset={4}>
                  <DropdownMenuItem onClick={() => handleEdit(ws)}>
                    <Pencil className="w-4 h-4 mr-2" />
                    Edit
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => handleResetClick(ws.id, ws.label)}>
                    <RotateCcw className="w-4 h-4 mr-2" />
                    Reset to Global
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem
                    onClick={() => handleDeleteClick(ws.id, ws.label)}
                    className="text-red-400 focus:text-red-400"
                  >
                    <Trash2 className="w-4 h-4 mr-2" />
                    Delete
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          ))}
        </div>

        {/* Footer buttons */}
        <div className="p-2 border-t border-border-default space-y-1">
          <button
            onClick={() => setShowCreateModal(true)}
            className="w-full flex items-center gap-2 px-3 py-2 text-sm text-gray-400 hover:text-white hover:bg-bg-hover rounded-md transition-colors"
          >
            <Plus className="w-4 h-4" />
            Add Workspace
          </button>
          <button
            onClick={() => setShowAboutModal(true)}
            className="w-full flex items-center gap-2 px-3 py-2 text-sm text-gray-400 hover:text-white hover:bg-bg-hover rounded-md transition-colors"
          >
            <HelpCircle className="w-4 h-4" />
            About
          </button>
        </div>
      </div>

      {/* Create Workspace Modal */}
      <CreateWorkspaceModal
        open={showCreateModal}
        onOpenChange={setShowCreateModal}
        onSubmit={handleCreateWorkspace}
      />

      {/* Edit Workspace Modal */}
      <EditWorkspaceModal
        open={showEditModal}
        onOpenChange={setShowEditModal}
        workspace={editingWorkspace}
        onSubmit={handleUpdateWorkspace}
      />

      {/* About Modal */}
      <AboutModal
        open={showAboutModal}
        onOpenChange={setShowAboutModal}
      />

      {/* Delete Workspace Confirmation Dialog */}
      <AlertDialog open={deleteDialog.open} onOpenChange={(open) => setDeleteDialog({ ...deleteDialog, open })}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <div className="flex items-center gap-3 mb-2">
              <div className="w-12 h-12 rounded-lg bg-red-500/10 flex items-center justify-center">
                <AlertCircle className="w-6 h-6 text-red-400" />
              </div>
              <AlertDialogTitle className="text-lg">Delete Workspace</AlertDialogTitle>
            </div>
            <AlertDialogDescription className="pt-2">
              <p className="mb-3">
                Are you sure you want to delete the workspace{' '}
                <span className="font-semibold text-white">"{deleteDialog.workspaceName}"</span>?
              </p>
              <div className="bg-red-500/10 border border-red-500/30 rounded-md p-3">
                <p className="text-sm text-red-400">
                  This action cannot be undone. All server configurations and settings for this workspace will be permanently lost.
                </p>
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setDeleteDialog({ open: false, workspaceId: null, workspaceName: '' })}>
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteConfirm}
              className="bg-red-600 hover:bg-red-700 text-white"
            >
              Delete Workspace
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Reset Workspace Confirmation Dialog */}
      <AlertDialog open={resetDialog.open} onOpenChange={(open) => setResetDialog({ ...resetDialog, open })}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <div className="flex items-center gap-3 mb-2">
              <div className="w-12 h-12 rounded-lg bg-yellow-500/10 flex items-center justify-center">
                <RotateCcw className="w-6 h-6 text-yellow-400" />
              </div>
              <AlertDialogTitle className="text-lg">Reset Workspace</AlertDialogTitle>
            </div>
            <AlertDialogDescription className="pt-2">
              <p className="mb-3">
                Are you sure you want to reset the workspace{' '}
                <span className="font-semibold text-white">"{resetDialog.workspaceName}"</span> to Global defaults?
              </p>
              <div className="bg-yellow-500/10 border border-yellow-500/30 rounded-md p-3">
                <p className="text-sm text-yellow-400">
                  All server configuration overrides for this workspace will be cleared. The workspace will inherit all settings from the Global workspace.
                </p>
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setResetDialog({ open: false, workspaceId: null, workspaceName: '' })}>
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={handleResetConfirm}
              className="bg-white hover:bg-gray-200 text-black"
            >
              Reset Workspace
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
