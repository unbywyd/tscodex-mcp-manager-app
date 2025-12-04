/**
 * Resource Editor - Create/edit dynamic resources
 */

import { useState, useEffect } from 'react';
import { X, Check, AlertCircle, Globe, Code, FileText } from 'lucide-react';
import { useMcpToolsStore } from '../../stores/mcpToolsStore';
import type { DynamicResource, ResourceExecutor, EditorMode } from '../../../host/mcp-tools/types';
import { cn } from '../../lib/utils';
import { Select } from '../ui/select';
import { CodeEditor } from '../ui/code-editor';
import { JsonEditor } from '../ui/json-editor';
import { RichTextEditor } from '../ui/rich-text-editor';
import { MarkdownEditor } from '../ui/markdown-editor';

interface ResourceEditorProps {
  resource?: DynamicResource;
  onClose: () => void;
}

export function ResourceEditor({ resource, onClose }: ResourceEditorProps) {
  const { createResource, updateResource, validateName, validateFunction } = useMcpToolsStore();

  // Form state
  const [name, setName] = useState(resource?.name || '');
  const [description, setDescription] = useState(resource?.description || '');
  const [enabled, setEnabled] = useState(resource?.enabled ?? true);
  const [uri, setUri] = useState(resource?.uri || '');
  const [mimeType, setMimeType] = useState(resource?.mimeType || 'text/plain');
  const [executorType, setExecutorType] = useState<'static' | 'http' | 'function'>(
    resource?.executor.type || 'static'
  );

  // Executor-specific state
  const [staticContent, setStaticContent] = useState(
    resource?.executor.type === 'static' ? resource.executor.content : ''
  );
  const [staticContentType, setStaticContentType] = useState<'text' | 'json'>(
    resource?.executor.type === 'static' ? resource.executor.contentType : 'text'
  );
  // Editor mode for syntax highlighting - persisted in executor
  const [editorMode, setEditorMode] = useState<EditorMode>(
    resource?.executor.type === 'static'
      ? (resource.executor.editorMode || (resource.executor.contentType === 'json' ? 'json' : 'text'))
      : 'text'
  );

  const [httpUrl, setHttpUrl] = useState(
    resource?.executor.type === 'http' ? resource.executor.url : ''
  );
  const [httpHeaders, setHttpHeaders] = useState(
    resource?.executor.type === 'http' ? JSON.stringify(resource.executor.headers || {}, null, 2) : '{}'
  );

  const [functionCode, setFunctionCode] = useState(
    resource?.executor.type === 'function'
      ? resource.executor.code
      : 'async (params, context) => {\n  // Your code here\n  return "Resource content";\n}'
  );

  // Validation state
  const [nameError, setNameError] = useState<string | null>(null);
  const [headersJsonError, setHeadersJsonError] = useState<string | null>(null);
  const [staticJsonError, setStaticJsonError] = useState<string | null>(null);
  const [functionError, setFunctionError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Validate name on change
  useEffect(() => {
    const timer = setTimeout(async () => {
      if (!name) {
        setNameError(null);
        return;
      }
      try {
        const result = await validateName(name, 'resource', resource?.id);
        setNameError(result.valid ? null : result.error || 'Invalid name');
      } catch {
        setNameError(null);
      }
    }, 300);
    return () => clearTimeout(timer);
  }, [name, resource?.id, validateName]);

  // Validate function on change
  useEffect(() => {
    if (executorType !== 'function') {
      setFunctionError(null);
      return;
    }
    const timer = setTimeout(async () => {
      try {
        const result = await validateFunction(functionCode);
        setFunctionError(result.valid ? null : result.error || 'Invalid function');
      } catch {
        setFunctionError(null);
      }
    }, 300);
    return () => clearTimeout(timer);
  }, [functionCode, executorType, validateFunction]);

  const handleSubmit = async () => {
    if (!name || nameError || !uri) return;
    if (executorType === 'function' && functionError) return;

    // Build executor
    let executor: ResourceExecutor;
    switch (executorType) {
      case 'static':
        executor = {
          type: 'static',
          content: staticContent,
          contentType: staticContentType,
          editorMode: editorMode,
        };
        break;
      case 'http':
        executor = {
          type: 'http',
          method: 'GET',
          url: httpUrl,
          headers: httpHeaders ? JSON.parse(httpHeaders) : undefined,
        };
        break;
      case 'function':
        executor = {
          type: 'function',
          code: functionCode,
        };
        break;
    }

    setIsSubmitting(true);
    try {
      const data = {
        name,
        description,
        enabled,
        uri,
        mimeType,
        executor,
      };

      if (resource) {
        await updateResource(resource.id, data);
      } else {
        await createResource(data);
      }
      onClose();
    } catch (error) {
      console.error('Failed to save resource:', error);
      alert((error as Error).message);
    } finally {
      setIsSubmitting(false);
    }
  };

  const hasJsonErrors = headersJsonError || (editorMode === 'json' && staticJsonError);
  const isValid = name && !nameError && uri && !hasJsonErrors && (executorType !== 'function' || !functionError);

  return (
    <div className="flex flex-col h-full max-h-[90vh]">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-gray-700">
        <h2 className="text-lg font-semibold text-white">
          {resource ? 'Edit Resource' : 'New Resource'}
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
                placeholder="my_resource_name"
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
              placeholder="What is this resource?"
              className="w-full px-3 py-2 bg-bg-secondary border border-border-default rounded-md text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-white/50"
            />
          </div>

          <div className="flex gap-4">
            <div className="flex-1">
              <label className="block text-sm font-medium text-gray-300 mb-1">
                URI <span className="text-red-400">*</span>
              </label>
              <input
                type="text"
                value={uri}
                onChange={(e) => setUri(e.target.value)}
                placeholder="custom://my-resource"
                className="w-full px-3 py-2 bg-bg-secondary border border-border-default rounded-md text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-white/50"
              />
            </div>
            <div className="w-48">
              <label className="block text-sm font-medium text-gray-300 mb-1">
                MIME Type
              </label>
              <Select
                value={mimeType}
                onChange={setMimeType}
                options={[
                  { value: 'text/plain', label: 'text/plain' },
                  { value: 'text/markdown', label: 'text/markdown' },
                  { value: 'text/html', label: 'text/html' },
                  { value: 'application/json', label: 'application/json' },
                  { value: 'application/xml', label: 'application/xml' },
                ]}
              />
            </div>
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

        {/* Executor Type */}
        <div>
          <label className="block text-sm font-medium text-gray-300 mb-2">
            Content Source
          </label>
          <div className="flex gap-2">
            {[
              { type: 'static' as const, icon: FileText, label: 'Static' },
              { type: 'http' as const, icon: Globe, label: 'HTTP' },
              { type: 'function' as const, icon: Code, label: 'Function' },
            ].map(({ type, icon: Icon, label }) => (
              <button
                key={type}
                onClick={() => setExecutorType(type)}
                className={cn(
                  'flex items-center gap-2 px-4 py-2 rounded-md border transition-colors',
                  executorType === type
                    ? 'bg-white/10 border-white text-white'
                    : 'bg-gray-700 border-gray-600 text-gray-400 hover:border-gray-500'
                )}
              >
                <Icon size={16} />
                {label}
              </button>
            ))}
          </div>
        </div>

        {/* Executor Config */}
        <div className="border border-gray-700 rounded-md p-4">
          {executorType === 'static' && (
            <div className="space-y-3">
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-1">
                  Content Type
                </label>
                <Select
                  value={editorMode}
                  onChange={(v) => {
                    const mode = v as EditorMode;
                    setEditorMode(mode);
                    // Auto-set response type: json for JSON, text for everything else
                    setStaticContentType(mode === 'json' ? 'json' : 'text');
                  }}
                  options={[
                    { value: 'text', label: 'Plain Text' },
                    { value: 'markdown', label: 'Markdown' },
                    { value: 'html', label: 'HTML' },
                    { value: 'json', label: 'JSON' },
                    { value: 'javascript', label: 'JavaScript' },
                  ]}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-1">
                  Content
                </label>
                {editorMode === 'html' ? (
                  <RichTextEditor
                    value={staticContent}
                    onChange={setStaticContent}
                    placeholder="Write your HTML content..."
                  />
                ) : editorMode === 'markdown' ? (
                  <MarkdownEditor
                    value={staticContent}
                    onChange={setStaticContent}
                    placeholder="Write your markdown content..."
                  />
                ) : editorMode === 'text' ? (
                  <textarea
                    value={staticContent}
                    onChange={(e) => setStaticContent(e.target.value)}
                    placeholder="Enter plain text content..."
                    className="w-full px-3 py-2 bg-bg-secondary border border-border-default rounded-md text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-white/50 font-mono text-sm min-h-[180px] resize-y"
                  />
                ) : editorMode === 'json' ? (
                  <JsonEditor
                    value={staticContent}
                    onChange={setStaticContent}
                    onValidChange={(valid, error) => setStaticJsonError(valid ? null : error || 'Invalid JSON')}
                    minHeight="180px"
                    placeholder='{"key": "value"}'
                  />
                ) : (
                  <CodeEditor
                    value={staticContent}
                    onChange={setStaticContent}
                    language={editorMode}
                    minHeight="180px"
                    placeholder="Your code..."
                  />
                )}
              </div>
            </div>
          )}

          {executorType === 'http' && (
            <div className="space-y-3">
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-1">
                  URL
                </label>
                <input
                  type="text"
                  value={httpUrl}
                  onChange={(e) => setHttpUrl(e.target.value)}
                  placeholder="https://api.example.com/resource"
                  className="w-full px-3 py-2 bg-bg-secondary border border-border-default rounded-md text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-white/50"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-1">
                  Headers (JSON)
                </label>
                <JsonEditor
                  value={httpHeaders}
                  onChange={setHttpHeaders}
                  onValidChange={(valid, error) => setHeadersJsonError(valid ? null : error || 'Invalid JSON')}
                  minHeight="80px"
                  placeholder='{"Authorization": "Bearer {{SECRET_AUTH_TOKEN}}"}'
                />
              </div>
              <div className="text-xs text-gray-500 space-y-1">
                <p className="font-medium">Available placeholders:</p>
                <ul className="list-disc list-inside ml-2 space-y-0.5">
                  <li><code>{'{{SECRET_KEY_NAME}}'}</code> - Secret (e.g., <code>{'{{SECRET_API_KEY}}'}</code>)</li>
                  <li><code>{'{{SESSION.workspaceId}}'}</code> - Current workspace ID</li>
                  <li><code>{'{{SESSION.projectRoot}}'}</code> - Project root path</li>
                </ul>
              </div>
            </div>
          )}

          {executorType === 'function' && (
            <div className="space-y-3">
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-1">
                  Function Code
                </label>
                <CodeEditor
                  value={functionCode}
                  onChange={setFunctionCode}
                  language="javascript"
                  minHeight="220px"
                  className={cn(functionError && 'border-red-500')}
                />
                {functionError && <p className="text-xs text-red-400 mt-1">{functionError}</p>}
              </div>
              <div className="text-xs text-gray-500 space-y-1">
                <p className="font-medium">Available in context:</p>
                <ul className="list-disc list-inside ml-2 space-y-0.5">
                  <li><code>params</code> - Empty object for resources</li>
                  <li><code>context.session.workspaceId</code> - Current workspace ID</li>
                  <li><code>context.session.projectRoot</code> - Project root path</li>
                  <li><code>context.utils.fetch</code> - HTTP fetch function</li>
                  <li><code>context.utils.log</code> - Logging function</li>
                </ul>
                <p className="mt-1">Return the resource content as a string or object.</p>
                <p className="text-amber-400 mt-2">
                  Note: Secrets are NOT accessible in function executor for security reasons.
                </p>
              </div>
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
          {resource ? 'Save' : 'Create'}
        </button>
      </div>
    </div>
  );
}
