import { useState, useEffect } from 'react';
import {
  ArrowLeft,
  Info,
  Settings,
  Key,
  Play,
  Square,
  RotateCcw,
  Wrench,
  MessageSquare,
  FileText,
  Loader2,
  Link2,
  Copy,
  Check,
  RefreshCw,
  User,
  Github,
  Globe,
  Code,
} from 'lucide-react';
import { useAppStore } from '../../stores/appStore';
import { ServerSecretsManager } from './ServerSecretsManager';
import { ServerConfigEditor } from './ServerConfigEditor';
import { AuthorizationCard } from './AuthorizationCard';
import { Accordion, AccordionItem, AccordionTrigger, AccordionContent } from '../ui/accordion';
import { Alert } from '../ui/alert';
import { CodeBlock } from '../ui/code-block';
import type { ServerInfo } from '../../../shared/types';

type ServerTab = 'overview' | 'config' | 'secrets';
type OverviewSubTab = 'info' | 'connection' | 'tools' | 'resources' | 'prompts';

interface ServerDetailPageProps {
  serverId: string;
  workspaceId: string;
  onBack: () => void;
}

const API_BASE = 'http://127.0.0.1:4040/api';

interface ServerMetadata {
  server: {
    name: string;
    version: string;
    description: string;
    id: string;
    protocolVersion: string;
  };
  tools: Array<{
    name: string;
    description: string;
    inputSchema?: Record<string, unknown>;
  }>;
  resources: Array<{
    uri: string;
    name: string;
    description?: string;
    mimeType?: string;
  }>;
  prompts: Array<{
    name: string;
    description?: string;
    arguments?: Array<{
      name: string;
      description?: string;
      required?: boolean;
    }>;
  }>;
  config?: {
    schema?: Record<string, unknown>;
    loaded: boolean;
    hasConfig: boolean;
  };
  auth?: {
    required: boolean;
    hasSession: boolean;
    roles?: string[];
  };
  projectRoot?: string;
}

export function ServerDetailPage({ serverId, workspaceId, onBack }: ServerDetailPageProps) {
  const { servers, startServer, stopServer, restartServer } = useAppStore();
  const [selectedTab, setSelectedTab] = useState<ServerTab>('overview');
  const [overviewSubTab, setOverviewSubTab] = useState<OverviewSubTab>('info');
  const [isLoading, setIsLoading] = useState(false);
  const [metadata, setMetadata] = useState<ServerMetadata | null>(null);
  const [isLoadingMeta, setIsLoadingMeta] = useState(false);
  const [copiedUrl, setCopiedUrl] = useState(false);
  const [healthStatus, setHealthStatus] = useState<'idle' | 'checking' | 'ok' | 'error'>('idle');
  const [healthError, setHealthError] = useState<string | null>(null);

  const server = servers.find((s) => s.id === serverId);

  useEffect(() => {
    if (server?.status === 'running') {
      fetchMetadata();
    }
  }, [server?.status, serverId, workspaceId]);

  const fetchMetadata = async () => {
    setIsLoadingMeta(true);
    try {
      const response = await fetch(`${API_BASE}/instances/${serverId}/${workspaceId}/metadata`, {
        signal: AbortSignal.timeout(5000),
      });
      if (response.ok) {
        const data = await response.json();
        setMetadata(data);
      }
    } catch (error) {
      console.error('Failed to fetch metadata:', error);
    }
    setIsLoadingMeta(false);
  };

  if (!server) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <p className="text-gray-500">Server not found</p>
      </div>
    );
  }

  const handleStart = async () => {
    setIsLoading(true);
    try {
      await startServer(serverId);
    } catch (error) {
      console.error('Failed to start server:', error);
    }
    setIsLoading(false);
  };

  const handleStop = async () => {
    setIsLoading(true);
    try {
      await stopServer(serverId);
    } catch (error) {
      console.error('Failed to stop server:', error);
    }
    setIsLoading(false);
  };

  const handleRestart = async () => {
    setIsLoading(true);
    try {
      await restartServer(serverId);
    } catch (error) {
      console.error('Failed to restart server:', error);
    }
    setIsLoading(false);
  };

  const handleCopyUrl = async () => {
    if (server.port) {
      await navigator.clipboard.writeText(`http://127.0.0.1:${server.port}`);
      setCopiedUrl(true);
      setTimeout(() => setCopiedUrl(false), 2000);
    }
  };

  const handleHealthCheck = async () => {
    if (!server.port) return;

    setHealthStatus('checking');
    setHealthError(null);

    try {
      const response = await fetch(`${API_BASE}/instances/${serverId}/${workspaceId}/health`, {
        signal: AbortSignal.timeout(5000),
      });

      if (response.ok) {
        setHealthStatus('ok');
      } else {
        const data = await response.json();
        setHealthStatus('error');
        setHealthError(data.error || 'Health check failed');
      }
    } catch (error) {
      setHealthStatus('error');
      setHealthError(error instanceof Error ? error.message : 'Connection failed');
    }

    setTimeout(() => setHealthStatus('idle'), 3000);
  };

  const statusColors = {
    running: 'bg-status-running',
    stopped: 'bg-status-stopped',
    starting: 'bg-status-starting status-starting',
    error: 'bg-status-error',
  };

  const statusLabels = {
    running: 'Running',
    stopped: 'Stopped',
    starting: 'Starting...',
    error: 'Error',
  };

  const truncateDescription = (text: string | undefined, maxLength: number = 60) => {
    if (!text) return '';
    return text.length > maxLength ? text.slice(0, maxLength) + '...' : text;
  };

  // Main tabs
  const mainTabs: { id: ServerTab; label: string; icon: React.ReactNode }[] = [
    { id: 'overview', label: 'Overview', icon: <Info className="w-4 h-4" /> },
    { id: 'config', label: 'Config', icon: <Settings className="w-4 h-4" /> },
    { id: 'secrets', label: 'Secrets', icon: <Key className="w-4 h-4" /> },
  ];

  // Overview subtabs
  const overviewSubTabs: { id: OverviewSubTab; label: string; icon: React.ReactNode; count?: number }[] = [
    { id: 'info', label: 'Info', icon: <Info className="w-4 h-4" /> },
    { id: 'connection', label: 'Connection', icon: <Link2 className="w-4 h-4" /> },
    {
      id: 'tools',
      label: 'Tools',
      icon: <Wrench className="w-4 h-4" />,
      count: metadata?.tools?.length ?? server.toolsCount ?? 0,
    },
    {
      id: 'resources',
      label: 'Resources',
      icon: <FileText className="w-4 h-4" />,
      count: metadata?.resources?.length ?? server.resourcesCount ?? 0,
    },
    {
      id: 'prompts',
      label: 'Prompts',
      icon: <MessageSquare className="w-4 h-4" />,
      count: metadata?.prompts?.length ?? server.promptsCount ?? 0,
    },
  ];

  return (
    <div className="flex-1 flex flex-col overflow-hidden">
      {/* Header */}
      <div className="border-b border-border-default">
        <div className="px-6 pt-4 pb-2 flex items-center gap-4">
          <button onClick={onBack} className="btn-icon">
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-3">
              <h1 className="text-lg font-semibold truncate">{server.displayName}</h1>
              <div className="flex items-center gap-1.5">
                <span className={`w-2 h-2 rounded-full ${statusColors[server.status]}`} />
                <span className="text-sm text-gray-400">{statusLabels[server.status]}</span>
              </div>
            </div>
            {server.packageName && (
              <p className="text-sm text-gray-500 truncate font-mono">{server.packageName}</p>
            )}
          </div>

          {/* Actions */}
          <div className="flex items-center gap-2">
            {server.status === 'running' ? (
              <>
                <button onClick={handleRestart} disabled={isLoading} className="btn btn-secondary">
                  {isLoading ? (
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  ) : (
                    <RotateCcw className="w-4 h-4 mr-2" />
                  )}
                  Restart
                </button>
                <button onClick={handleStop} disabled={isLoading} className="btn btn-secondary">
                  {isLoading ? (
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  ) : (
                    <Square className="w-4 h-4 mr-2" />
                  )}
                  Stop
                </button>
              </>
            ) : (
              <button
                onClick={handleStart}
                disabled={isLoading || server.status === 'starting'}
                className="btn btn-primary"
              >
                {isLoading || server.status === 'starting' ? (
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                ) : (
                  <Play className="w-4 h-4 mr-2" />
                )}
                Start
              </button>
            )}
          </div>
        </div>

        {/* Main Tabs */}
        <div className="flex px-6 gap-1">
          {mainTabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setSelectedTab(tab.id)}
              className={`flex items-center gap-2 px-4 py-2 text-sm font-medium border-b-2 transition-colors whitespace-nowrap ${
                selectedTab === tab.id
                  ? 'border-white text-white'
                  : 'border-transparent text-gray-400 hover:text-white'
              }`}
            >
              {tab.icon}
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* Content */}
      <div className={`flex-1 flex flex-col overflow-hidden ${selectedTab === 'config' ? '' : ''}`}>
        {/* Overview Tab with Subtabs */}
        {selectedTab === 'overview' && (
          <div className="flex-1 flex flex-col overflow-hidden">
            {/* Subtabs */}
            <div className="flex px-6 gap-1 border-b border-border-default bg-bg-secondary/50">
              {overviewSubTabs.map((tab) => (
                <button
                  key={tab.id}
                  onClick={() => setOverviewSubTab(tab.id)}
                  className={`flex items-center gap-2 px-3 py-2 text-xs font-medium transition-colors whitespace-nowrap rounded-t ${
                    overviewSubTab === tab.id
                      ? 'bg-bg-primary text-white'
                      : 'text-gray-400 hover:text-white hover:bg-bg-hover'
                  }`}
                >
                  {tab.icon}
                  {tab.label}
                  {tab.count !== undefined && tab.count > 0 && (
                    <span className="ml-1 px-1.5 py-0.5 text-xs bg-bg-tertiary rounded">{tab.count}</span>
                  )}
                </button>
              ))}
            </div>

            {/* Subtab Content */}
            <div className="flex-1 overflow-y-auto custom-scrollbar px-4 sm:px-6 py-6">
              {/* Info Subtab */}
              {overviewSubTab === 'info' && (
                <div className="space-y-6 max-w-3xl mx-auto">
                  {/* Description */}
                  {server.description && (
                    <div className="card p-4">
                      <p className="text-gray-300">{server.description}</p>
                    </div>
                  )}

                  {/* Info Grid */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    {/* Author */}
                    {server.packageInfo?.author && (
                      <div className="card p-4">
                        <h4 className="text-sm font-medium text-gray-400 mb-2 flex items-center gap-2">
                          <User className="w-4 h-4" />
                          Author
                        </h4>
                        {server.packageInfo.homepage ? (
                          <a
                            href={server.packageInfo.homepage}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-blue-400 hover:underline"
                          >
                            {typeof server.packageInfo.author === 'string'
                              ? server.packageInfo.author
                              : server.packageInfo.author.name || 'Unknown'}
                          </a>
                        ) : (
                          <p>
                            {typeof server.packageInfo.author === 'string'
                              ? server.packageInfo.author
                              : server.packageInfo.author.name || 'Unknown'}
                          </p>
                        )}
                      </div>
                    )}

                    <div className="card p-4">
                      <h4 className="text-sm font-medium text-gray-400 mb-2">Version</h4>
                      <p className="font-mono">{server.version || 'Unknown'}</p>
                    </div>

                    <div className="card p-4">
                      <h4 className="text-sm font-medium text-gray-400 mb-2">Install Type</h4>
                      <p className="font-mono capitalize">{server.installType}</p>
                    </div>

                    {server.localPath && (
                      <div className="card p-4 sm:col-span-2">
                        <h4 className="text-sm font-medium text-gray-400 mb-2">Local Path</h4>
                        <p className="font-mono text-sm truncate">{server.localPath}</p>
                      </div>
                    )}
                  </div>

                  {/* GitHub / Homepage buttons */}
                  {server.packageInfo && (server.packageInfo.repository || server.packageInfo.homepage) && (
                    <div className="flex items-center gap-3">
                      {server.packageInfo.repository && (
                        <a
                          href={server.packageInfo.repository}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="btn btn-secondary"
                        >
                          <Github className="w-4 h-4 mr-2" />
                          GitHub
                        </a>
                      )}
                      {server.packageInfo.homepage && (
                        <a
                          href={server.packageInfo.homepage}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="btn btn-secondary"
                        >
                          <Globe className="w-4 h-4 mr-2" />
                          Homepage
                        </a>
                      )}
                    </div>
                  )}

                  {/* Capabilities */}
                  {(metadata || server.toolsCount !== undefined) && (
                    <div>
                      <h3 className="text-sm font-medium text-gray-400 mb-3">Capabilities</h3>
                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                        <button
                          onClick={() => setOverviewSubTab('tools')}
                          className="card p-4 hover:bg-bg-hover transition-colors text-left"
                        >
                          <div className="flex items-center gap-2 mb-2">
                            <Wrench className="w-5 h-5 text-gray-400" />
                            <span className="text-2xl font-bold">
                              {metadata?.tools?.length ?? server.toolsCount ?? 0}
                            </span>
                          </div>
                          <p className="text-sm text-gray-500">Tools</p>
                        </button>
                        <button
                          onClick={() => setOverviewSubTab('resources')}
                          className="card p-4 hover:bg-bg-hover transition-colors text-left"
                        >
                          <div className="flex items-center gap-2 mb-2">
                            <FileText className="w-5 h-5 text-gray-400" />
                            <span className="text-2xl font-bold">
                              {metadata?.resources?.length ?? server.resourcesCount ?? 0}
                            </span>
                          </div>
                          <p className="text-sm text-gray-500">Resources</p>
                        </button>
                        <button
                          onClick={() => setOverviewSubTab('prompts')}
                          className="card p-4 hover:bg-bg-hover transition-colors text-left"
                        >
                          <div className="flex items-center gap-2 mb-2">
                            <MessageSquare className="w-5 h-5 text-gray-400" />
                            <span className="text-2xl font-bold">
                              {metadata?.prompts?.length ?? server.promptsCount ?? 0}
                            </span>
                          </div>
                          <p className="text-sm text-gray-500">Prompts</p>
                        </button>
                      </div>
                    </div>
                  )}

                  {/* Loading indicator for metadata */}
                  {isLoadingMeta && (
                    <div className="flex items-center justify-center py-4 text-gray-500">
                      <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                      Loading server metadata...
                    </div>
                  )}

                  {/* Note about running server */}
                  {server.status !== 'running' && (
                    <Alert variant="info">
                      Start the server to view detailed capabilities like tools, resources, and prompts.
                    </Alert>
                  )}
                </div>
              )}

              {/* Connection Subtab */}
              {overviewSubTab === 'connection' && (
                <div className="space-y-6 max-w-3xl mx-auto">
                  {/* Connection Info */}
                  <div className="card p-4">
                    <h3 className="text-sm font-medium text-gray-400 mb-4">Server Endpoint</h3>

                    {server.status === 'running' && server.port ? (
                      <div className="space-y-4">
                        <div className="flex items-center gap-3">
                          <code className="flex-1 px-4 py-3 bg-bg-tertiary rounded-md font-mono text-sm">
                            http://127.0.0.1:{server.port}
                          </code>
                          <button
                            onClick={handleCopyUrl}
                            className="btn btn-secondary"
                            title="Copy URL"
                          >
                            {copiedUrl ? (
                              <Check className="w-4 h-4 text-emerald-400" />
                            ) : (
                              <Copy className="w-4 h-4" />
                            )}
                          </button>
                        </div>

                        <div className="grid grid-cols-2 gap-4 text-sm">
                          <div>
                            <span className="text-gray-500">Host:</span>
                            <span className="ml-2 font-mono">127.0.0.1</span>
                          </div>
                          <div>
                            <span className="text-gray-500">Port:</span>
                            <span className="ml-2 font-mono">{server.port}</span>
                          </div>
                        </div>

                        {/* Health Check */}
                        <div className="pt-4 border-t border-border-default">
                          <div className="flex items-center gap-3">
                            <button
                              onClick={handleHealthCheck}
                              disabled={healthStatus === 'checking'}
                              className="btn btn-secondary"
                            >
                              {healthStatus === 'checking' ? (
                                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                              ) : (
                                <RefreshCw className="w-4 h-4 mr-2" />
                              )}
                              Check Health
                            </button>

                            {healthStatus === 'ok' && (
                              <span className="flex items-center gap-2 text-emerald-400 text-sm">
                                <Check className="w-4 h-4" />
                                Server is healthy
                              </span>
                            )}

                            {healthStatus === 'error' && (
                              <span className="flex items-center gap-2 text-red-400 text-sm">
                                Health check failed: {healthError}
                              </span>
                            )}
                          </div>
                        </div>
                      </div>
                    ) : (
                      <Alert variant="warning">
                        Server is not running. Start the server to see connection details.
                      </Alert>
                    )}
                  </div>

                  {/* Auth Status */}
                  <AuthorizationCard
                    serverId={serverId}
                    workspaceId={workspaceId}
                    serverStatus={server.status}
                    authInfo={metadata?.auth}
                    onRestartServer={handleRestart}
                  />
                </div>
              )}

              {/* Tools Subtab */}
              {overviewSubTab === 'tools' && (
                <div className="space-y-4 max-w-3xl mx-auto">
                  {metadata?.tools && metadata.tools.length > 0 ? (
                    <Accordion>
                      {metadata.tools.map((tool) => (
                        <AccordionItem key={tool.name}>
                          <AccordionTrigger>
                            <div className="flex items-center gap-3 min-w-0">
                              <Wrench className="w-4 h-4 text-gray-500 flex-shrink-0" />
                              <span className="font-mono text-sm font-medium">{tool.name}</span>
                              {tool.description && (
                                <span className="text-gray-500 text-sm truncate">
                                  {truncateDescription(tool.description)}
                                </span>
                              )}
                            </div>
                          </AccordionTrigger>
                          <AccordionContent>
                            <div className="space-y-4">
                              {tool.description && (
                                <p className="text-gray-300">{tool.description}</p>
                              )}

                              {tool.inputSchema && (
                                <div>
                                  <div className="flex items-center gap-2 mb-2 text-sm text-gray-400">
                                    <Code className="w-4 h-4" />
                                    Input Schema
                                  </div>
                                  <CodeBlock code={JSON.stringify(tool.inputSchema, null, 2)} />
                                </div>
                              )}

                              <div>
                                <div className="flex items-center gap-2 mb-2 text-sm text-gray-400">
                                  <Code className="w-4 h-4" />
                                  Raw JSON
                                </div>
                                <CodeBlock code={JSON.stringify(tool, null, 2)} />
                              </div>
                            </div>
                          </AccordionContent>
                        </AccordionItem>
                      ))}
                    </Accordion>
                  ) : server.status === 'running' ? (
                    <Alert variant="info">This server does not expose any tools.</Alert>
                  ) : (
                    <Alert variant="info">Start the server to view available tools.</Alert>
                  )}
                </div>
              )}

              {/* Resources Subtab */}
              {overviewSubTab === 'resources' && (
                <div className="space-y-4 max-w-3xl mx-auto">
                  {metadata?.resources && metadata.resources.length > 0 ? (
                    <Accordion>
                      {metadata.resources.map((resource) => (
                        <AccordionItem key={resource.uri}>
                          <AccordionTrigger>
                            <div className="flex items-center gap-3 min-w-0">
                              <FileText className="w-4 h-4 text-gray-500 flex-shrink-0" />
                              <span className="font-mono text-sm font-medium">{resource.name}</span>
                              {resource.description && (
                                <span className="text-gray-500 text-sm truncate">
                                  {truncateDescription(resource.description)}
                                </span>
                              )}
                            </div>
                          </AccordionTrigger>
                          <AccordionContent>
                            <div className="space-y-4">
                              <div className="space-y-2 text-sm">
                                <div>
                                  <span className="text-gray-500">URI:</span>
                                  <code className="ml-2 font-mono text-blue-400">{resource.uri}</code>
                                </div>
                                {resource.mimeType && (
                                  <div>
                                    <span className="text-gray-500">MIME Type:</span>
                                    <span className="ml-2 font-mono">{resource.mimeType}</span>
                                  </div>
                                )}
                              </div>

                              {resource.description && (
                                <p className="text-gray-300">{resource.description}</p>
                              )}

                              <div>
                                <div className="flex items-center gap-2 mb-2 text-sm text-gray-400">
                                  <Code className="w-4 h-4" />
                                  Raw JSON
                                </div>
                                <CodeBlock code={JSON.stringify(resource, null, 2)} />
                              </div>
                            </div>
                          </AccordionContent>
                        </AccordionItem>
                      ))}
                    </Accordion>
                  ) : server.status === 'running' ? (
                    <Alert variant="info">This server does not expose any resources.</Alert>
                  ) : (
                    <Alert variant="info">Start the server to view available resources.</Alert>
                  )}
                </div>
              )}

              {/* Prompts Subtab */}
              {overviewSubTab === 'prompts' && (
                <div className="space-y-4 max-w-3xl mx-auto">
                  {metadata?.prompts && metadata.prompts.length > 0 ? (
                    <Accordion>
                      {metadata.prompts.map((prompt) => (
                        <AccordionItem key={prompt.name}>
                          <AccordionTrigger>
                            <div className="flex items-center gap-3 min-w-0">
                              <MessageSquare className="w-4 h-4 text-gray-500 flex-shrink-0" />
                              <span className="font-mono text-sm font-medium">{prompt.name}</span>
                              {prompt.description && (
                                <span className="text-gray-500 text-sm truncate">
                                  {truncateDescription(prompt.description)}
                                </span>
                              )}
                            </div>
                          </AccordionTrigger>
                          <AccordionContent>
                            <div className="space-y-4">
                              {prompt.description && (
                                <p className="text-gray-300">{prompt.description}</p>
                              )}

                              {prompt.arguments && prompt.arguments.length > 0 && (
                                <div>
                                  <h4 className="text-sm font-medium text-gray-400 mb-2">Arguments</h4>
                                  <div className="space-y-2">
                                    {prompt.arguments.map((arg) => (
                                      <div key={arg.name} className="px-3 py-2 bg-bg-tertiary rounded text-sm">
                                        <span className="font-mono text-blue-400">{arg.name}</span>
                                        {arg.required && (
                                          <span className="ml-2 text-red-400 text-xs">required</span>
                                        )}
                                        {arg.description && (
                                          <p className="text-gray-500 mt-1">{arg.description}</p>
                                        )}
                                      </div>
                                    ))}
                                  </div>
                                </div>
                              )}

                              <div>
                                <div className="flex items-center gap-2 mb-2 text-sm text-gray-400">
                                  <Code className="w-4 h-4" />
                                  Raw JSON
                                </div>
                                <CodeBlock code={JSON.stringify(prompt, null, 2)} />
                              </div>
                            </div>
                          </AccordionContent>
                        </AccordionItem>
                      ))}
                    </Accordion>
                  ) : server.status === 'running' ? (
                    <Alert variant="info">This server does not expose any prompts.</Alert>
                  ) : (
                    <Alert variant="info">Start the server to view available prompts.</Alert>
                  )}
                </div>
              )}
            </div>
          </div>
        )}

        {/* Config Tab */}
        {selectedTab === 'config' && (
          <div className="flex-1 flex flex-col overflow-hidden px-4 sm:px-6 py-6">
            <ServerConfigEditor
              serverId={serverId}
              workspaceId={workspaceId}
              configSchema={server.configSchema || metadata?.config?.schema}
              defaultConfig={server.defaultConfig}
            />
          </div>
        )}

        {/* Secrets Tab */}
        {selectedTab === 'secrets' && (
          <div className="flex-1 flex flex-col overflow-hidden px-4 sm:px-6 py-6">
            <ServerSecretsManager
              serverId={serverId}
              serverName={server.displayName}
              workspaceId={workspaceId}
            />
          </div>
        )}
      </div>
    </div>
  );
}
