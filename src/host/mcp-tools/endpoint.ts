/**
 * MCP Tools Endpoint - HTTP endpoint for MCP protocol
 */

import { Router, Request, Response } from '../http/router';
import { McpToolsStore } from '../stores/McpToolsStore';
import { SecretStore } from '../stores/SecretStore';
import { DynamicMcpServer } from './index';

export interface McpToolsEndpointContext {
  mcpToolsStore: McpToolsStore;
  secretStore: SecretStore;
}

export function setupMcpToolsEndpoint(router: Router, ctx: McpToolsEndpointContext): void {
  const { mcpToolsStore, secretStore } = ctx;
  const mcpServer = new DynamicMcpServer(mcpToolsStore, secretStore);

  // MCP Tools endpoint - handles MCP protocol requests
  // POST /mcp-tools
  router.post('/mcp-tools', async (req: Request, res: Response) => {
    // Check if MCP Tools is enabled
    if (!mcpToolsStore.isEnabled()) {
      res.status(503).json({
        jsonrpc: '2.0',
        id: null,
        error: {
          code: -32000,
          message: 'MCP Tools is disabled',
        },
      });
      return;
    }

    try {
      const request = req.body as {
        jsonrpc: '2.0';
        id: string | number;
        method: string;
        params?: Record<string, unknown>;
      };

      // Extract session context from headers
      const workspaceId = (req.headers['x-workspace-id'] as string) || 'global';
      const projectRoot = req.headers['x-project-root'] as string | undefined;
      const clientType = req.headers['x-client-type'] as string | undefined;

      // Load secrets for this workspace into cache before execution
      await secretStore.loadMcpToolsSecrets(workspaceId);

      const response = await mcpServer.handleRequest(request, {
        workspaceId,
        projectRoot,
        clientType,
      });

      res.json(response);
    } catch (error) {
      res.status(500).json({
        jsonrpc: '2.0',
        id: null,
        error: {
          code: -32603,
          message: (error as Error).message || 'Internal error',
        },
      });
    }
  });

  // Health check for MCP Tools
  // GET /mcp-tools/health
  router.get('/mcp-tools/health', (req: Request, res: Response) => {
    const status = mcpToolsStore.getStatus();

    // Build the MCP endpoint URL based on the request host
    const host = req.headers.host || '127.0.0.1:4040';
    const mcpUrl = `http://${host}/mcp-tools`;

    res.json({
      status: status.enabled ? 'running' : 'stopped',
      url: mcpUrl,
      ...status,
    });
  });

  // SSE endpoint for MCP Tools (alternative transport)
  // GET /mcp-tools/sse
  router.get('/mcp-tools/sse', (req: Request, res: Response) => {
    // Check if MCP Tools is enabled
    if (!mcpToolsStore.isEnabled()) {
      res.status(503).json({ error: 'MCP Tools is disabled' });
      return;
    }

    // Set SSE headers
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');

    // Extract session context from headers/query
    const workspaceId = (req.query.workspaceId as string) || 'global';
    const projectRoot = req.query.projectRoot as string | undefined;
    const clientType = req.query.clientType as string | undefined;

    // Send initial connection event
    res.write(`event: open\ndata: ${JSON.stringify({ status: 'connected' })}\n\n`);

    // Handle incoming messages via query parameter or POST body
    // For SSE, client sends requests via separate POST calls
    // This endpoint just maintains the connection for server-sent events

    // Keep connection alive with periodic pings
    const pingInterval = setInterval(() => {
      res.write(`: ping\n\n`);
    }, 30000);

    // Clean up on close
    req.on('close', () => {
      clearInterval(pingInterval);
    });
  });
}
