import React, { useState } from 'react';
import { Globe, Folder, Plus, MoreVertical, Trash2 } from 'lucide-react';
import { useAppStore } from '../../stores/appStore';

export function Sidebar() {
  const {
    workspaces,
    selectedWorkspaceId,
    setSelectedWorkspace,
    deleteWorkspace,
  } = useAppStore();

  const [showMenu, setShowMenu] = useState<string | null>(null);

  const handleDelete = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (confirm('Are you sure you want to delete this workspace?')) {
      await deleteWorkspace(id);
    }
    setShowMenu(null);
  };

  return (
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
            <div className="text-xs text-gray-500">Default workspace</div>
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
                  {ws.source === 'cursor' ? 'by Cursor' : ws.source === 'vscode' ? 'by VS Code' : 'Manual'}
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
              <div className="absolute right-0 top-full mt-1 z-10 bg-bg-card border border-border-default rounded-md shadow-lg py-1 min-w-32">
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

      {/* Add workspace button */}
      <div className="p-2 border-t border-border-default">
        <button className="w-full flex items-center gap-2 px-3 py-2 text-sm text-gray-400 hover:text-white hover:bg-bg-hover rounded-md transition-colors">
          <Plus className="w-4 h-4" />
          Add Workspace
        </button>
      </div>
    </div>
  );
}
