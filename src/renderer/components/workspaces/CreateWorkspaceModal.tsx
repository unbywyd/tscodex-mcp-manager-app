/**
 * CreateWorkspaceModal - Modal for creating a new workspace
 */

import { useState, useEffect } from 'react';
import { FolderOpen, X, Loader2 } from 'lucide-react';
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogCancel,
} from '../ui/alert-dialog';

interface CreateWorkspaceModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmit: (label: string, projectRoot: string) => Promise<void>;
}

export function CreateWorkspaceModal({
  open,
  onOpenChange,
  onSubmit,
}: CreateWorkspaceModalProps) {
  const [projectPath, setProjectPath] = useState('');
  const [label, setLabel] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Reset form when modal opens/closes
  useEffect(() => {
    if (!open) {
      setProjectPath('');
      setLabel('');
      setError(null);
      setIsSubmitting(false);
    }
  }, [open]);

  // Extract suggested name from path
  const getSuggestedName = (path: string): string => {
    if (!path) return '';

    // Normalize path separators
    const normalized = path.replace(/\\/g, '/');
    const parts = normalized.split('/').filter(Boolean);

    if (parts.length === 0) return '';

    // Return last directory name
    return parts[parts.length - 1];
  };

  // Handle folder selection
  const handleSelectFolder = async () => {
    try {
      const selectedPath = await window.electronAPI?.selectDirectory();

      if (selectedPath) {
        setProjectPath(selectedPath);
        setError(null);

        // Try to get package.json name, otherwise use folder name
        const suggestedName = getSuggestedName(selectedPath);

        // Only set label if it's empty or was auto-generated
        if (!label || label === getSuggestedName(projectPath)) {
          setLabel(suggestedName);
        }
      }
    } catch (err) {
      console.error('Failed to select directory:', err);
      setError('Failed to select directory');
    }
  };

  // Handle form submission
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!projectPath.trim()) {
      setError('Please select a project folder');
      return;
    }

    if (!label.trim()) {
      setError('Please enter a workspace name');
      return;
    }

    setIsSubmitting(true);
    setError(null);

    try {
      await onSubmit(label.trim(), projectPath.trim());
      onOpenChange(false);
    } catch (err) {
      console.error('Failed to create workspace:', err);
      setError(err instanceof Error ? err.message : 'Failed to create workspace');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent className="max-w-md">
        <AlertDialogHeader>
          <AlertDialogTitle>Create Workspace</AlertDialogTitle>
          <AlertDialogDescription>
            Create a new workspace to manage MCP servers for a specific project.
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
                readOnly
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
            <p className="text-xs text-gray-500 mt-1">
              Click the folder icon to browse
            </p>
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
            />
            <p className="text-xs text-gray-500 mt-1">
              A friendly name for this workspace
            </p>
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
              disabled={isSubmitting || !projectPath || !label}
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Creating...
                </>
              ) : (
                'Create Workspace'
              )}
            </button>
          </AlertDialogFooter>
        </form>
      </AlertDialogContent>
    </AlertDialog>
  );
}
