/**
 * AIAssistantModal - Modal for configuring AI Assistant with 3 tabs
 */

import { useState, useEffect } from 'react';
import { X, Settings, Globe, BarChart3 } from 'lucide-react';
import { ConnectionTab } from './tabs/ConnectionTab';
import { GlobalAccessTab } from './tabs/GlobalAccessTab';
import { UsageStatsTab } from './tabs/UsageStatsTab';
import { getApiBase } from '../../lib/api';

type TabId = 'connection' | 'global' | 'usage';

interface Tab {
  id: TabId;
  label: string;
  icon: React.ReactNode;
}

const TABS: Tab[] = [
  { id: 'connection', label: 'Connection', icon: <Settings className="w-4 h-4" /> },
  { id: 'global', label: 'Global Access', icon: <Globe className="w-4 h-4" /> },
  { id: 'usage', label: 'Usage Stats', icon: <BarChart3 className="w-4 h-4" /> },
];

interface AIAssistantModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function AIAssistantModal({ open, onOpenChange }: AIAssistantModalProps) {
  const [activeTab, setActiveTab] = useState<TabId>('connection');
  const [isConfigured, setIsConfigured] = useState(false);

  // Check AI status when modal opens
  useEffect(() => {
    if (open) {
      checkStatus();
    }
  }, [open]);

  const checkStatus = async () => {
    try {
      const response = await fetch(`${getApiBase()}/ai/status`);
      if (response.ok) {
        const data = await response.json();
        setIsConfigured(data.configured || false);
      }
    } catch {
      setIsConfigured(false);
    }
  };

  const handleConnectionSuccess = () => {
    setIsConfigured(true);
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
        onClick={() => onOpenChange(false)}
      />

      {/* Modal */}
      <div className="relative bg-bg-primary border border-border-default rounded-lg shadow-xl w-full max-w-lg mx-4 max-h-[80vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-border-default flex-shrink-0">
          <h2 className="text-lg font-semibold">AI Assistant</h2>
          <button
            onClick={() => onOpenChange(false)}
            className="btn-icon text-gray-400 hover:text-white"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-border-default flex-shrink-0">
          {TABS.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex items-center gap-2 px-4 py-3 text-sm font-medium transition-colors ${
                activeTab === tab.id
                  ? 'text-white border-b-2 border-teal-500 -mb-px'
                  : 'text-gray-400 hover:text-white'
              }`}
            >
              {tab.icon}
              {tab.label}
            </button>
          ))}
        </div>

        {/* Content */}
        <div className="p-4 overflow-y-auto flex-1">
          {activeTab === 'connection' && (
            <ConnectionTab onSuccess={handleConnectionSuccess} />
          )}
          {activeTab === 'global' && (
            <GlobalAccessTab isConfigured={isConfigured} />
          )}
          {activeTab === 'usage' && <UsageStatsTab />}
        </div>
      </div>
    </div>
  );
}
