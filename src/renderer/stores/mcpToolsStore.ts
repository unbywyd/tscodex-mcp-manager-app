/**
 * MCP Tools Store - State management for dynamic tools, prompts, and resources
 */

import { create } from 'zustand';
import type {
  DynamicTool,
  DynamicPrompt,
  DynamicResource,
  McpToolsStatus,
  CreateToolRequest,
  UpdateToolRequest,
  CreatePromptRequest,
  UpdatePromptRequest,
  CreateResourceRequest,
  UpdateResourceRequest,
  ValidationResult,
  EntityType,
  JsonSchema,
  ExportData,
  ImportOptions,
  ImportResult,
} from '../../host/mcp-tools/types';
import { getApiBase } from '../lib/api';

// Dynamic API base that uses the current host port
const getApiBaseMcpTools = () => `${getApiBase()}/mcp-tools`;

interface McpToolsState {
  // Data
  status: McpToolsStatus | null;
  tools: DynamicTool[];
  prompts: DynamicPrompt[];
  resources: DynamicResource[];

  // UI state
  isLoading: boolean;
  error: string | null;
  selectedTab: 'tools' | 'prompts' | 'resources';
  editingEntity: DynamicTool | DynamicPrompt | DynamicResource | null;
  isEditorOpen: boolean;

  // Selection state for export
  selectedToolIds: Set<string>;
  selectedPromptIds: Set<string>;
  selectedResourceIds: Set<string>;

  // Actions
  fetchStatus: () => Promise<void>;
  fetchTools: () => Promise<void>;
  fetchPrompts: () => Promise<void>;
  fetchResources: () => Promise<void>;
  fetchAll: () => Promise<void>;

  // Global toggle
  enable: () => Promise<void>;
  disable: () => Promise<void>;

  // Tools CRUD
  createTool: (data: CreateToolRequest) => Promise<DynamicTool>;
  updateTool: (id: string, data: UpdateToolRequest) => Promise<DynamicTool>;
  deleteTool: (id: string) => Promise<void>;
  toggleTool: (id: string) => Promise<void>;

  // Prompts CRUD
  createPrompt: (data: CreatePromptRequest) => Promise<DynamicPrompt>;
  updatePrompt: (id: string, data: UpdatePromptRequest) => Promise<DynamicPrompt>;
  deletePrompt: (id: string) => Promise<void>;
  togglePrompt: (id: string) => Promise<void>;

  // Resources CRUD
  createResource: (data: CreateResourceRequest) => Promise<DynamicResource>;
  updateResource: (id: string, data: UpdateResourceRequest) => Promise<DynamicResource>;
  deleteResource: (id: string) => Promise<void>;
  toggleResource: (id: string) => Promise<void>;

  // Validation
  validateName: (name: string, entityType: EntityType, excludeId?: string) => Promise<ValidationResult>;
  validateSchema: (schema: JsonSchema) => Promise<ValidationResult>;
  validateFunction: (code: string) => Promise<ValidationResult>;

  // UI actions
  setSelectedTab: (tab: 'tools' | 'prompts' | 'resources') => void;
  openEditor: (entity?: DynamicTool | DynamicPrompt | DynamicResource) => void;
  closeEditor: () => void;

  // Selection actions for export
  toggleToolSelection: (id: string) => void;
  togglePromptSelection: (id: string) => void;
  toggleResourceSelection: (id: string) => void;
  selectAllTools: () => void;
  selectAllPrompts: () => void;
  selectAllResources: () => void;
  clearToolSelection: () => void;
  clearPromptSelection: () => void;
  clearResourceSelection: () => void;

  // Export/Import
  exportData: (types?: ('tools' | 'prompts' | 'resources')[]) => Promise<ExportData>;
  exportSelectedTools: () => Promise<ExportData>;
  exportSelectedPrompts: () => Promise<ExportData>;
  exportSelectedResources: () => Promise<ExportData>;
  importData: (data: ExportData, options: ImportOptions) => Promise<ImportResult>;
}

export const useMcpToolsStore = create<McpToolsState>((set, get) => ({
  // Initial state
  status: null,
  tools: [],
  prompts: [],
  resources: [],
  isLoading: false,
  error: null,
  selectedTab: 'tools',
  editingEntity: null,
  isEditorOpen: false,
  selectedToolIds: new Set<string>(),
  selectedPromptIds: new Set<string>(),
  selectedResourceIds: new Set<string>(),

  // Fetch status
  fetchStatus: async () => {
    try {
      const response = await fetch(`${getApiBaseMcpTools()}/status`);
      const data = await response.json();
      if (data.success) {
        set({ status: data.data });
      }
    } catch (error) {
      console.error('Failed to fetch MCP Tools status:', error);
    }
  },

  // Fetch tools
  fetchTools: async () => {
    try {
      const response = await fetch(`${getApiBaseMcpTools()}/tools`);
      const data = await response.json();
      if (data.success) {
        set({ tools: data.data });
      }
    } catch (error) {
      console.error('Failed to fetch tools:', error);
    }
  },

  // Fetch prompts
  fetchPrompts: async () => {
    try {
      const response = await fetch(`${getApiBaseMcpTools()}/prompts`);
      const data = await response.json();
      if (data.success) {
        set({ prompts: data.data });
      }
    } catch (error) {
      console.error('Failed to fetch prompts:', error);
    }
  },

  // Fetch resources
  fetchResources: async () => {
    try {
      const response = await fetch(`${getApiBaseMcpTools()}/resources`);
      const data = await response.json();
      if (data.success) {
        set({ resources: data.data });
      }
    } catch (error) {
      console.error('Failed to fetch resources:', error);
    }
  },

  // Fetch all
  fetchAll: async () => {
    set({ isLoading: true, error: null });
    try {
      await Promise.all([
        get().fetchStatus(),
        get().fetchTools(),
        get().fetchPrompts(),
        get().fetchResources(),
      ]);
    } catch (error) {
      set({ error: (error as Error).message });
    } finally {
      set({ isLoading: false });
    }
  },

  // Enable MCP Tools
  enable: async () => {
    try {
      const response = await fetch(`${getApiBaseMcpTools()}/enable`, { method: 'POST' });
      const data = await response.json();
      if (data.success) {
        await get().fetchStatus();
      } else {
        throw new Error(data.error);
      }
    } catch (error) {
      console.error('Failed to enable MCP Tools:', error);
      throw error;
    }
  },

  // Disable MCP Tools
  disable: async () => {
    try {
      const response = await fetch(`${getApiBaseMcpTools()}/disable`, { method: 'POST' });
      const data = await response.json();
      if (data.success) {
        await get().fetchStatus();
      } else {
        throw new Error(data.error);
      }
    } catch (error) {
      console.error('Failed to disable MCP Tools:', error);
      throw error;
    }
  },

  // Create tool
  createTool: async (data: CreateToolRequest) => {
    const response = await fetch(`${getApiBaseMcpTools()}/tools`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    const result = await response.json();
    if (!result.success) {
      throw new Error(result.error);
    }
    await get().fetchTools();
    await get().fetchStatus();
    return result.data;
  },

  // Update tool
  updateTool: async (id: string, data: UpdateToolRequest) => {
    const response = await fetch(`${getApiBaseMcpTools()}/tools/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    const result = await response.json();
    if (!result.success) {
      throw new Error(result.error);
    }
    await get().fetchTools();
    await get().fetchStatus();
    return result.data;
  },

  // Delete tool
  deleteTool: async (id: string) => {
    const response = await fetch(`${getApiBaseMcpTools()}/tools/${id}`, {
      method: 'DELETE',
    });
    const result = await response.json();
    if (!result.success) {
      throw new Error(result.error);
    }
    await get().fetchTools();
    await get().fetchStatus();
  },

  // Toggle tool
  toggleTool: async (id: string) => {
    const response = await fetch(`${getApiBaseMcpTools()}/tools/${id}/toggle`, {
      method: 'POST',
    });
    const result = await response.json();
    if (!result.success) {
      throw new Error(result.error);
    }
    await get().fetchTools();
    await get().fetchStatus();
  },

  // Create prompt
  createPrompt: async (data: CreatePromptRequest) => {
    const response = await fetch(`${getApiBaseMcpTools()}/prompts`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    const result = await response.json();
    if (!result.success) {
      throw new Error(result.error);
    }
    await get().fetchPrompts();
    await get().fetchStatus();
    return result.data;
  },

  // Update prompt
  updatePrompt: async (id: string, data: UpdatePromptRequest) => {
    const response = await fetch(`${getApiBaseMcpTools()}/prompts/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    const result = await response.json();
    if (!result.success) {
      throw new Error(result.error);
    }
    await get().fetchPrompts();
    await get().fetchStatus();
    return result.data;
  },

  // Delete prompt
  deletePrompt: async (id: string) => {
    const response = await fetch(`${getApiBaseMcpTools()}/prompts/${id}`, {
      method: 'DELETE',
    });
    const result = await response.json();
    if (!result.success) {
      throw new Error(result.error);
    }
    await get().fetchPrompts();
    await get().fetchStatus();
  },

  // Toggle prompt
  togglePrompt: async (id: string) => {
    const response = await fetch(`${getApiBaseMcpTools()}/prompts/${id}/toggle`, {
      method: 'POST',
    });
    const result = await response.json();
    if (!result.success) {
      throw new Error(result.error);
    }
    await get().fetchPrompts();
    await get().fetchStatus();
  },

  // Create resource
  createResource: async (data: CreateResourceRequest) => {
    const response = await fetch(`${getApiBaseMcpTools()}/resources`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    const result = await response.json();
    if (!result.success) {
      throw new Error(result.error);
    }
    await get().fetchResources();
    await get().fetchStatus();
    return result.data;
  },

  // Update resource
  updateResource: async (id: string, data: UpdateResourceRequest) => {
    const response = await fetch(`${getApiBaseMcpTools()}/resources/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    const result = await response.json();
    if (!result.success) {
      throw new Error(result.error);
    }
    await get().fetchResources();
    await get().fetchStatus();
    return result.data;
  },

  // Delete resource
  deleteResource: async (id: string) => {
    const response = await fetch(`${getApiBaseMcpTools()}/resources/${id}`, {
      method: 'DELETE',
    });
    const result = await response.json();
    if (!result.success) {
      throw new Error(result.error);
    }
    await get().fetchResources();
    await get().fetchStatus();
  },

  // Toggle resource
  toggleResource: async (id: string) => {
    const response = await fetch(`${getApiBaseMcpTools()}/resources/${id}/toggle`, {
      method: 'POST',
    });
    const result = await response.json();
    if (!result.success) {
      throw new Error(result.error);
    }
    await get().fetchResources();
    await get().fetchStatus();
  },

  // Validate name
  validateName: async (name: string, entityType: EntityType, excludeId?: string) => {
    const response = await fetch(`${getApiBaseMcpTools()}/validate/name`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, entityType, excludeId }),
    });
    const result = await response.json();
    if (!result.success) {
      throw new Error(result.error);
    }
    return result.data;
  },

  // Validate schema
  validateSchema: async (schema: JsonSchema) => {
    const response = await fetch(`${getApiBaseMcpTools()}/validate/schema`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ schema }),
    });
    const result = await response.json();
    if (!result.success) {
      throw new Error(result.error);
    }
    return result.data;
  },

  // Validate function
  validateFunction: async (code: string) => {
    const response = await fetch(`${getApiBaseMcpTools()}/validate/function`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ code }),
    });
    const result = await response.json();
    if (!result.success) {
      throw new Error(result.error);
    }
    return result.data;
  },

  // UI actions
  setSelectedTab: (tab) => set({ selectedTab: tab }),

  openEditor: (entity) => set({
    editingEntity: entity || null,
    isEditorOpen: true,
  }),

  closeEditor: () => set({
    editingEntity: null,
    isEditorOpen: false,
  }),

  // Selection actions for export
  toggleToolSelection: (id: string) => {
    const current = get().selectedToolIds;
    const next = new Set(current);
    if (next.has(id)) {
      next.delete(id);
    } else {
      next.add(id);
    }
    set({ selectedToolIds: next });
  },

  togglePromptSelection: (id: string) => {
    const current = get().selectedPromptIds;
    const next = new Set(current);
    if (next.has(id)) {
      next.delete(id);
    } else {
      next.add(id);
    }
    set({ selectedPromptIds: next });
  },

  toggleResourceSelection: (id: string) => {
    const current = get().selectedResourceIds;
    const next = new Set(current);
    if (next.has(id)) {
      next.delete(id);
    } else {
      next.add(id);
    }
    set({ selectedResourceIds: next });
  },

  selectAllTools: () => {
    const allIds = new Set(get().tools.map(t => t.id));
    set({ selectedToolIds: allIds });
  },

  selectAllPrompts: () => {
    const allIds = new Set(get().prompts.map(p => p.id));
    set({ selectedPromptIds: allIds });
  },

  selectAllResources: () => {
    const allIds = new Set(get().resources.map(r => r.id));
    set({ selectedResourceIds: allIds });
  },

  clearToolSelection: () => set({ selectedToolIds: new Set() }),
  clearPromptSelection: () => set({ selectedPromptIds: new Set() }),
  clearResourceSelection: () => set({ selectedResourceIds: new Set() }),

  // Export data
  exportData: async (types?: ('tools' | 'prompts' | 'resources')[]) => {
    const typesParam = types ? types.join(',') : undefined;
    const url = typesParam ? `${getApiBaseMcpTools()}/export?types=${typesParam}` : `${getApiBaseMcpTools()}/export`;
    const response = await fetch(url);
    if (!response.ok) {
      const result = await response.json();
      throw new Error(result.error || 'Export failed');
    }
    return response.json();
  },

  // Export selected items (client-side filtering)
  exportSelectedTools: async () => {
    const { tools, selectedToolIds } = get();
    const selectedTools = tools.filter(t => selectedToolIds.has(t.id));
    return {
      version: 1 as const,
      exportedAt: Date.now(),
      tools: selectedTools,
    };
  },

  exportSelectedPrompts: async () => {
    const { prompts, selectedPromptIds } = get();
    const selectedPrompts = prompts.filter(p => selectedPromptIds.has(p.id));
    return {
      version: 1 as const,
      exportedAt: Date.now(),
      prompts: selectedPrompts,
    };
  },

  exportSelectedResources: async () => {
    const { resources, selectedResourceIds } = get();
    const selectedResources = resources.filter(r => selectedResourceIds.has(r.id));
    return {
      version: 1 as const,
      exportedAt: Date.now(),
      resources: selectedResources,
    };
  },

  // Import data
  importData: async (data: ExportData, options: ImportOptions) => {
    const response = await fetch(`${getApiBaseMcpTools()}/import`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ data, options }),
    });
    const result = await response.json();
    if (!result.success) {
      throw new Error(result.error);
    }
    // Refresh all data after import
    await get().fetchAll();
    return result.data;
  },
}));
