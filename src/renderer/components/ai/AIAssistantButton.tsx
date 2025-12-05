/**
 * AIAssistantButton - Button in Titlebar to navigate to AI Assistant settings page
 */

import { useState, useEffect } from 'react';
import { Sparkles } from 'lucide-react';
import { getApiBase } from '../../lib/api';

export function AIAssistantButton() {
  const [isConfigured, setIsConfigured] = useState(false);

  // Check AI status on mount and periodically
  useEffect(() => {
    const checkStatus = async () => {
      try {
        const response = await fetch(`${getApiBase()}/ai/status`);
        if (response.ok) {
          const data = await response.json();
          setIsConfigured(data.configured);
        }
      } catch {
        // Ignore errors
      }
    };

    checkStatus();
    const interval = setInterval(checkStatus, 30000); // Check every 30s

    return () => clearInterval(interval);
  }, []);

  const handleClick = () => {
    window.location.hash = '/ai-assistant';
  };

  return (
    <button
      onClick={handleClick}
      className={`flex items-center gap-2 px-2.5 py-1.5 rounded-md transition-all ${
        isConfigured
          ? 'text-teal-400 hover:text-teal-300'
          : 'text-gray-400 hover:text-white'
      }`}
      title={isConfigured ? 'AI Assistant (configured)' : 'Configure AI Assistant'}
    >
      <Sparkles
        className={`h-4 w-4 flex-shrink-0 ${isConfigured ? 'fill-teal-400/30' : ''}`}
      />
      <span className="text-sm font-medium">AI Assistant</span>
    </button>
  );
}
