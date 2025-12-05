/**
 * AIAssistantPanel - AI assistant for generating tool/resource definitions
 */

import { useState } from 'react';
import { Sparkles, Loader2, AlertCircle, X } from 'lucide-react';
import { cn } from '../../lib/utils';
import { getApiBase } from '../../lib/api';
const MAX_PROMPT_LENGTH = 1000;

interface AIAssistantPanelProps {
  type: 'tool' | 'resource';
  isOpen: boolean;
  onClose: () => void;
  onGenerated: (data: Record<string, unknown>) => void;
  onConfigureAI: () => void;
}

export function AIAssistantPanel({
  type,
  isOpen,
  onClose,
  onGenerated,
  onConfigureAI,
}: AIAssistantPanelProps) {
  const [prompt, setPrompt] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleGenerate = async () => {
    if (!prompt.trim() || isLoading) return;

    setIsLoading(true);
    setError(null);

    try {
      const response = await fetch(`${getApiBase()}/ai/generate/${type}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt: prompt.trim() }),
      });

      const result = await response.json();

      if (response.status === 503) {
        // AI not configured
        onConfigureAI();
        return;
      }

      if (!result.success) {
        setError(result.error || 'Failed to generate');
        return;
      }

      onGenerated(result.data);
      setPrompt('');
      onClose();
    } catch (err) {
      setError((err as Error).message || 'Network error');
    } finally {
      setIsLoading(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey && prompt.trim()) {
      e.preventDefault();
      handleGenerate();
    }
    if (e.key === 'Escape') {
      onClose();
    }
  };

  if (!isOpen) return null;

  const remainingChars = MAX_PROMPT_LENGTH - prompt.length;
  const isOverLimit = remainingChars < 0;

  return (
    <div className="border border-teal-500/30 bg-teal-500/5 rounded-md p-3 space-y-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 text-teal-400">
          <Sparkles size={16} />
          <span className="text-sm font-medium">AI Assistant</span>
        </div>
        <button
          onClick={onClose}
          className="p-1 text-gray-400 hover:text-white transition-colors"
        >
          <X size={16} />
        </button>
      </div>

      <div>
        <textarea
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={
            type === 'tool'
              ? 'Describe the tool you want to create, e.g. "A tool that fetches weather data for a city using OpenWeatherMap API"'
              : 'Describe the resource you want to create, e.g. "A resource that provides the current project\'s README content"'
          }
          className={cn(
            'w-full px-3 py-2 bg-bg-secondary border rounded-md text-white placeholder-gray-500',
            'focus:outline-none focus:ring-2 focus:ring-teal-500/50 resize-none',
            'text-sm min-h-[80px]',
            isOverLimit ? 'border-red-500' : 'border-border-default'
          )}
          disabled={isLoading}
          maxLength={MAX_PROMPT_LENGTH + 100} // Allow some buffer for UX
        />
        <div className="flex items-center justify-between mt-1">
          <span
            className={cn(
              'text-xs',
              isOverLimit ? 'text-red-400' : 'text-gray-500'
            )}
          >
            {remainingChars} characters remaining
          </span>
        </div>
      </div>

      {error && (
        <div className="flex items-center gap-2 p-2 bg-red-500/10 border border-red-500/30 rounded text-red-400 text-sm">
          <AlertCircle size={14} className="flex-shrink-0" />
          <span>{error}</span>
        </div>
      )}

      <div className="flex justify-end">
        <button
          onClick={handleGenerate}
          disabled={!prompt.trim() || isLoading || isOverLimit}
          className={cn(
            'flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition-colors',
            prompt.trim() && !isLoading && !isOverLimit
              ? 'bg-teal-600 hover:bg-teal-700 text-white'
              : 'bg-gray-700 text-gray-500 cursor-not-allowed'
          )}
        >
          {isLoading ? (
            <>
              <Loader2 size={14} className="animate-spin" />
              Generating...
            </>
          ) : (
            <>
              <Sparkles size={14} />
              Generate
            </>
          )}
        </button>
      </div>
    </div>
  );
}
