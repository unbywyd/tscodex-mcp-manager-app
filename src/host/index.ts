/**
 * MCP Host - HTTP server and process manager
 */

import { createServer, Server, IncomingMessage, ServerResponse } from 'node:http';
import { WebSocketServer, WebSocket } from 'ws';
import { Router, createRouter, Request, Response } from './http/router';
import { ProcessManager } from './managers/ProcessManager';
import { PortManager } from './managers/PortManager';
import { EventBus } from './managers/EventBus';
import { ServerStore } from './stores/ServerStore';
import { WorkspaceStore } from './stores/WorkspaceStore';
import { SessionStore } from './stores/SessionStore';
import { SecretStore } from './stores/SecretStore';
import { setupRoutes } from './api/routes';
import { setupGateway } from './gateway';
import type { ServerEvent, AppEvent } from '../shared/types';

export class McpHost {
  private router: Router;
  private server: Server | null = null;
  private wss: WebSocketServer | null = null;
  private port: number = 0;

  // Managers
  private processManager: ProcessManager;
  private portManager: PortManager;
  private eventBus: EventBus;

  // Stores
  private serverStore: ServerStore;
  private workspaceStore: WorkspaceStore;
  private sessionStore: SessionStore;
  private secretStore: SecretStore;

  constructor() {
    this.router = createRouter();

    // Initialize stores
    this.serverStore = new ServerStore();
    this.workspaceStore = new WorkspaceStore();
    this.sessionStore = new SessionStore();
    this.secretStore = new SecretStore();

    // Initialize managers
    this.eventBus = new EventBus();
    this.portManager = new PortManager();
    this.processManager = new ProcessManager(
      this.portManager,
      this.eventBus,
      this.serverStore,
      this.secretStore
    );

    // Setup middleware
    this.setupMiddleware();
  }

  private setupMiddleware(): void {
    // CORS middleware - maximally permissive for local development
    this.router.use((req: Request, res: Response, next) => {
      // Allow all origins
      const origin = req.headers.origin || '*';
      res.setHeader('Access-Control-Allow-Origin', origin);
      res.setHeader('Access-Control-Allow-Credentials', 'true');
      res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, PATCH, DELETE, OPTIONS, HEAD');
      res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Requested-With, Accept, Origin, Cache-Control, Pragma');
      res.setHeader('Access-Control-Expose-Headers', 'Content-Length, Content-Type');
      res.setHeader('Access-Control-Max-Age', '86400'); // Cache preflight for 24 hours

      // Handle preflight requests immediately
      if (req.method === 'OPTIONS') {
        res.status(204).send('');
        return;
      }
      next();
    });

    // Request logging
    this.router.use((req: Request, _res: Response, next) => {
      console.log(`[${new Date().toISOString()}] ${req.method} ${req.path}`);
      next();
    });
  }

  /**
   * Start the HTTP server
   */
  async start(port: number): Promise<void> {
    console.log('[McpHost] Starting on port', port);
    this.port = port;

    // Load stores
    console.log('[McpHost] Loading stores...');
    await this.serverStore.load();
    await this.workspaceStore.load();
    console.log('[McpHost] Stores loaded');

    // Setup API routes
    setupRoutes(this.router, {
      serverStore: this.serverStore,
      workspaceStore: this.workspaceStore,
      sessionStore: this.sessionStore,
      secretStore: this.secretStore,
      processManager: this.processManager,
      portManager: this.portManager,
      eventBus: this.eventBus,
    });

    // Setup MCP Gateway
    setupGateway(this.router, {
      serverStore: this.serverStore,
      workspaceStore: this.workspaceStore,
      sessionStore: this.sessionStore,
      processManager: this.processManager,
    });

    // Error handler
    this.router.onError((err, _req, res) => {
      console.error('API Error:', err);
      res.status(500).json({
        success: false,
        error: err.message || 'Internal server error',
      });
    });

    // Create HTTP server
    this.server = createServer((req: IncomingMessage, res: ServerResponse) => {
      this.router.handle(req, res);
    });

    // Setup WebSocket server for events
    this.wss = new WebSocketServer({ server: this.server, path: '/events' });
    this.setupWebSocket();

    // Start listening
    console.log('[McpHost] Creating server...');
    return new Promise((resolve, reject) => {
      this.server!.listen(port, '127.0.0.1', () => {
        console.log(`[McpHost] MCP Host listening on http://127.0.0.1:${port}`);
        resolve();
      });

      this.server!.on('error', (err) => {
        console.error('[McpHost] Server error:', err);
        reject(err);
      });
    });
  }

  /**
   * Stop the HTTP server
   */
  async stop(): Promise<void> {
    // Stop all server processes
    await this.processManager.stopAll();

    // Close WebSocket connections
    if (this.wss) {
      this.wss.clients.forEach((client) => {
        client.close();
      });
      this.wss.close();
      this.wss = null;
    }

    // Close HTTP server
    if (this.server) {
      return new Promise((resolve) => {
        this.server!.close(() => {
          this.server = null;
          resolve();
        });
      });
    }
  }

  /**
   * Check if server is running
   */
  isRunning(): boolean {
    return this.server !== null && this.server.listening;
  }

  /**
   * Get current port
   */
  getPort(): number {
    return this.port;
  }

  /**
   * Get secret store for IPC access
   */
  getSecretStore(): SecretStore {
    return this.secretStore;
  }

  /**
   * Setup WebSocket for real-time events
   */
  private setupWebSocket(): void {
    if (!this.wss) return;

    this.wss.on('connection', (ws: WebSocket) => {
      console.log('WebSocket client connected');

      // Send initial status
      ws.send(JSON.stringify({
        type: 'connected',
        timestamp: Date.now(),
      }));

      ws.on('close', () => {
        console.log('WebSocket client disconnected');
      });

      ws.on('error', (error) => {
        console.error('WebSocket error:', error);
      });
    });

    // Broadcast server events
    this.eventBus.on('server-event', (event: ServerEvent) => {
      this.broadcast(event);
    });

    // Broadcast app events
    this.eventBus.on('app-event', (event: AppEvent) => {
      this.broadcast(event);
    });
  }

  /**
   * Broadcast message to all connected WebSocket clients
   */
  private broadcast(message: unknown): void {
    if (!this.wss) return;

    const data = JSON.stringify(message);
    this.wss.clients.forEach((client) => {
      if (client.readyState === WebSocket.OPEN) {
        client.send(data);
      }
    });
  }
}
