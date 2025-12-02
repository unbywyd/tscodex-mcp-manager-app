import React, { useState, useEffect, lazy, Suspense } from 'react';
import {
  Save,
  RotateCcw,
  AlertCircle,
  CheckCircle,
  Info,
  ChevronDown,
  ChevronRight,
  Plus,
  Trash2,
  Minus,
  Loader2,
} from 'lucide-react';
import { Select } from '../ui/select';
import { validateSchema, ValidationError, getErrorsForPath } from '../../lib/schema-validator';

// Lazy load heavy editor components
const RichTextEditor = lazy(() =>
  import('../ui/rich-text-editor').then((m) => ({ default: m.RichTextEditor }))
);
const CodeEditor = lazy(() =>
  import('../ui/code-editor').then((m) => ({ default: m.CodeEditor }))
);
const MarkdownEditor = lazy(() =>
  import('../ui/markdown-editor').then((m) => ({ default: m.MarkdownEditor }))
);

interface ServerConfigEditorProps {
  serverId: string;
  workspaceId: string;
  configSchema?: Record<string, unknown>;
  defaultConfig: Record<string, unknown>;
}

interface SchemaProperty {
  type?: string | string[];
  title?: string;
  description?: string;
  default?: unknown;
  enum?: unknown[];
  format?: string;
  minimum?: number;
  maximum?: number;
  exclusiveMinimum?: number;
  exclusiveMaximum?: number;
  multipleOf?: number;
  minLength?: number;
  maxLength?: number;
  pattern?: string;
  minItems?: number;
  maxItems?: number;
  uniqueItems?: boolean;
  items?: SchemaProperty;
  properties?: Record<string, SchemaProperty>;
  required?: string[];
  additionalProperties?: boolean | SchemaProperty;
  minProperties?: number;
  maxProperties?: number;
}

// Editor loading placeholder
function EditorLoading() {
  return (
    <div className="flex items-center justify-center h-[150px] border border-border-default rounded-md bg-bg-secondary">
      <Loader2 className="w-5 h-5 animate-spin text-gray-500" />
    </div>
  );
}

const API_BASE = 'http://127.0.0.1:4040/api';

// Parse schema if it's a TypeBox schema
function parseSchema(schema: unknown): SchemaProperty | null {
  if (!schema) return null;

  const s = schema as Record<string, unknown>;

  // Handle TypeBox format
  if (s.type) return s as unknown as SchemaProperty;

  // Handle properties directly
  if (s.properties) {
    return {
      type: 'object',
      properties: s.properties as Record<string, SchemaProperty>,
      required: s.required as string[] | undefined,
    };
  }

  return null;
}

// Extract default values from schema
function getSchemaDefaults(schema: SchemaProperty): Record<string, unknown> {
  const defaults: Record<string, unknown> = {};

  if (schema.properties) {
    for (const [key, propSchema] of Object.entries(schema.properties)) {
      if (propSchema.default !== undefined) {
        defaults[key] = propSchema.default;
      }
    }
  }

  return defaults;
}

export function ServerConfigEditor({
  serverId,
  workspaceId,
  configSchema,
  defaultConfig,
}: ServerConfigEditorProps) {
  const [config, setConfig] = useState<Record<string, unknown>>(defaultConfig || {});
  const [originalConfig, setOriginalConfig] = useState<Record<string, unknown>>(defaultConfig || {});
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [hasChanges, setHasChanges] = useState(false);
  const [expandedSections, setExpandedSections] = useState<Set<string>>(new Set());
  const [validationErrors, setValidationErrors] = useState<ValidationError[]>([]);

  // Load current config on mount
  useEffect(() => {
    loadConfig();
  }, [serverId, workspaceId]);

  // Check for changes and validate
  useEffect(() => {
    const changed = JSON.stringify(config) !== JSON.stringify(originalConfig);
    setHasChanges(changed);

    // Validate config against schema
    const parsedSchema = parseSchema(configSchema);
    if (parsedSchema) {
      const result = validateSchema(config, parsedSchema);
      setValidationErrors(result.errors);
    }
  }, [config, originalConfig, configSchema]);

  const loadConfig = async () => {
    // Get schema defaults
    const parsedSchema = parseSchema(configSchema);
    const schemaDefaults = parsedSchema ? getSchemaDefaults(parsedSchema) : {};

    try {
      // In a real implementation, load from workspace-specific config override
      const response = await fetch(
        `${API_BASE}/workspaces/${workspaceId}/servers/${serverId}/config`
      );
      if (response.ok) {
        const data = await response.json();
        if (data.success && data.config) {
          const mergedConfig = { ...schemaDefaults, ...defaultConfig, ...data.config };
          setConfig(mergedConfig);
          setOriginalConfig(mergedConfig);
          return;
        }
      }
    } catch {
      // Fall through to default handling
    }

    // Use default config if no override exists
    const mergedConfig = { ...schemaDefaults, ...defaultConfig };
    setConfig(mergedConfig);
    setOriginalConfig(mergedConfig);
  };

  const handleSave = async () => {
    // Validate before saving
    if (validationErrors.length > 0) {
      setError(`Please fix ${validationErrors.length} validation error(s) before saving`);
      return;
    }

    setIsSaving(true);
    setError(null);
    setSuccess(null);

    try {
      const response = await fetch(
        `${API_BASE}/workspaces/${workspaceId}/servers/${serverId}/config`,
        {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ config }),
        }
      );

      const data = await response.json();
      if (!data.success) {
        throw new Error(data.error || 'Failed to save configuration');
      }

      setOriginalConfig(config);
      setSuccess('Configuration saved successfully');
      setTimeout(() => setSuccess(null), 3000);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save configuration');
    }

    setIsSaving(false);
  };

  const handleReset = () => {
    setConfig(originalConfig);
    setError(null);
    setSuccess(null);
  };

  const handleResetToDefault = () => {
    setConfig(defaultConfig || {});
    setError(null);
    setSuccess(null);
  };

  const updateValue = (path: string[], value: unknown) => {
    setConfig((prev) => {
      const newConfig = { ...prev };
      let current: any = newConfig;

      for (let i = 0; i < path.length - 1; i++) {
        if (current[path[i]] === undefined) {
          current[path[i]] = {};
        } else {
          current[path[i]] = { ...current[path[i]] };
        }
        current = current[path[i]];
      }

      current[path[path.length - 1]] = value;
      return newConfig;
    });
  };

  const deleteValue = (path: string[]) => {
    setConfig((prev) => {
      const newConfig = JSON.parse(JSON.stringify(prev));
      let current: any = newConfig;

      for (let i = 0; i < path.length - 1; i++) {
        if (current[path[i]] === undefined) return prev;
        current = current[path[i]];
      }

      delete current[path[path.length - 1]];
      return newConfig;
    });
  };

  const toggleSection = (path: string) => {
    setExpandedSections((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(path)) {
        newSet.delete(path);
      } else {
        newSet.add(path);
      }
      return newSet;
    });
  };

  const getValue = (path: string[]): unknown => {
    let current: any = config;
    for (const key of path) {
      if (current === undefined || current === null) return undefined;
      current = current[key];
    }
    return current;
  };

  const renderField = (
    key: string,
    schema: SchemaProperty,
    path: string[],
    isRequired: boolean = false
  ): React.ReactNode => {
    const fullPath = [...path, key];
    const pathStr = fullPath.join('.');
    const value = getValue(fullPath);
    const type = Array.isArray(schema.type) ? schema.type[0] : schema.type;

    // Handle nested objects
    if (type === 'object' && schema.properties) {
      const isExpanded = expandedSections.has(pathStr);
      return (
        <div key={pathStr} className="card p-4">
          <button
            onClick={() => toggleSection(pathStr)}
            className="flex items-center gap-2 w-full text-left"
          >
            {isExpanded ? (
              <ChevronDown className="w-4 h-4 text-gray-500" />
            ) : (
              <ChevronRight className="w-4 h-4 text-gray-500" />
            )}
            <span className="font-medium">{schema.title || key}</span>
            {schema.description && (
              <span className="text-xs text-gray-500 ml-2">{schema.description}</span>
            )}
          </button>
          {isExpanded && (
            <div className="mt-4 pl-6 space-y-4 border-l border-border-default">
              {Object.entries(schema.properties).map(([propKey, propSchema]) =>
                renderField(
                  propKey,
                  propSchema as SchemaProperty,
                  fullPath,
                  schema.required?.includes(propKey)
                )
              )}
            </div>
          )}
        </div>
      );
    }

    // Handle arrays
    if (type === 'array') {
      const arrayValue = (value as unknown[]) || [];
      const isExpanded = expandedSections.has(pathStr);

      return (
        <div key={pathStr} className="card p-4">
          <button
            onClick={() => toggleSection(pathStr)}
            className="flex items-center gap-2 w-full text-left"
          >
            {isExpanded ? (
              <ChevronDown className="w-4 h-4 text-gray-500" />
            ) : (
              <ChevronRight className="w-4 h-4 text-gray-500" />
            )}
            <span className="font-medium">{schema.title || key}</span>
            <span className="text-xs text-gray-500">({arrayValue.length} items)</span>
          </button>
          {isExpanded && (
            <div className="mt-4 space-y-2">
              {arrayValue.map((_, index) => (
                <div key={index} className="flex items-center gap-2">
                  {renderArrayItem(fullPath, index, schema.items)}
                  <button
                    onClick={() => {
                      const newArray = [...arrayValue];
                      newArray.splice(index, 1);
                      updateValue(fullPath, newArray);
                    }}
                    className="btn-icon text-red-400 hover:text-red-300"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              ))}
              <button
                onClick={() => {
                  const defaultItem = getDefaultValue(schema.items);
                  updateValue(fullPath, [...arrayValue, defaultItem]);
                }}
                className="btn btn-secondary text-sm"
              >
                <Plus className="w-4 h-4 mr-1" />
                Add Item
              </button>
            </div>
          )}
        </div>
      );
    }

    // Get validation errors for this field
    const fieldErrors = getErrorsForPath(validationErrors, fullPath);
    const hasError = fieldErrors.length > 0;

    // Render basic field
    return (
      <div key={pathStr} className="space-y-1">
        <label className="flex items-center gap-2 text-sm font-medium text-gray-400">
          {schema.title || key}
          {isRequired && <span className="text-red-400">*</span>}
        </label>
        {renderInput(fullPath, schema, value, hasError)}
        {schema.description && (
          <p className="text-xs text-gray-500">{schema.description}</p>
        )}
        {hasError && (
          <p className="text-xs text-red-400">{fieldErrors[0].message}</p>
        )}
      </div>
    );
  };

  const renderInput = (
    path: string[],
    schema: SchemaProperty,
    value: unknown,
    hasError: boolean = false
  ): React.ReactNode => {
    const type = Array.isArray(schema.type) ? schema.type[0] : schema.type;
    const format = schema.format;
    const errorClass = hasError ? 'border-red-500' : '';

    // Enum (select)
    if (schema.enum) {
      const options = schema.enum.map((option) => ({
        value: String(option),
        label: String(option),
      }));

      return (
        <Select
          value={String(value ?? schema.default ?? '')}
          onChange={(newValue) => updateValue(path, newValue)}
          options={options}
          placeholder="Select..."
          className={errorClass}
        />
      );
    }

    // Boolean (checkbox)
    if (type === 'boolean') {
      return (
        <label className="flex items-center gap-2 cursor-pointer">
          <input
            type="checkbox"
            checked={Boolean(value ?? schema.default)}
            onChange={(e) => updateValue(path, e.target.checked)}
            className="form-checkbox"
          />
          <span className="text-sm text-gray-400">Enabled</span>
        </label>
      );
    }

    // Number
    if (type === 'number' || type === 'integer') {
      const currentValue = value !== undefined ? Number(value) : (schema.default !== undefined ? Number(schema.default) : 0);
      const isInteger = type === 'integer';
      const isWholeNumber = Number.isInteger(currentValue);
      const step = (isInteger || isWholeNumber) ? 1 : 0.1;

      const handleIncrement = () => {
        let newValue: number;
        if (isInteger || isWholeNumber) {
          newValue = Math.round(currentValue) + 1;
        } else {
          const precision = step.toString().split('.')[1]?.length || 0;
          const multiplier = Math.pow(10, precision);
          newValue = Math.round((currentValue * multiplier + step * multiplier)) / multiplier;
        }

        if (schema.maximum !== undefined && newValue > schema.maximum) {
          newValue = schema.maximum;
        }
        updateValue(path, (isInteger || isWholeNumber) ? Math.round(newValue) : newValue);
      };

      const handleDecrement = () => {
        let newValue: number;
        if (isInteger || isWholeNumber) {
          newValue = Math.round(currentValue) - 1;
        } else {
          const precision = step.toString().split('.')[1]?.length || 0;
          const multiplier = Math.pow(10, precision);
          newValue = Math.round((currentValue * multiplier - step * multiplier)) / multiplier;
        }

        if (schema.minimum !== undefined && newValue < schema.minimum) {
          newValue = schema.minimum;
        }
        updateValue(path, (isInteger || isWholeNumber) ? Math.round(newValue) : newValue);
      };

      return (
        <div className={`flex items-stretch ${errorClass ? 'ring-1 ring-red-500 rounded-md' : ''}`}>
          <button
            type="button"
            onClick={handleDecrement}
            className="px-3 bg-bg-secondary border border-border-default border-r-0 rounded-l-md hover:bg-bg-hover transition-colors flex items-center justify-center"
          >
            <Minus className="w-4 h-4 text-gray-400" />
          </button>
          <input
            type="text"
            inputMode="numeric"
            value={value !== undefined
              ? (type === 'integer' || Number.isInteger(Number(value))
                  ? String(Math.round(Number(value)))
                  : String(Number(value)))
              : String(schema.default ?? '')}
            onChange={(e) => {
              const val = e.target.value;
              if (val === '' || val === '-') {
                updateValue(path, val === '-' ? val : undefined);
                return;
              }
              const num = type === 'integer' ? parseInt(val, 10) : parseFloat(val);
              if (!isNaN(num)) {
                updateValue(path, num);
              }
            }}
            className="flex-1 px-3 py-2 bg-bg-secondary border-y border-border-default text-center font-mono text-sm focus:outline-none h-auto"
            placeholder={schema.default !== undefined ? String(schema.default) : '0'}
          />
          <button
            type="button"
            onClick={handleIncrement}
            className="px-3 bg-bg-secondary border border-border-default border-l-0 rounded-r-md hover:bg-bg-hover transition-colors flex items-center justify-center"
          >
            <Plus className="w-4 h-4 text-gray-400" />
          </button>
        </div>
      );
    }

    // String with format
    if (type === 'string' && format) {
      const strValue = String(value ?? schema.default ?? '');

      // HTML Editor
      if (format === 'html') {
        return (
          <Suspense fallback={<EditorLoading />}>
            <RichTextEditor
              value={strValue}
              onChange={(newValue) => updateValue(path, newValue)}
              placeholder={schema.description || 'Enter HTML content...'}
              className={errorClass}
            />
          </Suspense>
        );
      }

      // Markdown Editor
      if (format === 'markdown') {
        return (
          <Suspense fallback={<EditorLoading />}>
            <MarkdownEditor
              value={strValue}
              onChange={(newValue) => updateValue(path, newValue)}
              placeholder={schema.description || 'Write markdown...'}
              className={errorClass}
            />
          </Suspense>
        );
      }

      // Code Editor (json, javascript, typescript, code)
      if (['code', 'json', 'javascript', 'typescript'].includes(format)) {
        const lang = format === 'code' ? 'text' : format;
        return (
          <Suspense fallback={<EditorLoading />}>
            <CodeEditor
              value={strValue}
              onChange={(newValue) => updateValue(path, newValue)}
              language={lang as 'json' | 'javascript' | 'typescript' | 'text'}
              placeholder={schema.description}
              className={errorClass}
            />
          </Suspense>
        );
      }

      // Textarea for multiline format
      if (format === 'textarea' || format === 'multiline') {
        return (
          <textarea
            value={strValue}
            onChange={(e) => updateValue(path, e.target.value)}
            minLength={schema.minLength}
            maxLength={schema.maxLength}
            className={`input font-mono text-sm min-h-[100px] resize-y ${errorClass}`}
            placeholder={schema.default !== undefined ? String(schema.default) : undefined}
          />
        );
      }

      // URI/URL format
      if (format === 'uri' || format === 'url') {
        return (
          <input
            type="url"
            value={strValue}
            onChange={(e) => updateValue(path, e.target.value)}
            className={`input font-mono text-sm ${errorClass}`}
            placeholder="https://example.com"
          />
        );
      }

      // Email format
      if (format === 'email') {
        return (
          <input
            type="email"
            value={strValue}
            onChange={(e) => updateValue(path, e.target.value)}
            className={`input font-mono text-sm ${errorClass}`}
            placeholder="user@example.com"
          />
        );
      }

      // Date format
      if (format === 'date') {
        return (
          <input
            type="date"
            value={strValue}
            onChange={(e) => updateValue(path, e.target.value)}
            className={`input font-mono text-sm ${errorClass}`}
          />
        );
      }

      // Time format
      if (format === 'time') {
        return (
          <input
            type="time"
            value={strValue}
            onChange={(e) => updateValue(path, e.target.value)}
            className={`input font-mono text-sm ${errorClass}`}
          />
        );
      }

      // Date-time format
      if (format === 'date-time') {
        return (
          <input
            type="datetime-local"
            value={strValue}
            onChange={(e) => updateValue(path, e.target.value)}
            className={`input font-mono text-sm ${errorClass}`}
          />
        );
      }

      // Password format
      if (format === 'password') {
        return (
          <input
            type="password"
            value={strValue}
            onChange={(e) => updateValue(path, e.target.value)}
            className={`input font-mono text-sm ${errorClass}`}
            placeholder="••••••••"
          />
        );
      }
    }

    // String (default)
    return (
      <input
        type="text"
        value={String(value ?? schema.default ?? '')}
        onChange={(e) => updateValue(path, e.target.value)}
        minLength={schema.minLength}
        maxLength={schema.maxLength}
        pattern={schema.pattern}
        className={`input font-mono text-sm ${errorClass}`}
        placeholder={schema.default !== undefined ? String(schema.default) : undefined}
      />
    );
  };

  const renderArrayItem = (
    path: string[],
    index: number,
    itemSchema?: SchemaProperty
  ): React.ReactNode => {
    const fullPath = [...path, String(index)];
    const value = getValue(fullPath);

    if (!itemSchema || itemSchema.type === 'string') {
      return (
        <input
          type="text"
          value={String(value ?? '')}
          onChange={(e) => updateValue(fullPath, e.target.value)}
          className="input font-mono text-sm flex-1"
        />
      );
    }

    // For complex items, render based on schema
    return renderInput(fullPath, itemSchema, value);
  };

  const getDefaultValue = (schema?: SchemaProperty): unknown => {
    if (!schema) return '';
    if (schema.default !== undefined) return schema.default;

    const type = Array.isArray(schema.type) ? schema.type[0] : schema.type;
    switch (type) {
      case 'string':
        return '';
      case 'number':
      case 'integer':
        return 0;
      case 'boolean':
        return false;
      case 'array':
        return [];
      case 'object':
        return {};
      default:
        return '';
    }
  };

  const parsedSchema = parseSchema(configSchema);

  // No schema available
  if (!parsedSchema || !parsedSchema.properties) {
    return (
      <div className="flex flex-col h-full">
        <div className="flex-1 overflow-y-auto pb-4 custom-scrollbar">
          <div className="max-w-3xl mx-auto space-y-6">
            <div className="card p-4 bg-bg-tertiary border-dashed">
              <div className="flex items-start gap-3">
                <Info className="w-5 h-5 text-gray-500 flex-shrink-0 mt-0.5" />
                <div>
                  <p className="text-sm text-gray-400">
                    This server does not have a configuration schema defined.
                    Configuration options may need to be set via environment variables or secrets.
                  </p>
                </div>
              </div>
            </div>

            {/* Show raw config editor */}
            <div>
              <h3 className="text-sm font-medium text-gray-400 mb-3">Raw Configuration</h3>
              <textarea
                value={JSON.stringify(config, null, 2)}
                onChange={(e) => {
                  try {
                    const parsed = JSON.parse(e.target.value);
                    setConfig(parsed);
                  } catch {
                    // Invalid JSON, don't update
                  }
                }}
                className="input font-mono text-sm h-64 resize-y w-full"
                placeholder="{}"
              />
            </div>
          </div>
        </div>

        {/* Actions - full width footer */}
        {hasChanges && (
          <div className="flex-shrink-0 pt-4 border-t border-border-default bg-bg-primary">
            <div className="flex flex-wrap items-center gap-3">
              <button onClick={handleSave} disabled={isSaving} className="btn btn-primary">
                <Save className="w-4 h-4 mr-2" />
                {isSaving ? 'Saving...' : 'Save'}
              </button>
              <button onClick={handleReset} className="btn btn-secondary">
                <RotateCcw className="w-4 h-4 mr-2" />
                Reset
              </button>
            </div>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      {/* Scrollable content area */}
      <div className="flex-1 overflow-y-auto pb-4 custom-scrollbar">
        <div className="max-w-3xl mx-auto space-y-6">
          {/* Status messages */}
          {error && (
            <div className="card p-4 bg-red-950/30 border-red-900">
              <div className="flex items-center gap-2 text-red-400">
                <AlertCircle className="w-5 h-5" />
                <span>{error}</span>
              </div>
            </div>
          )}

          {success && (
            <div className="card p-4 bg-emerald-950/30 border-emerald-900">
              <div className="flex items-center gap-2 text-emerald-400">
                <CheckCircle className="w-5 h-5" />
                <span>{success}</span>
              </div>
            </div>
          )}

          {/* Config fields */}
          <div className="space-y-4">
            {Object.entries(parsedSchema.properties || {}).map(([key, schema]) =>
              renderField(key, schema as SchemaProperty, [], parsedSchema.required?.includes(key))
            )}
          </div>

          {/* Help text */}
          <div className="card p-4 bg-bg-tertiary border-dashed">
            <div className="flex items-start gap-3">
              <Info className="w-5 h-5 text-gray-500 flex-shrink-0 mt-0.5" />
              <div>
                <p className="text-sm text-gray-400">
                  Configuration changes will be applied the next time the server is started or restarted.
                  Some servers may support hot-reloading configuration without restart.
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Sticky footer with actions - full width */}
      <div className="flex-shrink-0 pt-4 border-t border-border-default bg-bg-primary">
        <div className="flex flex-wrap items-center gap-3">
          <button
            onClick={handleSave}
            disabled={isSaving || !hasChanges}
            className="btn btn-primary"
          >
            <Save className="w-4 h-4 mr-2" />
            <span className="hidden sm:inline">{isSaving ? 'Saving...' : 'Save Configuration'}</span>
            <span className="sm:hidden">{isSaving ? '...' : 'Save'}</span>
          </button>
          <button
            onClick={handleReset}
            disabled={!hasChanges}
            className="btn btn-secondary"
          >
            <RotateCcw className="w-4 h-4 sm:mr-2" />
            <span className="hidden sm:inline">Reset Changes</span>
          </button>
          <button onClick={handleResetToDefault} className="btn btn-secondary ml-auto">
            <span className="hidden sm:inline">Reset to Defaults</span>
            <span className="sm:hidden">Defaults</span>
          </button>
        </div>
      </div>
    </div>
  );
}
