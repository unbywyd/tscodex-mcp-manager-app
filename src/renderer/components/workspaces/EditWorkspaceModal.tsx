/**
 * EditWorkspaceModal - Modal for editing workspace name
 */

import { useState, useEffect } from 'react';
import { Loader2, FolderOpen } from 'lucide-react';
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogCancel,
} from '../ui/alert-dialog';
import type { WorkspaceConfig } from '../../../shared/types';

interface EditWorkspaceModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  workspace: WorkspaceConfig | null;
  onSubmit: (id: string, label: string, projectRoot: string) => Promise<void>;
}

export function EditWorkspaceModal({
  open,
  onOpenChange,
  workspace,
  onSubmit,
}: EditWorkspaceModalProps) {
  const [label, setLabel] = useState('');
  const [projectPath, setProjectPath] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Reset form when modal opens with workspace data
  useEffect(() => {
    if (open && workspace) {
      setLabel(workspace.label);
      setProjectPath(workspace.projectRoot);
      setError(null);
      setIsSubmitting(false);
    } else if (!open) {
      setLabel('');
      setProjectPath('');
      setError(null);
    }
  }, [open, workspace]);

  // Handle folder selection
  const handleSelectFolder = async () => {
    try {
      const selectedPath = await window.electronAPI?.selectDirectory();
      if (selectedPath) {
        setProjectPath(selectedPath);
        setError(null);
      }
    } catch (err) {
      console.error('Failed to select directory:', err);
      setError('Failed to select directory');
    }
  };

  // Handle form submission
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!workspace) return;

    if (!label.trim()) {
      setError('Please enter a workspace name');
      return;
    }

    setIsSubmitting(true);
    setError(null);

    try {
      await onSubmit(workspace.id, label.trim(), projectPath.trim());
      onOpenChange(false);
    } catch (err) {
      console.error('Failed to update workspace:', err);
      setError(err instanceof Error ? err.message : 'Failed to update workspace');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!workspace) return null;

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent className="max-w-md">
        <AlertDialogHeader>
          <AlertDialogTitle>Edit Workspace</AlertDialogTitle>
          <AlertDialogDescription>
            Update the name and path of your workspace.
          </AlertDialogDescription>
        </AlertDialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4 mt-4">
          {/* Project Path */}
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-1.5">
              Project Folder
            </label>
            <div className="flex gap-2">
              <input
                type="text"
                value={projectPath}
                onChange={(e) => setProjectPath(e.target.value)}
                placeholder="Select project folder..."
                className="input flex-1 text-sm"
                disabled={isSubmitting}
              />
              <button
                type="button"
                onClick={handleSelectFolder}
                className="btn btn-secondary px-3"
                disabled={isSubmitting}
              >
                <FolderOpen className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Workspace Name */}
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-1.5">
              Workspace Name
            </label>
            <input
              type="text"
              value={label}
              onChange={(e) => setLabel(e.target.value)}
              placeholder="My Project"
              className="input w-full text-sm"
              disabled={isSubmitting}
              autoFocus
            />
          </div>

          {/* Error message */}
          {error && (
            <div className="p-3 bg-red-950/30 border border-red-900 rounded-md">
              <p className="text-sm text-red-400">{error}</p>
            </div>
          )}

          {/* Actions */}
          <AlertDialogFooter className="mt-6">
            <AlertDialogCancel disabled={isSubmitting}>Cancel</AlertDialogCancel>
            <button
              type="submit"
              className="btn btn-primary"
              disabled={isSubmitting || !label.trim() || !projectPath.trim() || (label.trim() === workspace.label && projectPath.trim() === workspace.projectRoot)}
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Saving...
                </>
              ) : (
                'Save Changes'
              )}
            </button>
          </AlertDialogFooter>
        </form>
      </AlertDialogContent>
    </AlertDialog>
  );
}
