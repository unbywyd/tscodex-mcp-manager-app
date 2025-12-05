/**
 * UsageStatsTab - AI usage statistics and log
 */

import { useState, useEffect, useCallback, useMemo } from 'react';
import { ChevronLeft, ChevronRight, CheckCircle, XCircle, Clock, AlertTriangle } from 'lucide-react';
import type { AIUsageEntry, AIUsageStats } from '../../../../shared/types';
import { Select } from '../../ui/select';
import { getApiBase } from '../../../lib/api';

interface Source {
  id: string;
  name: string;
}

const PERIOD_OPTIONS = [
  { value: '1h', label: 'Last hour' },
  { value: '24h', label: 'Last 24 hours' },
  { value: '7d', label: 'Last 7 days' },
  { value: '30d', label: 'Last 30 days' },
  { value: 'all', label: 'All time' },
];

export function UsageStatsTab() {
  const [sources, setSources] = useState<Source[]>([]);
  const [selectedSource, setSelectedSource] = useState('all');
  const [selectedPeriod, setSelectedPeriod] = useState('24h');

  const [stats, setStats] = useState<AIUsageStats | null>(null);
  const [entries, setEntries] = useState<AIUsageEntry[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [pages, setPages] = useState(0);
  const [isLoading, setIsLoading] = useState(false);

  // Load sources on mount
  useEffect(() => {
    loadSources();
  }, []);

  // Load data when filters change
  useEffect(() => {
    loadStats();
    setPage(1); // Reset to first page
  }, [selectedSource, selectedPeriod]);

  // Load entries when page changes
  useEffect(() => {
    loadEntries();
  }, [selectedSource, selectedPeriod, page]);

  const loadSources = async () => {
    try {
      const response = await fetch(`${getApiBase()}/ai/usage/sources`);
      if (response.ok) {
        const data = await response.json();
        if (data.success) {
          setSources(data.sources || []);
        }
      }
    } catch {
      // Ignore errors
    }
  };

  const loadStats = useCallback(async () => {
    try {
      const params = new URLSearchParams({
        source: selectedSource,
        period: selectedPeriod,
      });
      const response = await fetch(`${getApiBase()}/ai/usage/stats?${params}`);
      if (response.ok) {
        const data = await response.json();
        if (data.success) {
          setStats(data.stats);
        }
      }
    } catch {
      // Ignore errors
    }
  }, [selectedSource, selectedPeriod]);

  const loadEntries = useCallback(async () => {
    setIsLoading(true);
    try {
      const params = new URLSearchParams({
        source: selectedSource,
        period: selectedPeriod,
        page: page.toString(),
        limit: '10',
      });
      const response = await fetch(`${getApiBase()}/ai/usage/log?${params}`);
      if (response.ok) {
        const data = await response.json();
        if (data.success) {
          setEntries(data.entries || []);
          setTotal(data.total || 0);
          setPages(data.pages || 0);
        }
      }
    } catch {
      // Ignore errors
    } finally {
      setIsLoading(false);
    }
  }, [selectedSource, selectedPeriod, page]);

  const formatNumber = (num: number) => {
    if (num >= 1000000) return `${(num / 1000000).toFixed(1)}M`;
    if (num >= 1000) return `${(num / 1000).toFixed(1)}K`;
    return num.toString();
  };

  const formatTime = (timestamp: number) => {
    const date = new Date(timestamp);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMins / 60);
    const diffDays = Math.floor(diffHours / 24);

    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays < 7) return `${diffDays}d ago`;

    return date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'success':
        return <CheckCircle className="w-4 h-4 text-green-500" />;
      case 'error':
        return <XCircle className="w-4 h-4 text-red-500" />;
      case 'rate_limited':
        return <AlertTriangle className="w-4 h-4 text-yellow-500" />;
      default:
        return <Clock className="w-4 h-4 text-gray-500" />;
    }
  };

  // Prepare source options for Select component
  const sourceOptions = useMemo(() => {
    const options = [
      { value: 'all', label: 'All Sources' },
      { value: 'global', label: 'Global' },
      ...sources
        .filter((s) => s.id !== 'global')
        .map((source) => ({
          value: source.id,
          label: source.name,
        })),
    ];
    return options;
  }, [sources]);

  return (
    <div className="flex flex-col h-full space-y-4">
      {/* Filters */}
      <div className="flex gap-3 flex-shrink-0">
        <Select
          value={selectedSource}
          onChange={setSelectedSource}
          options={sourceOptions}
          placeholder="Select source"
          className="w-[200px]"
        />
        <Select
          value={selectedPeriod}
          onChange={setSelectedPeriod}
          options={PERIOD_OPTIONS}
          placeholder="Select period"
          className="w-[180px]"
        />
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-3 gap-3 flex-shrink-0">
        <div className="bg-bg-tertiary rounded-md p-3">
          <div className="text-xs text-gray-500 mb-1">Total Requests</div>
          <div className="text-xl font-semibold text-white">
            {formatNumber(stats?.totalRequests || 0)}
          </div>
        </div>
        <div className="bg-bg-tertiary rounded-md p-3">
          <div className="text-xs text-gray-500 mb-1">Input Tokens</div>
          <div className="text-xl font-semibold text-blue-400">
            {formatNumber(stats?.totalInputTokens || 0)}
          </div>
        </div>
        <div className="bg-bg-tertiary rounded-md p-3">
          <div className="text-xs text-gray-500 mb-1">Output Tokens</div>
          <div className="text-xl font-semibold text-green-400">
            {formatNumber(stats?.totalOutputTokens || 0)}
          </div>
        </div>
      </div>

      {/* Log Table - Flexible height with scroll */}
      <div className="bg-bg-tertiary rounded-md overflow-hidden flex flex-col flex-1 min-h-0">
        <div className="overflow-y-auto flex-1 custom-scrollbar">
          <table className="w-full text-sm">
            <thead className="sticky top-0 bg-bg-tertiary z-10">
              <tr className="border-b border-border-default">
                <th className="text-left p-2 text-gray-500 font-medium">Time</th>
                <th className="text-left p-2 text-gray-500 font-medium">Source</th>
                <th className="text-left p-2 text-gray-500 font-medium">Model</th>
                <th className="text-right p-2 text-gray-500 font-medium">Tokens</th>
                <th className="text-center p-2 text-gray-500 font-medium">Status</th>
              </tr>
            </thead>
            <tbody>
              {isLoading ? (
                <tr>
                  <td colSpan={5} className="p-4 text-center text-gray-500">
                    Loading...
                  </td>
                </tr>
              ) : entries.length === 0 ? (
                <tr>
                  <td colSpan={5} className="p-4 text-center text-gray-500">
                    No usage data yet
                  </td>
                </tr>
              ) : (
                entries.map((entry) => (
                  <tr key={entry.id} className="border-b border-border-default/50 last:border-0">
                    <td className="p-2 text-left text-gray-400 whitespace-nowrap">
                      {formatTime(entry.timestamp)}
                    </td>
                    <td className="p-2 text-left text-gray-300 truncate max-w-[100px]" title={entry.sourceName}>
                      {entry.sourceName || entry.source}
                    </td>
                    <td className="p-2 text-left text-gray-300 truncate max-w-[80px]" title={entry.model}>
                      {entry.model}
                    </td>
                    <td className="p-2 text-right text-gray-400 whitespace-nowrap">
                      <span className="text-blue-400">{entry.inputTokens}</span>
                      <span className="text-gray-600">/</span>
                      <span className="text-green-400">{entry.outputTokens}</span>
                    </td>
                    <td className="p-2 text-center" title={entry.errorMsg || entry.status}>
                      <div className="flex justify-center items-center">
                        {getStatusIcon(entry.status)}
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Pagination */}
      {total > 0 && (
        <div className="flex items-center justify-between text-sm text-gray-500 flex-shrink-0">
          <span>
            {total} {total === 1 ? 'entry' : 'entries'}
            {pages > 1 && `, page ${page} of ${pages}`}
          </span>
          {pages > 1 && (
            <div className="flex gap-1">
              <button
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page === 1}
                className="btn-icon disabled:opacity-50 disabled:cursor-not-allowed"
                title="Previous page"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              <button
                onClick={() => setPage((p) => Math.min(pages, p + 1))}
                disabled={page === pages}
                className="btn-icon disabled:opacity-50 disabled:cursor-not-allowed"
                title="Next page"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
