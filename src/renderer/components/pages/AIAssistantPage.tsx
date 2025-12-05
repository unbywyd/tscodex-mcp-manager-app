/**
 * AIAssistantPage - Page for configuring AI Assistant with 3 tabs
 */

import { useState, useEffect } from 'react';
import { ArrowLeft, Settings, Globe, BarChart3 } from 'lucide-react';
import { ConnectionTab } from '../ai/tabs/ConnectionTab';
import { GlobalAccessTab } from '../ai/tabs/GlobalAccessTab';
import { UsageStatsTab } from '../ai/tabs/UsageStatsTab';
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

interface AIAssistantPageProps {
  onBack?: () => void;
}

export function AIAssistantPage({ onBack }: AIAssistantPageProps) {
  const [activeTab, setActiveTab] = useState<TabId>('connection');
  const [isConfigured, setIsConfigured] = useState(false);

  // Check AI status on mount
  useEffect(() => {
    checkStatus();
  }, []);

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

  return (
    <div className="flex flex-col h-full flex-1">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-border-default flex-shrink-0">
        <div className="flex items-center gap-3">
          {onBack && (
            <button
              onClick={onBack}
              className="p-1 text-gray-400 hover:text-white transition-colors"
            >
              <ArrowLeft className="w-5 h-5" />
            </button>
          )}
          <h1 className="text-lg font-semibold text-white">AI Assistant</h1>
        </div>
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
      <div className={`flex-1 overflow-hidden ${activeTab === 'usage' ? '' : 'p-4 overflow-y-auto'}`}>
        {activeTab === 'connection' && (
          <div className="p-4">
            <ConnectionTab onSuccess={handleConnectionSuccess} />
          </div>
        )}
        {activeTab === 'global' && (
          <div className="p-4">
            <GlobalAccessTab isConfigured={isConfigured} />
          </div>
        )}
        {activeTab === 'usage' && (
          <div className="p-4 h-full flex flex-col">
            <UsageStatsTab />
          </div>
        )}
      </div>
    </div>
  );
}

