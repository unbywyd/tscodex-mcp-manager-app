/**
 * McpToolsStore - Manages dynamic tools, prompts, and resources
 */

import { app } from 'electron';
import fs from 'fs/promises';
import path from 'path';
import { v4 as uuid } from 'uuid';
import type {
  McpToolsConfig,
  DynamicTool,
  DynamicPrompt,
  DynamicResource,
  CreateToolRequest,
  UpdateToolRequest,
  CreatePromptRequest,
  UpdatePromptRequest,
  CreateResourceRequest,
  UpdateResourceRequest,
  McpToolsStatus,
  ValidationResult,
  EntityType,
  JsonSchema,
  RESERVED_PARAM_NAMES,
} from '../mcp-tools/types';

const RESERVED_NAMES = ['_context', '_request', '_internal', '_meta'];

export class McpToolsStore {
  private config: McpToolsConfig = {
    enabled: true,
    tools: [],
    prompts: [],
    resources: [],
  };
  private filePath: string;

  constructor() {
    const userDataPath = app?.getPath?.('userData') || process.cwd();
    this.filePath = path.join(userDataPath, 'config', 'mcp-tools.json');
  }

  // ============================================================================
  // Load / Save
  // ============================================================================

  async load(): Promise<void> {
    try {
      const dir = path.dirname(this.filePath);
      await fs.mkdir(dir, { recursive: true });

      const data = await fs.readFile(this.filePath, 'utf-8');
      const config: McpToolsConfig = JSON.parse(data);

      this.config = {
        enabled: config.enabled ?? true,
        tools: config.tools || [],
        prompts: config.prompts || [],
        resources: config.resources || [],
      };

      console.log(
        `[McpToolsStore] Loaded: ${this.config.tools.length} tools, ${this.config.prompts.length} prompts, ${this.config.resources.length} resources`
      );
    } catch (error: unknown) {
      if ((error as NodeJS.ErrnoException).code !== 'ENOENT') {
        console.error('[McpToolsStore] Failed to load:', error);
      }
      // Start with default config if file doesn't exist
    }
  }

  async save(): Promise<void> {
    try {
      const dir = path.dirname(this.filePath);
      await fs.mkdir(dir, { recursive: true });

      const tempPath = `${this.filePath}.tmp`;
      await fs.writeFile(tempPath, JSON.stringify(this.config, null, 2));
      await fs.rename(tempPath, this.filePath);
    } catch (error) {
      console.error('[McpToolsStore] Failed to save:', error);
      throw error;
    }
  }

  // ============================================================================
  // Status
  // ============================================================================

  getStatus(): McpToolsStatus {
    return {
      enabled: this.config.enabled,
      toolsCount: this.config.tools.length,
      promptsCount: this.config.prompts.length,
      resourcesCount: this.config.resources.length,
      enabledToolsCount: this.config.tools.filter((t) => t.enabled).length,
      enabledPromptsCount: this.config.prompts.filter((p) => p.enabled).length,
      enabledResourcesCount: this.config.resources.filter((r) => r.enabled).length,
    };
  }

  isEnabled(): boolean {
    return this.config.enabled;
  }

  async setEnabled(enabled: boolean): Promise<void> {
    this.config.enabled = enabled;
    await this.save();
  }

  // ============================================================================
  // Validation
  // ============================================================================

  validateName(
    name: string,
    entityType: EntityType,
    excludeId?: string
  ): ValidationResult {
    // Check empty
    if (!name || name.trim() === '') {
      return { valid: false, error: 'Name is required' };
    }

    // Check snake_case format
    const snakeCaseRegex = /^[a-z][a-z0-9_]*$/;
    if (!snakeCaseRegex.test(name)) {
      return {
        valid: false,
        error: 'Name must be snake_case (lowercase letters, numbers, underscores)',
      };
    }

    // Check uniqueness within entity type
    const entities =
      entityType === 'tool'
        ? this.config.tools
        : entityType === 'prompt'
          ? this.config.prompts
          : this.config.resources;

    const duplicate = entities.find((e) => e.name === name && e.id !== excludeId);
    if (duplicate) {
      return {
        valid: false,
        error: `${entityType} with name "${name}" already exists`,
      };
    }

    return { valid: true };
  }

  validateInputSchema(schema: JsonSchema): ValidationResult {
    const warnings: string[] = [];

    // Check it's an object type
    if (schema.type !== 'object') {
      return { valid: false, error: 'Input schema must have type "object"' };
    }

    // Check for reserved property names
    const properties = schema.properties || {};
    for (const propName of Object.keys(properties)) {
      if (RESERVED_NAMES.includes(propName)) {
        return {
          valid: false,
          error: `Property "${propName}" is reserved and cannot be used as parameter name`,
        };
      }
    }

    // Warning if no required fields
    if (!schema.required || schema.required.length === 0) {
      warnings.push('Schema has no required fields');
    }

    return { valid: true, warnings: warnings.length > 0 ? warnings : undefined };
  }

  // ============================================================================
  // Tools CRUD
  // ============================================================================

  getTools(): DynamicTool[] {
    return this.config.tools;
  }

  getEnabledTools(): DynamicTool[] {
    return this.config.tools.filter((t) => t.enabled);
  }

  getTool(id: string): DynamicTool | undefined {
    return this.config.tools.find((t) => t.id === id);
  }

  getToolByName(name: string): DynamicTool | undefined {
    return this.config.tools.find((t) => t.name === name);
  }

  async createTool(data: CreateToolRequest): Promise<DynamicTool> {
    // Validate name
    const nameValidation = this.validateName(data.name, 'tool');
    if (!nameValidation.valid) {
      throw new Error(nameValidation.error);
    }

    // Validate schema
    const schemaValidation = this.validateInputSchema(data.inputSchema);
    if (!schemaValidation.valid) {
      throw new Error(schemaValidation.error);
    }

    const now = Date.now();
    const tool: DynamicTool = {
      id: uuid(),
      type: 'tool',
      name: data.name,
      description: data.description,
      inputSchema: data.inputSchema,
      executor: data.executor,
      enabled: data.enabled ?? true,
      createdAt: now,
      updatedAt: now,
    };

    this.config.tools.push(tool);
    await this.save();

    return tool;
  }

  async updateTool(id: string, data: UpdateToolRequest): Promise<DynamicTool | undefined> {
    const index = this.config.tools.findIndex((t) => t.id === id);
    if (index === -1) {
      return undefined;
    }

    const existing = this.config.tools[index];

    // Validate name if changing
    if (data.name && data.name !== existing.name) {
      const nameValidation = this.validateName(data.name, 'tool', id);
      if (!nameValidation.valid) {
        throw new Error(nameValidation.error);
      }
    }

    // Validate schema if changing
    if (data.inputSchema) {
      const schemaValidation = this.validateInputSchema(data.inputSchema);
      if (!schemaValidation.valid) {
        throw new Error(schemaValidation.error);
      }
    }

    const updated: DynamicTool = {
      ...existing,
      ...data,
      id, // Prevent ID change
      type: 'tool', // Prevent type change
      updatedAt: Date.now(),
    };

    this.config.tools[index] = updated;
    await this.save();

    return updated;
  }

  async deleteTool(id: string): Promise<boolean> {
    const index = this.config.tools.findIndex((t) => t.id === id);
    if (index === -1) {
      return false;
    }

    this.config.tools.splice(index, 1);
    await this.save();

    return true;
  }

  async toggleTool(id: string): Promise<DynamicTool | undefined> {
    const tool = this.getTool(id);
    if (!tool) {
      return undefined;
    }

    return this.updateTool(id, { enabled: !tool.enabled });
  }

  // ============================================================================
  // Prompts CRUD
  // ============================================================================

  getPrompts(): DynamicPrompt[] {
    return this.config.prompts;
  }

  getEnabledPrompts(): DynamicPrompt[] {
    return this.config.prompts.filter((p) => p.enabled);
  }

  getPrompt(id: string): DynamicPrompt | undefined {
    return this.config.prompts.find((p) => p.id === id);
  }

  getPromptByName(name: string): DynamicPrompt | undefined {
    return this.config.prompts.find((p) => p.name === name);
  }

  async createPrompt(data: CreatePromptRequest): Promise<DynamicPrompt> {
    // Validate name
    const nameValidation = this.validateName(data.name, 'prompt');
    if (!nameValidation.valid) {
      throw new Error(nameValidation.error);
    }

    const now = Date.now();
    const prompt: DynamicPrompt = {
      id: uuid(),
      type: 'prompt',
      name: data.name,
      description: data.description,
      arguments: data.arguments,
      template: data.template,
      enabled: data.enabled ?? true,
      createdAt: now,
      updatedAt: now,
    };

    this.config.prompts.push(prompt);
    await this.save();

    return prompt;
  }

  async updatePrompt(id: string, data: UpdatePromptRequest): Promise<DynamicPrompt | undefined> {
    const index = this.config.prompts.findIndex((p) => p.id === id);
    if (index === -1) {
      return undefined;
    }

    const existing = this.config.prompts[index];

    // Validate name if changing
    if (data.name && data.name !== existing.name) {
      const nameValidation = this.validateName(data.name, 'prompt', id);
      if (!nameValidation.valid) {
        throw new Error(nameValidation.error);
      }
    }

    const updated: DynamicPrompt = {
      ...existing,
      ...data,
      id,
      type: 'prompt',
      updatedAt: Date.now(),
    };

    this.config.prompts[index] = updated;
    await this.save();

    return updated;
  }

  async deletePrompt(id: string): Promise<boolean> {
    const index = this.config.prompts.findIndex((p) => p.id === id);
    if (index === -1) {
      return false;
    }

    this.config.prompts.splice(index, 1);
    await this.save();

    return true;
  }

  async togglePrompt(id: string): Promise<DynamicPrompt | undefined> {
    const prompt = this.getPrompt(id);
    if (!prompt) {
      return undefined;
    }

    return this.updatePrompt(id, { enabled: !prompt.enabled });
  }

  // ============================================================================
  // Resources CRUD
  // ============================================================================

  getResources(): DynamicResource[] {
    return this.config.resources;
  }

  getEnabledResources(): DynamicResource[] {
    return this.config.resources.filter((r) => r.enabled);
  }

  getResource(id: string): DynamicResource | undefined {
    return this.config.resources.find((r) => r.id === id);
  }

  getResourceByName(name: string): DynamicResource | undefined {
    return this.config.resources.find((r) => r.name === name);
  }

  getResourceByUri(uri: string): DynamicResource | undefined {
    return this.config.resources.find((r) => r.uri === uri);
  }

  async createResource(data: CreateResourceRequest): Promise<DynamicResource> {
    // Validate name
    const nameValidation = this.validateName(data.name, 'resource');
    if (!nameValidation.valid) {
      throw new Error(nameValidation.error);
    }

    // Auto-generate URI from name (like SDK does)
    const uri = `mcp-tools://${data.name}`;

    const now = Date.now();
    const resource: DynamicResource = {
      id: uuid(),
      type: 'resource',
      name: data.name,
      description: data.description,
      uri,
      mimeType: data.mimeType || 'text/plain',
      executor: data.executor,
      enabled: data.enabled ?? true,
      createdAt: now,
      updatedAt: now,
    };

    this.config.resources.push(resource);
    await this.save();

    return resource;
  }

  async updateResource(
    id: string,
    data: UpdateResourceRequest
  ): Promise<DynamicResource | undefined> {
    const index = this.config.resources.findIndex((r) => r.id === id);
    if (index === -1) {
      return undefined;
    }

    const existing = this.config.resources[index];

    // Validate name if changing
    if (data.name && data.name !== existing.name) {
      const nameValidation = this.validateName(data.name, 'resource', id);
      if (!nameValidation.valid) {
        throw new Error(nameValidation.error);
      }
    }

    // Auto-update URI if name changes
    const newName = data.name || existing.name;
    const uri = `mcp-tools://${newName}`;

    const updated: DynamicResource = {
      ...existing,
      ...data,
      uri, // Always regenerate URI from name
      id,
      type: 'resource',
      updatedAt: Date.now(),
    };

    this.config.resources[index] = updated;
    await this.save();

    return updated;
  }

  async deleteResource(id: string): Promise<boolean> {
    const index = this.config.resources.findIndex((r) => r.id === id);
    if (index === -1) {
      return false;
    }

    this.config.resources.splice(index, 1);
    await this.save();

    return true;
  }

  async toggleResource(id: string): Promise<DynamicResource | undefined> {
    const resource = this.getResource(id);
    if (!resource) {
      return undefined;
    }

    return this.updateResource(id, { enabled: !resource.enabled });
  }
}
