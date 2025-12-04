/**
 * Prompts List - Displays list of dynamic prompts
 */

import { useRef, useState, useEffect } from 'react';
import { MessageSquare, Play, Pause, Edit, Trash2, Plus, Upload, Download } from 'lucide-react';
import { useMcpToolsStore } from '../../stores/mcpToolsStore';
import type { DynamicPrompt } from '../../../host/mcp-tools/types';
import { cn } from '../../lib/utils';
import { ConfirmDialog, InfoDialog, ChoiceDialog } from '../ui/dialogs';

export function PromptsList() {
  const {
    prompts,
    togglePrompt,
    deletePrompt,
    openEditor,
    importData,
    selectedPromptIds,
    togglePromptSelection,
    selectAllPrompts,
    clearPromptSelection,
    exportSelectedPrompts,
  } = useMcpToolsStore();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const selectAllCheckboxRef = useRef<HTMLInputElement>(null);
  const [isExporting, setIsExporting] = useState(false);
  const [isImporting, setIsImporting] = useState(false);

  // Dialog states
  const [deleteDialog, setDeleteDialog] = useState<{ open: boolean; prompt: DynamicPrompt | null }>({
    open: false,
    prompt: null,
  });
  const [importStrategyDialog, setImportStrategyDialog] = useState<{
    open: boolean;
    data: any;
  }>({ open: false, data: null });
  const [infoDialog, setInfoDialog] = useState<{
    open: boolean;
    title: string;
    message: string;
    variant: 'info' | 'success' | 'error';
  }>({ open: false, title: '', message: '', variant: 'info' });

  // Selection state
  const selectedCount = selectedPromptIds.size;
  const allSelected = prompts.length > 0 && selectedCount === prompts.length;
  const someSelected = selectedCount > 0 && selectedCount < prompts.length;

  // Set indeterminate state for select all checkbox
  useEffect(() => {
    if (selectAllCheckboxRef.current) {
      selectAllCheckboxRef.current.indeterminate = someSelected;
    }
  }, [someSelected]);

  const handleSelectAll = () => {
    if (allSelected) {
      clearPromptSelection();
    } else {
      selectAllPrompts();
    }
  };

  const handleToggle = async (id: string) => {
    try {
      await togglePrompt(id);
    } catch (error) {
      console.error('Failed to toggle prompt:', error);
    }
  };

  const handleDelete = (prompt: DynamicPrompt) => {
    setDeleteDialog({ open: true, prompt });
  };

  const confirmDelete = async () => {
    if (!deleteDialog.prompt) return;
    try {
      await deletePrompt(deleteDialog.prompt.id);
      setDeleteDialog({ open: false, prompt: null });
    } catch (error) {
      console.error('Failed to delete prompt:', error);
      setInfoDialog({
        open: true,
        title: 'Delete Failed',
        message: (error as Error).message,
        variant: 'error',
      });
    }
  };

  const handleAddNew = () => {
    openEditor();
  };

  const handleExport = async () => {
    if (selectedCount === 0) return;

    setIsExporting(true);
    try {
      const data = await exportSelectedPrompts();
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `mcp-tools-prompts-export-${Date.now()}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      // Clear selection after export
      clearPromptSelection();
    } catch (error) {
      console.error('Export failed:', error);
      setInfoDialog({
        open: true,
        title: 'Export Failed',
        message: (error as Error).message,
        variant: 'error',
      });
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

    try {
      const text = await file.text();
      const data = JSON.parse(text);
      setImportStrategyDialog({ open: true, data });
    } catch (error) {
      console.error('Import failed:', error);
      setInfoDialog({
        open: true,
        title: 'Import Failed',
        message: 'Failed to parse JSON file: ' + (error as Error).message,
        variant: 'error',
      });
    } finally {
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  const handleImportStrategy = async (strategy: string) => {
    if (!importStrategyDialog.data) return;

    setImportStrategyDialog({ open: false, data: null });
    setIsImporting(true);
    try {
      const data = importStrategyDialog.data;

      const result = await importData(data, {
        conflictStrategy: strategy as 'replace' | 'skip',
        importTools: false,
        importPrompts: true,
        importResources: false,
      });

      let message = `Import completed!\n\nImported: ${result.imported.prompts} prompts`;
      if (result.skipped.prompts.length) {
        message += `\nSkipped: ${result.skipped.prompts.length} items`;
      }
      if (result.errors.length) {
        message += `\nErrors: ${result.errors.length}`;
      }
      setInfoDialog({
        open: true,
        title: 'Import Completed',
        message,
        variant: result.errors.length > 0 ? 'error' : 'success',
      });
    } catch (error) {
      console.error('Import failed:', error);
      setInfoDialog({
        open: true,
        title: 'Import Failed',
        message: (error as Error).message,
        variant: 'error',
      });
    } finally {
      setIsImporting(false);
    }
  };

  return (
    <div className="space-y-4">
      {/* Header with actions */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          {/* Select All checkbox */}
          {prompts.length > 0 && (
            <label className="flex items-center cursor-pointer" title={allSelected ? 'Deselect all' : 'Select all'}>
              <input
                type="checkbox"
                checked={allSelected}
                onChange={handleSelectAll}
                className="form-checkbox"
                ref={selectAllCheckboxRef}
              />
            </label>
          )}
          <h2 className="text-sm font-medium text-gray-400">Prompts</h2>
        </div>
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
            title="Import prompts from file"
          >
            <Upload size={12} />
            {isImporting ? 'Importing...' : 'Import'}
          </button>

          {/* Export button - only enabled when items selected */}
          <button
            onClick={handleExport}
            disabled={isExporting || selectedCount === 0}
            className={cn(
              'flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-xs font-medium transition-colors',
              selectedCount > 0
                ? 'bg-gray-700 text-gray-300 hover:bg-gray-600'
                : 'bg-gray-800 text-gray-600 cursor-not-allowed'
            )}
            title={selectedCount > 0 ? `Export ${selectedCount} selected` : 'Select items to export'}
          >
            <Download size={12} />
            {isExporting ? 'Exporting...' : selectedCount > 0 ? `Export (${selectedCount})` : 'Export'}
          </button>

          {/* Add button - white bg, black text */}
          <button
            onClick={handleAddNew}
            className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-xs font-medium transition-colors bg-white text-gray-900 hover:bg-gray-100"
          >
            <Plus size={12} />
            Add Prompt
          </button>
        </div>
      </div>

      {/* Empty state */}
      {prompts.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-12 text-center">
          <MessageSquare size={48} className="text-gray-600 mb-4" />
          <h3 className="text-lg font-medium text-gray-400 mb-2">No prompts yet</h3>
          <p className="text-sm text-gray-500 max-w-md">
            Create reusable prompt templates with placeholders that AI assistants can use.
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {prompts.map((prompt) => {
            const argCount = prompt.arguments?.length || 0;
            const isSelected = selectedPromptIds.has(prompt.id);

            return (
              <div
                key={prompt.id}
                className={cn(
                  'flex items-center gap-4 p-4 rounded-lg border transition-colors',
                  prompt.enabled
                    ? 'bg-gray-800/50 border-gray-700 hover:border-gray-600'
                    : 'bg-gray-800/30 border-gray-700/50 opacity-60',
                  isSelected && 'border-white/50 bg-gray-800/70'
                )}
              >
                {/* Selection checkbox */}
                <label className="flex items-center cursor-pointer flex-shrink-0">
                  <input
                    type="checkbox"
                    checked={isSelected}
                    onChange={() => togglePromptSelection(prompt.id)}
                    className="form-checkbox"
                  />
                </label>

                {/* Status indicator */}
                <div
                  className={cn(
                    'w-2 h-2 rounded-full flex-shrink-0',
                    prompt.enabled ? 'bg-green-500' : 'bg-gray-500'
                  )}
                />

                {/* Info */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <h3 className="text-sm font-medium text-white truncate">
                      {prompt.name}
                    </h3>
                  </div>
                  <p className="text-xs text-gray-400 truncate mt-0.5">
                    {prompt.description}
                  </p>
                  <div className="flex items-center gap-3 mt-1 text-xs text-gray-500">
                    <span>Arguments: {argCount}</span>
                    <span className="truncate max-w-xs">
                      Template: {prompt.template.substring(0, 50)}...
                    </span>
                  </div>
                </div>

                {/* Actions */}
                <div className="flex items-center gap-1">
                  <button
                    onClick={() => handleToggle(prompt.id)}
                    className={cn(
                      'p-2 rounded-md transition-colors',
                      prompt.enabled
                        ? 'text-green-400 hover:bg-green-500/20'
                        : 'text-gray-400 hover:bg-gray-700'
                    )}
                    title={prompt.enabled ? 'Disable' : 'Enable'}
                  >
                    {prompt.enabled ? <Pause size={16} /> : <Play size={16} />}
                  </button>

                  <button
                    onClick={() => openEditor(prompt)}
                    className="p-2 rounded-md text-gray-400 hover:bg-gray-700 hover:text-white transition-colors"
                    title="Edit"
                  >
                    <Edit size={16} />
                  </button>

                  <button
                    onClick={() => handleDelete(prompt)}
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

      {/* Delete confirmation dialog */}
      <ConfirmDialog
        open={deleteDialog.open}
        title="Delete Prompt"
        description={`Are you sure you want to delete "${deleteDialog.prompt?.name}"? This action cannot be undone.`}
        confirmText="Delete"
        cancelText="Cancel"
        variant="danger"
        onConfirm={confirmDelete}
        onCancel={() => setDeleteDialog({ open: false, prompt: null })}
      />

      {/* Import strategy dialog */}
      <ChoiceDialog
        open={importStrategyDialog.open}
        title="Import Strategy"
        description="How to handle conflicts when importing prompts?"
        choices={[
          { label: 'Replace existing items', value: 'replace', variant: 'primary' },
          { label: 'Skip duplicates', value: 'skip' },
        ]}
        onChoose={handleImportStrategy}
        onCancel={() => setImportStrategyDialog({ open: false, data: null })}
      />

      {/* Info dialog */}
      <InfoDialog
        open={infoDialog.open}
        title={infoDialog.title}
        description={infoDialog.message}
        variant={infoDialog.variant}
        onClose={() => setInfoDialog({ open: false, title: '', message: '', variant: 'info' })}
      />
    </div>
  );
}
