import React, { useState, useEffect, useRef } from 'react';
import { Globe, Folder, Plus, MoreVertical, Trash2, Pencil, HelpCircle, RotateCcw } from 'lucide-react';
import { useAppStore } from '../../stores/appStore';
import { CreateWorkspaceModal } from '../workspaces/CreateWorkspaceModal';
import { EditWorkspaceModal } from '../workspaces/EditWorkspaceModal';
import { AboutModal } from './AboutModal';
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

  const [showMenu, setShowMenu] = useState<string | null>(null);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showAboutModal, setShowAboutModal] = useState(false);
  const [editingWorkspace, setEditingWorkspace] = useState<WorkspaceConfig | null>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  // Close menu when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setShowMenu(null);
      }
    };

    if (showMenu) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [showMenu]);

  const handleEdit = (ws: WorkspaceConfig, e: React.MouseEvent) => {
    e.stopPropagation();
    setEditingWorkspace(ws);
    setShowEditModal(true);
    setShowMenu(null);
  };

  const handleDelete = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (confirm('Are you sure you want to delete this workspace? Server configurations for this workspace will be lost.')) {
      await deleteWorkspace(id);
    }
    setShowMenu(null);
  };

  const handleReset = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (confirm('Reset this workspace to Global defaults? All server configuration overrides will be cleared.')) {
      await resetWorkspace(id);
    }
    setShowMenu(null);
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
            <div key={ws.id} className="relative group" ref={showMenu === ws.id ? menuRef : undefined}>
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

              {/* Menu button */}
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  setShowMenu(showMenu === ws.id ? null : ws.id);
                }}
                className="absolute right-2 top-1/2 -translate-y-1/2 p-1 rounded opacity-0 group-hover:opacity-100 hover:bg-bg-tertiary transition-all"
              >
                <MoreVertical className="w-4 h-4" />
              </button>

              {/* Dropdown menu */}
              {showMenu === ws.id && (
                <div className="absolute right-0 top-full mt-1 z-10 bg-bg-card border border-border-default rounded-md shadow-lg py-1 min-w-36">
                  <button
                    onClick={(e) => handleEdit(ws, e)}
                    className="w-full flex items-center gap-2 px-3 py-2 text-sm text-gray-300 hover:bg-bg-hover"
                  >
                    <Pencil className="w-4 h-4" />
                    Edit
                  </button>
                  <button
                    onClick={(e) => handleReset(ws.id, e)}
                    className="w-full flex items-center gap-2 px-3 py-2 text-sm text-gray-300 hover:bg-bg-hover"
                  >
                    <RotateCcw className="w-4 h-4" />
                    Reset to Global
                  </button>
                  <div className="my-1 border-t border-border-default" />
                  <button
                    onClick={(e) => handleDelete(ws.id, e)}
                    className="w-full flex items-center gap-2 px-3 py-2 text-sm text-red-400 hover:bg-bg-hover"
                  >
                    <Trash2 className="w-4 h-4" />
                    Delete
                  </button>
                </div>
              )}
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
    </>
  );
}
