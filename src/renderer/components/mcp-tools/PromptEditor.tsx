/**
 * Prompt Editor - Create/edit dynamic prompts
 */

import { useState, useEffect } from 'react';
import { X, Check, AlertCircle, Plus, Trash2 } from 'lucide-react';
import { useMcpToolsStore } from '../../stores/mcpToolsStore';
import type { DynamicPrompt, PromptArgument } from '../../../host/mcp-tools/types';
import { cn } from '../../lib/utils';
import { CodeEditor } from '../ui/code-editor';

interface PromptEditorProps {
  prompt?: DynamicPrompt;
  onClose: () => void;
}

export function PromptEditor({ prompt, onClose }: PromptEditorProps) {
  const { createPrompt, updatePrompt, validateName } = useMcpToolsStore();

  // Form state
  const [name, setName] = useState(prompt?.name || '');
  const [description, setDescription] = useState(prompt?.description || '');
  const [enabled, setEnabled] = useState(prompt?.enabled ?? true);
  const [template, setTemplate] = useState(prompt?.template || '');
  const [args, setArgs] = useState<PromptArgument[]>(prompt?.arguments || []);

  // Validation state
  const [nameError, setNameError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Validate name on change
  useEffect(() => {
    const timer = setTimeout(async () => {
      if (!name) {
        setNameError(null);
        return;
      }
      try {
        const result = await validateName(name, 'prompt', prompt?.id);
        setNameError(result.valid ? null : result.error || 'Invalid name');
      } catch {
        setNameError(null);
      }
    }, 300);
    return () => clearTimeout(timer);
  }, [name, prompt?.id, validateName]);

  const handleAddArgument = () => {
    setArgs([...args, { name: '', description: '', required: false }]);
  };

  const handleUpdateArgument = (index: number, field: keyof PromptArgument, value: string | boolean) => {
    const newArgs = [...args];
    newArgs[index] = { ...newArgs[index], [field]: value };
    setArgs(newArgs);
  };

  const handleRemoveArgument = (index: number) => {
    setArgs(args.filter((_, i) => i !== index));
  };

  const handleSubmit = async () => {
    if (!name || nameError || !template) return;

    setIsSubmitting(true);
    try {
      const data = {
        name,
        description,
        enabled,
        template,
        arguments: args.filter((a) => a.name.trim() !== ''),
      };

      if (prompt) {
        await updatePrompt(prompt.id, data);
      } else {
        await createPrompt(data);
      }
      onClose();
    } catch (error) {
      console.error('Failed to save prompt:', error);
      alert((error as Error).message);
    } finally {
      setIsSubmitting(false);
    }
  };

  const isValid = name && !nameError && template;

  // Extract placeholders from template
  const placeholders = template.match(/\{\{(\w+)\}\}/g)?.map((p) => p.slice(2, -2)) || [];

  return (
    <div className="flex flex-col h-full max-h-[90vh]">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-gray-700">
        <h2 className="text-lg font-semibold text-white">
          {prompt ? 'Edit Prompt' : 'New Prompt'}
        </h2>
        <button
          onClick={onClose}
          className="p-1 text-gray-400 hover:text-white transition-colors"
        >
          <X size={20} />
        </button>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-auto p-4 space-y-4">
        {/* Basic Info */}
        <div className="space-y-3">
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-1">
              Name <span className="text-red-400">*</span>
            </label>
            <div className="relative">
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, '_'))}
                placeholder="my_prompt_name"
                className={cn(
                  'w-full px-3 py-2 bg-bg-secondary border rounded-md text-white placeholder-gray-400',
                  'focus:outline-none focus:ring-2 focus:ring-white/50',
                  nameError ? 'border-red-500' : 'border-border-default'
                )}
              />
              {name && (
                <div className="absolute right-2 top-1/2 -translate-y-1/2">
                  {nameError ? (
                    <AlertCircle size={16} className="text-red-400" />
                  ) : (
                    <Check size={16} className="text-green-400" />
                  )}
                </div>
              )}
            </div>
            {nameError && <p className="text-xs text-red-400 mt-1">{nameError}</p>}
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-300 mb-1">
              Description <span className="text-red-400">*</span>
            </label>
            <input
              type="text"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="What is this prompt for?"
              className="w-full px-3 py-2 bg-bg-secondary border border-border-default rounded-md text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-white/50"
            />
          </div>

          <div className="flex items-center gap-2">
            <input
              type="checkbox"
              id="enabled"
              checked={enabled}
              onChange={(e) => setEnabled(e.target.checked)}
              className="w-4 h-4 rounded border-gray-600 bg-gray-700 text-white focus:ring-white/50 accent-white"
            />
            <label htmlFor="enabled" className="text-sm text-gray-300">
              Enabled
            </label>
          </div>
        </div>

        {/* Arguments */}
        <div>
          <div className="flex items-center justify-between mb-2">
            <label className="block text-sm font-medium text-gray-300">
              Arguments
            </label>
            <button
              onClick={handleAddArgument}
              className="flex items-center gap-1 text-xs text-gray-300 hover:text-white transition-colors"
            >
              <Plus size={14} />
              Add Argument
            </button>
          </div>

          {args.length === 0 ? (
            <p className="text-sm text-gray-500 italic">
              No arguments defined. Add arguments to allow dynamic values in your template.
            </p>
          ) : (
            <div className="space-y-2">
              {args.map((arg, index) => (
                <div
                  key={index}
                  className="flex items-start gap-2 p-2 bg-gray-700/50 rounded-md"
                >
                  <input
                    type="text"
                    value={arg.name}
                    onChange={(e) =>
                      handleUpdateArgument(
                        index,
                        'name',
                        e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, '_')
                      )
                    }
                    placeholder="arg_name"
                    className="w-32 px-2 py-1 bg-bg-secondary border border-border-default rounded text-sm text-white placeholder-gray-400 focus:outline-none focus:ring-1 focus:ring-white/50"
                  />
                  <input
                    type="text"
                    value={arg.description || ''}
                    onChange={(e) => handleUpdateArgument(index, 'description', e.target.value)}
                    placeholder="Description"
                    className="flex-1 px-2 py-1 bg-bg-secondary border border-border-default rounded text-sm text-white placeholder-gray-400 focus:outline-none focus:ring-1 focus:ring-white/50"
                  />
                  <label className="flex items-center gap-1 text-xs text-gray-400">
                    <input
                      type="checkbox"
                      checked={arg.required || false}
                      onChange={(e) => handleUpdateArgument(index, 'required', e.target.checked)}
                      className="w-3 h-3 rounded border-gray-600 bg-gray-700 text-white accent-white"
                    />
                    Required
                  </label>
                  <button
                    onClick={() => handleRemoveArgument(index)}
                    className="p-1 text-gray-400 hover:text-red-400 transition-colors"
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Template */}
        <div>
          <label className="block text-sm font-medium text-gray-300 mb-1">
            Template <span className="text-red-400">*</span>
          </label>
          <CodeEditor
            value={template}
            onChange={setTemplate}
            language="markdown"
            minHeight="200px"
            placeholder="Write your prompt template here. Use {{arg_name}} for placeholders."
          />
          {placeholders.length > 0 && (
            <div className="mt-2 flex items-center gap-2 flex-wrap">
              <span className="text-xs text-gray-500">Placeholders found:</span>
              {placeholders.map((p, i) => (
                <span
                  key={i}
                  className={cn(
                    'px-1.5 py-0.5 rounded text-xs',
                    args.some((a) => a.name === p)
                      ? 'bg-green-500/20 text-green-400'
                      : 'bg-yellow-500/20 text-yellow-400'
                  )}
                >
                  {`{{${p}}}`}
                </span>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Footer */}
      <div className="flex items-center justify-end gap-2 px-4 py-3 border-t border-gray-700">
        <button
          onClick={onClose}
          className="px-4 py-2 text-gray-400 hover:text-white transition-colors"
        >
          Cancel
        </button>
        <button
          onClick={handleSubmit}
          disabled={!isValid || isSubmitting}
          className={cn(
            'flex items-center gap-2 px-4 py-2 rounded-md transition-colors',
            isValid && !isSubmitting
              ? 'bg-white text-gray-900 hover:bg-gray-200'
              : 'bg-gray-700 text-gray-500 cursor-not-allowed'
          )}
        >
          {isSubmitting ? (
            <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white" />
          ) : (
            <Check size={16} />
          )}
          {prompt ? 'Save' : 'Create'}
        </button>
      </div>
    </div>
  );
}
