/**
 * Tools List - Displays list of dynamic tools
 */

import { useRef, useState } from 'react';
import { Wrench, Play, Pause, Edit, Trash2, Globe, Code, FileText, Plus, Upload, Download } from 'lucide-react';
import { useMcpToolsStore } from '../../stores/mcpToolsStore';
import type { DynamicTool } from '../../../host/mcp-tools/types';
import { cn } from '../../lib/utils';

function getExecutorIcon(type: string) {
  switch (type) {
    case 'static':
      return FileText;
    case 'http':
      return Globe;
    case 'function':
      return Code;
    default:
      return Wrench;
  }
}

function getExecutorLabel(type: string) {
  switch (type) {
    case 'static':
      return 'Static';
    case 'http':
      return 'HTTP';
    case 'function':
      return 'Function';
    default:
      return type;
  }
}

export function ToolsList() {
  const { tools, toggleTool, deleteTool, openEditor, exportData, importData, fetchAll } = useMcpToolsStore();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isExporting, setIsExporting] = useState(false);
  const [isImporting, setIsImporting] = useState(false);

  const handleToggle = async (id: string) => {
    try {
      await toggleTool(id);
    } catch (error) {
      console.error('Failed to toggle tool:', error);
    }
  };

  const handleDelete = async (tool: DynamicTool) => {
    if (!confirm(`Are you sure you want to delete "${tool.name}"?`)) {
      return;
    }
    try {
      await deleteTool(tool.id);
    } catch (error) {
      console.error('Failed to delete tool:', error);
    }
  };

  const handleAddNew = () => {
    openEditor();
  };

  const handleExport = async () => {
    setIsExporting(true);
    try {
      const data = await exportData(['tools']);
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `mcp-tools-tools-export-${Date.now()}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (error) {
      console.error('Export failed:', error);
      alert('Export failed: ' + (error as Error).message);
    } finally {
      setIsExporting(false);
    }
  };

  const handleImportClick = () => {
    fileInputRef.current?.click();
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsImporting(true);
    try {
      const text = await file.text();
      const data = JSON.parse(text);

      const strategy = window.confirm(
        'How to handle conflicts?\n\nOK = Replace existing items\nCancel = Skip duplicates'
      ) ? 'replace' : 'skip';

      const result = await importData(data, {
        conflictStrategy: strategy as 'replace' | 'skip',
        importTools: true,
        importPrompts: false,
        importResources: false,
      });

      let message = `Import completed!\n\nImported: ${result.imported.tools} tools`;
      if (result.skipped.tools.length) {
        message += `\nSkipped: ${result.skipped.tools.length} items`;
      }
      if (result.errors.length) {
        message += `\nErrors: ${result.errors.length}`;
      }
      alert(message);
    } catch (error) {
      console.error('Import failed:', error);
      alert('Import failed: ' + (error as Error).message);
    } finally {
      setIsImporting(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  return (
    <div className="space-y-4">
      {/* Header with actions */}
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-medium text-gray-400">Tools</h2>
        <div className="flex items-center gap-2">
          {/* Hidden file input for import */}
          <input
            ref={fileInputRef}
            type="file"
            accept=".json"
            onChange={handleFileChange}
            className="hidden"
          />

          {/* Import button */}
          <button
            onClick={handleImportClick}
            disabled={isImporting}
            className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-xs font-medium transition-colors bg-gray-700 text-gray-300 hover:bg-gray-600"
            title="Import tools from file"
          >
            <Upload size={12} />
            {isImporting ? 'Importing...' : 'Import'}
          </button>

          {/* Export button */}
          <button
            onClick={handleExport}
            disabled={isExporting || tools.length === 0}
            className={cn(
              'flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-xs font-medium transition-colors',
              tools.length > 0
                ? 'bg-gray-700 text-gray-300 hover:bg-gray-600'
                : 'bg-gray-800 text-gray-600 cursor-not-allowed'
            )}
            title="Export tools to file"
          >
            <Download size={12} />
            {isExporting ? 'Exporting...' : 'Export'}
          </button>

          {/* Add button - white bg, black text */}
          <button
            onClick={handleAddNew}
            className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-xs font-medium transition-colors bg-white text-gray-900 hover:bg-gray-100"
          >
            <Plus size={12} />
            Add Tool
          </button>
        </div>
      </div>

      {/* Empty state */}
      {tools.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-12 text-center">
          <Wrench size={48} className="text-gray-600 mb-4" />
          <h3 className="text-lg font-medium text-gray-400 mb-2">No tools yet</h3>
          <p className="text-sm text-gray-500 max-w-md">
            Create your first dynamic tool to make it available to AI assistants.
            Tools can return static content, make HTTP requests, or execute custom JavaScript.
          </p>
        </div>
      ) : (
        <div className="space-y-3">
      {tools.map((tool) => {
        const ExecutorIcon = getExecutorIcon(tool.executor.type);
        const paramCount = Object.keys(tool.inputSchema.properties || {}).length;

        return (
          <div
            key={tool.id}
            className={cn(
              'flex items-center gap-4 p-4 rounded-lg border transition-colors',
              tool.enabled
                ? 'bg-gray-800/50 border-gray-700 hover:border-gray-600'
                : 'bg-gray-800/30 border-gray-700/50 opacity-60'
            )}
          >
            {/* Status indicator */}
            <div
              className={cn(
                'w-2 h-2 rounded-full flex-shrink-0',
                tool.enabled ? 'bg-green-500' : 'bg-gray-500'
              )}
            />

            {/* Info */}
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <h3 className="text-sm font-medium text-white truncate">
                  {tool.name}
                </h3>
                <span
                  className={cn(
                    'flex items-center gap-1 px-1.5 py-0.5 rounded text-xs',
                    'bg-gray-700 text-gray-400'
                  )}
                >
                  <ExecutorIcon size={10} />
                  {getExecutorLabel(tool.executor.type)}
                </span>
              </div>
              <p className="text-xs text-gray-400 truncate mt-0.5">
                {tool.description}
              </p>
              <div className="flex items-center gap-3 mt-1 text-xs text-gray-500">
                <span>Params: {paramCount}</span>
              </div>
            </div>

            {/* Actions */}
            <div className="flex items-center gap-1">
              <button
                onClick={() => handleToggle(tool.id)}
                className={cn(
                  'p-2 rounded-md transition-colors',
                  tool.enabled
                    ? 'text-green-400 hover:bg-green-500/20'
                    : 'text-gray-400 hover:bg-gray-700'
                )}
                title={tool.enabled ? 'Disable' : 'Enable'}
              >
                {tool.enabled ? <Pause size={16} /> : <Play size={16} />}
              </button>

              <button
                onClick={() => openEditor(tool)}
                className="p-2 rounded-md text-gray-400 hover:bg-gray-700 hover:text-white transition-colors"
                title="Edit"
              >
                <Edit size={16} />
              </button>

              <button
                onClick={() => handleDelete(tool)}
                className="p-2 rounded-md text-gray-400 hover:bg-red-500/20 hover:text-red-400 transition-colors"
                title="Delete"
              >
                <Trash2 size={16} />
              </button>
            </div>
          </div>
        );
      })}
        </div>
      )}
    </div>
  );
}
