/**
 * SessionStore - Manages active workspace sessions (in-memory)
 */

import { v4 as uuid } from 'uuid';
import type { WorkspaceSession, ClientType, SESSION_TIMEOUT } from '../../shared/types';

const SESSION_CLEANUP_INTERVAL = 15000; // 15 seconds
const DEFAULT_SESSION_TIMEOUT = 40000; // 40 seconds

export type SessionExpiredCallback = (sessionId: string, workspaceId: string) => void;

export class SessionStore {
  private sessions: Map<string, WorkspaceSession> = new Map();
  private cleanupTimer: ReturnType<typeof setInterval> | null = null;
  private onSessionExpired: SessionExpiredCallback | null = null;

  constructor() {
    // Start cleanup timer
    this.cleanupTimer = setInterval(() => {
      this.cleanupExpiredSessions();
    }, SESSION_CLEANUP_INTERVAL);
  }

  /**
   * Set callback for when sessions expire (for auto-cleanup)
   */
  setOnSessionExpired(callback: SessionExpiredCallback): void {
    this.onSessionExpired = callback;
  }

  /**
   * Create a new session
   */
  create(data: {
    workspaceId: string;
    projectRoot: string;
    clientType: ClientType;
    clientInstanceId: string;
  }): WorkspaceSession {
    // Check if session already exists for this client instance
    const existing = this.findByClientInstance(data.clientInstanceId);
    if (existing) {
      // Update existing session
      existing.lastSeenAt = Date.now();
      existing.workspaceId = data.workspaceId;
      existing.projectRoot = data.projectRoot;
      return existing;
    }

    const session: WorkspaceSession = {
      sessionId: uuid(),
      workspaceId: data.workspaceId,
      clientType: data.clientType,
      clientInstanceId: data.clientInstanceId,
      projectRoot: data.projectRoot,
      lastSeenAt: Date.now(),
      mcpEndpoints: {},
    };

    this.sessions.set(session.sessionId, session);
    return session;
  }

  /**
   * Get session by ID
   */
  get(sessionId: string): WorkspaceSession | undefined {
    return this.sessions.get(sessionId);
  }

  /**
   * Find session by client instance ID
   */
  findByClientInstance(clientInstanceId: string): WorkspaceSession | undefined {
    for (const session of this.sessions.values()) {
      if (session.clientInstanceId === clientInstanceId) {
        return session;
      }
    }
    return undefined;
  }

  /**
   * Find sessions by workspace ID
   */
  findByWorkspace(workspaceId: string): WorkspaceSession[] {
    const result: WorkspaceSession[] = [];
    for (const session of this.sessions.values()) {
      if (session.workspaceId === workspaceId) {
        result.push(session);
      }
    }
    return result;
  }

  /**
   * Update session heartbeat
   */
  ping(sessionId: string): boolean {
    const session = this.sessions.get(sessionId);
    if (session) {
      session.lastSeenAt = Date.now();
      return true;
    }
    return false;
  }

  /**
   * Update session's MCP endpoints
   */
  updateEndpoints(sessionId: string, endpoints: Record<string, string>): boolean {
    const session = this.sessions.get(sessionId);
    if (session) {
      session.mcpEndpoints = endpoints;
      return true;
    }
    return false;
  }

  /**
   * Delete session
   */
  delete(sessionId: string): boolean {
    return this.sessions.delete(sessionId);
  }

  /**
   * Get all sessions
   */
  getAll(): WorkspaceSession[] {
    return Array.from(this.sessions.values());
  }

  /**
   * Get active session count
   */
  getCount(): number {
    return this.sessions.size;
  }

  /**
   * Cleanup expired sessions
   */
  private cleanupExpiredSessions(): void {
    const now = Date.now();
    const expired: { sessionId: string; workspaceId: string }[] = [];

    for (const [sessionId, session] of this.sessions) {
      if (now - session.lastSeenAt > DEFAULT_SESSION_TIMEOUT) {
        expired.push({ sessionId, workspaceId: session.workspaceId });
      }
    }

    for (const { sessionId, workspaceId } of expired) {
      console.log(`Cleaning up expired session: ${sessionId} (workspace: ${workspaceId})`);
      this.sessions.delete(sessionId);

      // Notify about expired session for auto-cleanup
      if (this.onSessionExpired) {
        this.onSessionExpired(sessionId, workspaceId);
      }
    }
  }

  /**
   * Stop cleanup timer
   */
  dispose(): void {
    if (this.cleanupTimer) {
      clearInterval(this.cleanupTimer);
      this.cleanupTimer = null;
    }
  }
}
