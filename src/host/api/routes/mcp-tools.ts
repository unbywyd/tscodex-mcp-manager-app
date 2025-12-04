/**
 * MCP Tools API Routes - CRUD for dynamic tools, prompts, and resources
 */

import { Router, Request, Response } from '../../http/router';
import { McpToolsStore } from '../../stores/McpToolsStore';
import { EventBus } from '../../managers/EventBus';
import { validateFunctionSyntax } from '../../mcp-tools/executors/function';
import Ajv from 'ajv';
import type {
  CreateToolRequest,
  UpdateToolRequest,
  CreatePromptRequest,
  UpdatePromptRequest,
  CreateResourceRequest,
  UpdateResourceRequest,
  McpToolsEvent,
  ExportData,
  ImportOptions,
  ImportResult,
  JsonSchema,
} from '../../mcp-tools/types';

const ajv = new Ajv({ allErrors: true });

export interface McpToolsRouteContext {
  mcpToolsStore: McpToolsStore;
  eventBus: EventBus;
}

export function createMcpToolsRoutes(router: Router, ctx: McpToolsRouteContext): void {
  const { mcpToolsStore, eventBus } = ctx;

  // Helper to emit events
  const emitEvent = (type: McpToolsEvent['type'], data?: McpToolsEvent['data']) => {
    eventBus.emitAppEvent({
      type,
      data,
    });
  };

  // ============================================================================
  // Status & Global Toggle
  // ============================================================================

  // GET /api/mcp-tools/status
  router.get('/api/mcp-tools/status', (_req: Request, res: Response) => {
    const status = mcpToolsStore.getStatus();
    res.json({ success: true, data: status });
  });

  // POST /api/mcp-tools/enable
  router.post('/api/mcp-tools/enable', async (_req: Request, res: Response) => {
    try {
      await mcpToolsStore.setEnabled(true);
      emitEvent('mcp-tools-enabled');
      res.json({ success: true });
    } catch (error) {
      res.status(500).json({ success: false, error: (error as Error).message });
    }
  });

  // POST /api/mcp-tools/disable
  router.post('/api/mcp-tools/disable', async (_req: Request, res: Response) => {
    try {
      await mcpToolsStore.setEnabled(false);
      emitEvent('mcp-tools-disabled');
      res.json({ success: true });
    } catch (error) {
      res.status(500).json({ success: false, error: (error as Error).message });
    }
  });

  // ============================================================================
  // Validation Endpoints
  // ============================================================================

  // POST /api/mcp-tools/validate/schema
  router.post('/api/mcp-tools/validate/schema', async (req: Request, res: Response) => {
    try {
      const { schema } = req.body as { schema: unknown };

      if (!schema || typeof schema !== 'object') {
        res.json({ success: true, data: { valid: false, error: 'Schema must be an object' } });
        return;
      }

      // Try to compile with Ajv
      try {
        ajv.compile(schema as object);
      } catch (error) {
        res.json({
          success: true,
          data: { valid: false, error: `Invalid JSON Schema: ${(error as Error).message}` },
        });
        return;
      }

      // Additional validation
      const result = mcpToolsStore.validateInputSchema(schema as JsonSchema);
      res.json({ success: true, data: result });
    } catch (error) {
      res.status(500).json({ success: false, error: (error as Error).message });
    }
  });

  // POST /api/mcp-tools/validate/function
  router.post('/api/mcp-tools/validate/function', async (req: Request, res: Response) => {
    try {
      const { code } = req.body as { code: string };

      if (!code || typeof code !== 'string') {
        res.json({ success: true, data: { valid: false, error: 'Code must be a string' } });
        return;
      }

      const result = validateFunctionSyntax(code);
      res.json({ success: true, data: result });
    } catch (error) {
      res.status(500).json({ success: false, error: (error as Error).message });
    }
  });

  // POST /api/mcp-tools/validate/name
  router.post('/api/mcp-tools/validate/name', async (req: Request, res: Response) => {
    try {
      const { name, entityType, excludeId } = req.body as {
        name: string;
        entityType: 'tool' | 'prompt' | 'resource';
        excludeId?: string;
      };

      const result = mcpToolsStore.validateName(name, entityType, excludeId);
      res.json({ success: true, data: result });
    } catch (error) {
      res.status(500).json({ success: false, error: (error as Error).message });
    }
  });

  // ============================================================================
  // Tools CRUD
  // ============================================================================

  // GET /api/mcp-tools/tools
  router.get('/api/mcp-tools/tools', (_req: Request, res: Response) => {
    const tools = mcpToolsStore.getTools();
    res.json({ success: true, data: tools });
  });

  // GET /api/mcp-tools/tools/:id
  router.get('/api/mcp-tools/tools/:id', (req: Request, res: Response) => {
    const tool = mcpToolsStore.getTool(req.params.id);
    if (!tool) {
      res.status(404).json({ success: false, error: 'Tool not found' });
      return;
    }
    res.json({ success: true, data: tool });
  });

  // POST /api/mcp-tools/tools
  router.post('/api/mcp-tools/tools', async (req: Request, res: Response) => {
    try {
      const data = req.body as CreateToolRequest;
      const tool = await mcpToolsStore.createTool(data);
      emitEvent('mcp-tools-tool-created', {
        entityId: tool.id,
        entityName: tool.name,
        entityType: 'tool',
      });
      res.status(201).json({ success: true, data: tool });
    } catch (error) {
      res.status(400).json({ success: false, error: (error as Error).message });
    }
  });

  // PUT /api/mcp-tools/tools/:id
  router.put('/api/mcp-tools/tools/:id', async (req: Request, res: Response) => {
    try {
      const data = req.body as UpdateToolRequest;
      const tool = await mcpToolsStore.updateTool(req.params.id, data);
      if (!tool) {
        res.status(404).json({ success: false, error: 'Tool not found' });
        return;
      }
      emitEvent('mcp-tools-tool-updated', {
        entityId: tool.id,
        entityName: tool.name,
        entityType: 'tool',
      });
      res.json({ success: true, data: tool });
    } catch (error) {
      res.status(400).json({ success: false, error: (error as Error).message });
    }
  });

  // DELETE /api/mcp-tools/tools/:id
  router.delete('/api/mcp-tools/tools/:id', async (req: Request, res: Response) => {
    try {
      const tool = mcpToolsStore.getTool(req.params.id);
      const deleted = await mcpToolsStore.deleteTool(req.params.id);
      if (!deleted) {
        res.status(404).json({ success: false, error: 'Tool not found' });
        return;
      }
      emitEvent('mcp-tools-tool-deleted', {
        entityId: req.params.id,
        entityName: tool?.name,
        entityType: 'tool',
      });
      res.json({ success: true });
    } catch (error) {
      res.status(500).json({ success: false, error: (error as Error).message });
    }
  });

  // POST /api/mcp-tools/tools/:id/toggle
  router.post('/api/mcp-tools/tools/:id/toggle', async (req: Request, res: Response) => {
    try {
      const tool = await mcpToolsStore.toggleTool(req.params.id);
      if (!tool) {
        res.status(404).json({ success: false, error: 'Tool not found' });
        return;
      }
      emitEvent('mcp-tools-tool-updated', {
        entityId: tool.id,
        entityName: tool.name,
        entityType: 'tool',
      });
      res.json({ success: true, data: tool });
    } catch (error) {
      res.status(500).json({ success: false, error: (error as Error).message });
    }
  });

  // ============================================================================
  // Prompts CRUD
  // ============================================================================

  // GET /api/mcp-tools/prompts
  router.get('/api/mcp-tools/prompts', (_req: Request, res: Response) => {
    const prompts = mcpToolsStore.getPrompts();
    res.json({ success: true, data: prompts });
  });

  // GET /api/mcp-tools/prompts/:id
  router.get('/api/mcp-tools/prompts/:id', (req: Request, res: Response) => {
    const prompt = mcpToolsStore.getPrompt(req.params.id);
    if (!prompt) {
      res.status(404).json({ success: false, error: 'Prompt not found' });
      return;
    }
    res.json({ success: true, data: prompt });
  });

  // POST /api/mcp-tools/prompts
  router.post('/api/mcp-tools/prompts', async (req: Request, res: Response) => {
    try {
      const data = req.body as CreatePromptRequest;
      const prompt = await mcpToolsStore.createPrompt(data);
      emitEvent('mcp-tools-prompt-created', {
        entityId: prompt.id,
        entityName: prompt.name,
        entityType: 'prompt',
      });
      res.status(201).json({ success: true, data: prompt });
    } catch (error) {
      res.status(400).json({ success: false, error: (error as Error).message });
    }
  });

  // PUT /api/mcp-tools/prompts/:id
  router.put('/api/mcp-tools/prompts/:id', async (req: Request, res: Response) => {
    try {
      const data = req.body as UpdatePromptRequest;
      const prompt = await mcpToolsStore.updatePrompt(req.params.id, data);
      if (!prompt) {
        res.status(404).json({ success: false, error: 'Prompt not found' });
        return;
      }
      emitEvent('mcp-tools-prompt-updated', {
        entityId: prompt.id,
        entityName: prompt.name,
        entityType: 'prompt',
      });
      res.json({ success: true, data: prompt });
    } catch (error) {
      res.status(400).json({ success: false, error: (error as Error).message });
    }
  });

  // DELETE /api/mcp-tools/prompts/:id
  router.delete('/api/mcp-tools/prompts/:id', async (req: Request, res: Response) => {
    try {
      const prompt = mcpToolsStore.getPrompt(req.params.id);
      const deleted = await mcpToolsStore.deletePrompt(req.params.id);
      if (!deleted) {
        res.status(404).json({ success: false, error: 'Prompt not found' });
        return;
      }
      emitEvent('mcp-tools-prompt-deleted', {
        entityId: req.params.id,
        entityName: prompt?.name,
        entityType: 'prompt',
      });
      res.json({ success: true });
    } catch (error) {
      res.status(500).json({ success: false, error: (error as Error).message });
    }
  });

  // POST /api/mcp-tools/prompts/:id/toggle
  router.post('/api/mcp-tools/prompts/:id/toggle', async (req: Request, res: Response) => {
    try {
      const prompt = await mcpToolsStore.togglePrompt(req.params.id);
      if (!prompt) {
        res.status(404).json({ success: false, error: 'Prompt not found' });
        return;
      }
      emitEvent('mcp-tools-prompt-updated', {
        entityId: prompt.id,
        entityName: prompt.name,
        entityType: 'prompt',
      });
      res.json({ success: true, data: prompt });
    } catch (error) {
      res.status(500).json({ success: false, error: (error as Error).message });
    }
  });

  // ============================================================================
  // Resources CRUD
  // ============================================================================

  // GET /api/mcp-tools/resources
  router.get('/api/mcp-tools/resources', (_req: Request, res: Response) => {
    const resources = mcpToolsStore.getResources();
    res.json({ success: true, data: resources });
  });

  // GET /api/mcp-tools/resources/:id
  router.get('/api/mcp-tools/resources/:id', (req: Request, res: Response) => {
    const resource = mcpToolsStore.getResource(req.params.id);
    if (!resource) {
      res.status(404).json({ success: false, error: 'Resource not found' });
      return;
    }
    res.json({ success: true, data: resource });
  });

  // POST /api/mcp-tools/resources
  router.post('/api/mcp-tools/resources', async (req: Request, res: Response) => {
    try {
      const data = req.body as CreateResourceRequest;
      const resource = await mcpToolsStore.createResource(data);
      emitEvent('mcp-tools-resource-created', {
        entityId: resource.id,
        entityName: resource.name,
        entityType: 'resource',
      });
      res.status(201).json({ success: true, data: resource });
    } catch (error) {
      res.status(400).json({ success: false, error: (error as Error).message });
    }
  });

  // PUT /api/mcp-tools/resources/:id
  router.put('/api/mcp-tools/resources/:id', async (req: Request, res: Response) => {
    try {
      const data = req.body as UpdateResourceRequest;
      const resource = await mcpToolsStore.updateResource(req.params.id, data);
      if (!resource) {
        res.status(404).json({ success: false, error: 'Resource not found' });
        return;
      }
      emitEvent('mcp-tools-resource-updated', {
        entityId: resource.id,
        entityName: resource.name,
        entityType: 'resource',
      });
      res.json({ success: true, data: resource });
    } catch (error) {
      res.status(400).json({ success: false, error: (error as Error).message });
    }
  });

  // DELETE /api/mcp-tools/resources/:id
  router.delete('/api/mcp-tools/resources/:id', async (req: Request, res: Response) => {
    try {
      const resource = mcpToolsStore.getResource(req.params.id);
      const deleted = await mcpToolsStore.deleteResource(req.params.id);
      if (!deleted) {
        res.status(404).json({ success: false, error: 'Resource not found' });
        return;
      }
      emitEvent('mcp-tools-resource-deleted', {
        entityId: req.params.id,
        entityName: resource?.name,
        entityType: 'resource',
      });
      res.json({ success: true });
    } catch (error) {
      res.status(500).json({ success: false, error: (error as Error).message });
    }
  });

  // POST /api/mcp-tools/resources/:id/toggle
  router.post('/api/mcp-tools/resources/:id/toggle', async (req: Request, res: Response) => {
    try {
      const resource = await mcpToolsStore.toggleResource(req.params.id);
      if (!resource) {
        res.status(404).json({ success: false, error: 'Resource not found' });
        return;
      }
      emitEvent('mcp-tools-resource-updated', {
        entityId: resource.id,
        entityName: resource.name,
        entityType: 'resource',
      });
      res.json({ success: true, data: resource });
    } catch (error) {
      res.status(500).json({ success: false, error: (error as Error).message });
    }
  });

  // ============================================================================
  // Export/Import
  // ============================================================================

  // GET /api/mcp-tools/export
  // Query params: types=tools,prompts,resources (comma-separated, default all)
  router.get('/api/mcp-tools/export', (_req: Request, res: Response) => {
    try {
      const typesParam = _req.query.types as string | undefined;
      const types = typesParam ? typesParam.split(',') : ['tools', 'prompts', 'resources'];

      const exportData: ExportData = {
        version: 1,
        exportedAt: Date.now(),
      };

      if (types.includes('tools')) {
        exportData.tools = mcpToolsStore.getTools();
      }
      if (types.includes('prompts')) {
        exportData.prompts = mcpToolsStore.getPrompts();
      }
      if (types.includes('resources')) {
        exportData.resources = mcpToolsStore.getResources();
      }

      // Set headers for file download
      res.setHeader('Content-Type', 'application/json');
      res.setHeader('Content-Disposition', `attachment; filename="mcp-tools-export-${Date.now()}.json"`);
      res.json(exportData);
    } catch (error) {
      res.status(500).json({ success: false, error: (error as Error).message });
    }
  });

  // POST /api/mcp-tools/import
  router.post('/api/mcp-tools/import', async (req: Request, res: Response) => {
    try {
      const { data, options } = req.body as {
        data: ExportData;
        options: ImportOptions;
      };

      // Validate export data
      if (!data || typeof data !== 'object') {
        res.status(400).json({ success: false, error: 'Invalid import data' });
        return;
      }

      if (data.version !== 1) {
        res.status(400).json({ success: false, error: `Unsupported export version: ${data.version}` });
        return;
      }

      const result: ImportResult = {
        success: true,
        imported: { tools: 0, prompts: 0, resources: 0 },
        skipped: { tools: [], prompts: [], resources: [] },
        errors: [],
      };

      // Import tools
      if (options.importTools !== false && data.tools) {
        for (const tool of data.tools) {
          try {
            const existing = mcpToolsStore.getToolByName(tool.name);
            if (existing) {
              if (options.conflictStrategy === 'skip') {
                result.skipped.tools.push(tool.name);
                continue;
              } else if (options.conflictStrategy === 'replace') {
                await mcpToolsStore.updateTool(existing.id, {
                  description: tool.description,
                  inputSchema: tool.inputSchema,
                  executor: tool.executor,
                  enabled: tool.enabled,
                });
                result.imported.tools++;
                continue;
              } else if (options.conflictStrategy === 'rename') {
                // Find unique name
                let newName = tool.name;
                let counter = 1;
                while (mcpToolsStore.getToolByName(newName)) {
                  newName = `${tool.name}_${counter++}`;
                }
                await mcpToolsStore.createTool({
                  name: newName,
                  description: tool.description,
                  inputSchema: tool.inputSchema,
                  executor: tool.executor,
                  enabled: tool.enabled,
                });
                result.imported.tools++;
                continue;
              }
            }
            await mcpToolsStore.createTool({
              name: tool.name,
              description: tool.description,
              inputSchema: tool.inputSchema,
              executor: tool.executor,
              enabled: tool.enabled,
            });
            result.imported.tools++;
          } catch (err) {
            result.errors.push(`Tool "${tool.name}": ${(err as Error).message}`);
          }
        }
      }

      // Import prompts
      if (options.importPrompts !== false && data.prompts) {
        for (const prompt of data.prompts) {
          try {
            const existing = mcpToolsStore.getPromptByName(prompt.name);
            if (existing) {
              if (options.conflictStrategy === 'skip') {
                result.skipped.prompts.push(prompt.name);
                continue;
              } else if (options.conflictStrategy === 'replace') {
                await mcpToolsStore.updatePrompt(existing.id, {
                  description: prompt.description,
                  arguments: prompt.arguments,
                  template: prompt.template,
                  enabled: prompt.enabled,
                });
                result.imported.prompts++;
                continue;
              } else if (options.conflictStrategy === 'rename') {
                let newName = prompt.name;
                let counter = 1;
                while (mcpToolsStore.getPromptByName(newName)) {
                  newName = `${prompt.name}_${counter++}`;
                }
                await mcpToolsStore.createPrompt({
                  name: newName,
                  description: prompt.description,
                  arguments: prompt.arguments,
                  template: prompt.template,
                  enabled: prompt.enabled,
                });
                result.imported.prompts++;
                continue;
              }
            }
            await mcpToolsStore.createPrompt({
              name: prompt.name,
              description: prompt.description,
              arguments: prompt.arguments,
              template: prompt.template,
              enabled: prompt.enabled,
            });
            result.imported.prompts++;
          } catch (err) {
            result.errors.push(`Prompt "${prompt.name}": ${(err as Error).message}`);
          }
        }
      }

      // Import resources
      if (options.importResources !== false && data.resources) {
        for (const resource of data.resources) {
          try {
            const existing = mcpToolsStore.getResourceByName(resource.name);
            if (existing) {
              if (options.conflictStrategy === 'skip') {
                result.skipped.resources.push(resource.name);
                continue;
              } else if (options.conflictStrategy === 'replace') {
                await mcpToolsStore.updateResource(existing.id, {
                  description: resource.description,
                  uri: resource.uri,
                  mimeType: resource.mimeType,
                  executor: resource.executor,
                  enabled: resource.enabled,
                });
                result.imported.resources++;
                continue;
              } else if (options.conflictStrategy === 'rename') {
                let newName = resource.name;
                let counter = 1;
                while (mcpToolsStore.getResourceByName(newName)) {
                  newName = `${resource.name}_${counter++}`;
                }
                await mcpToolsStore.createResource({
                  name: newName,
                  description: resource.description,
                  uri: resource.uri,
                  mimeType: resource.mimeType,
                  executor: resource.executor,
                  enabled: resource.enabled,
                });
                result.imported.resources++;
                continue;
              }
            }
            await mcpToolsStore.createResource({
              name: resource.name,
              description: resource.description,
              uri: resource.uri,
              mimeType: resource.mimeType,
              executor: resource.executor,
              enabled: resource.enabled,
            });
            result.imported.resources++;
          } catch (err) {
            result.errors.push(`Resource "${resource.name}": ${(err as Error).message}`);
          }
        }
      }

      result.success = result.errors.length === 0;
      res.json({ success: true, data: result });
    } catch (error) {
      res.status(500).json({ success: false, error: (error as Error).message });
    }
  });
}
