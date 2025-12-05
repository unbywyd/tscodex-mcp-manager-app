/**
 * AIUsageStore - SQLite store for AI usage tracking (using sql.js WASM)
 */

import initSqlJs from 'sql.js';
import type { Database as SqlJsDatabase, SqlValue } from 'sql.js';
import { app } from 'electron';
import fs from 'fs';
import path from 'path';
import type { AIUsageEntry, AIUsageStats } from '../../shared/types';

// Default retention period: 30 days
const DEFAULT_RETENTION_MS = 30 * 24 * 60 * 60 * 1000;

export class AIUsageStore {
  private db: SqlJsDatabase | null = null;
  private dbPath: string;
  private initialized: boolean = false;
  private initPromise: Promise<void> | null = null;

  constructor() {
    const userDataPath = app?.getPath?.('userData') || process.cwd();
    const dataDir = path.join(userDataPath, 'data');

    // Ensure data directory exists
    if (!fs.existsSync(dataDir)) {
      fs.mkdirSync(dataDir, { recursive: true });
    }

    this.dbPath = path.join(dataDir, 'ai-usage.db');

    // Start initialization
    this.initPromise = this.initialize();
  }

  /**
   * Initialize database
   */
  private async initialize(): Promise<void> {
    if (this.initialized) return;

    const SQL = await initSqlJs();

    // Load existing database or create new one
    if (fs.existsSync(this.dbPath)) {
      const buffer = fs.readFileSync(this.dbPath);
      this.db = new SQL.Database(buffer);
    } else {
      this.db = new SQL.Database();
    }

    // Create schema
    this.db.run(`
      CREATE TABLE IF NOT EXISTS ai_usage (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        timestamp INTEGER NOT NULL,
        source TEXT NOT NULL,
        model TEXT NOT NULL,
        input_tokens INTEGER NOT NULL DEFAULT 0,
        output_tokens INTEGER NOT NULL DEFAULT 0,
        status TEXT NOT NULL DEFAULT 'success',
        error_msg TEXT,
        latency_ms INTEGER NOT NULL DEFAULT 0
      )
    `);

    this.db.run('CREATE INDEX IF NOT EXISTS idx_ai_usage_timestamp ON ai_usage(timestamp)');
    this.db.run('CREATE INDEX IF NOT EXISTS idx_ai_usage_source_timestamp ON ai_usage(source, timestamp)');

    this.initialized = true;
    this.save();
  }

  /**
   * Ensure database is initialized before operations
   */
  private async ensureInitialized(): Promise<void> {
    if (!this.initialized && this.initPromise) {
      await this.initPromise;
    }
  }

  /**
   * Save database to disk
   */
  private save(): void {
    if (!this.db) return;

    try {
      const data = this.db.export();
      const buffer = Buffer.from(data);
      fs.writeFileSync(this.dbPath, buffer);
    } catch (err) {
      console.error('[AIUsageStore] Failed to save database:', err);
    }
  }

  /**
   * Log a usage entry
   */
  async log(entry: Omit<AIUsageEntry, 'id' | 'sourceName'>): Promise<number> {
    await this.ensureInitialized();
    if (!this.db) return -1;

    this.db.run(
      `INSERT INTO ai_usage (timestamp, source, model, input_tokens, output_tokens, status, error_msg, latency_ms)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        entry.timestamp,
        entry.source,
        entry.model,
        entry.inputTokens,
        entry.outputTokens,
        entry.status,
        entry.errorMsg || null,
        entry.latencyMs,
      ]
    );

    // Get last inserted id
    const result = this.db.exec('SELECT last_insert_rowid() as id');
    const id = result[0]?.values[0]?.[0] as number || -1;

    this.save();
    return id;
  }

  /**
   * Get usage statistics
   */
  async getStats(source?: string, periodMs?: number): Promise<AIUsageStats> {
    await this.ensureInitialized();

    const stats: AIUsageStats = {
      totalRequests: 0,
      totalInputTokens: 0,
      totalOutputTokens: 0,
      bySource: {},
    };

    if (!this.db) return stats;

    const now = Date.now();
    const since = periodMs ? now - periodMs : 0;

    let query = `
      SELECT
        source,
        COUNT(*) as requests,
        SUM(input_tokens) as input_tokens,
        SUM(output_tokens) as output_tokens
      FROM ai_usage
      WHERE timestamp >= ?
    `;

    const params: (string | number)[] = [since];

    if (source && source !== 'all') {
      query += ' AND source = ?';
      params.push(source);
    }

    query += ' GROUP BY source';

    const result = this.db.exec(query, params);

    if (result[0]) {
      for (const row of result[0].values) {
        const [src, requests, inputTokens, outputTokens] = row as [string, number, number, number];

        stats.totalRequests += requests || 0;
        stats.totalInputTokens += inputTokens || 0;
        stats.totalOutputTokens += outputTokens || 0;
        stats.bySource[src] = {
          requests: requests || 0,
          inputTokens: inputTokens || 0,
          outputTokens: outputTokens || 0,
        };
      }
    }

    return stats;
  }

  /**
   * Get usage log with pagination
   */
  async getLog(
    source?: string,
    periodMs?: number,
    page: number = 1,
    limit: number = 20
  ): Promise<{ entries: Omit<AIUsageEntry, 'sourceName'>[]; total: number; pages: number }> {
    await this.ensureInitialized();

    if (!this.db) {
      return { entries: [], total: 0, pages: 0 };
    }

    const now = Date.now();
    const since = periodMs ? now - periodMs : 0;
    const offset = (page - 1) * limit;

    // Build WHERE clause
    let whereClause = 'WHERE timestamp >= ?';
    const params: (string | number)[] = [since];

    if (source && source !== 'all') {
      whereClause += ' AND source = ?';
      params.push(source);
    }

    // Get total count
    const countQuery = `SELECT COUNT(*) as count FROM ai_usage ${whereClause}`;
    const countResult = this.db.exec(countQuery, params);
    const total = (countResult[0]?.values[0]?.[0] as number) || 0;

    // Get entries
    const query = `
      SELECT id, timestamp, source, model, input_tokens, output_tokens, status, error_msg, latency_ms
      FROM ai_usage
      ${whereClause}
      ORDER BY timestamp DESC
      LIMIT ? OFFSET ?
    `;

    const result = this.db.exec(query, [...params, limit, offset]);

    const entries: Omit<AIUsageEntry, 'sourceName'>[] = [];

    if (result[0]) {
      for (const row of result[0].values) {
        const [id, timestamp, src, model, inputTokens, outputTokens, status, errorMsg, latencyMs] = row as [
          number, number, string, string, number, number, string, string | null, number
        ];

        entries.push({
          id,
          timestamp,
          source: src,
          model,
          inputTokens: inputTokens || 0,
          outputTokens: outputTokens || 0,
          status: status as 'success' | 'error' | 'rate_limited',
          errorMsg: errorMsg || undefined,
          latencyMs: latencyMs || 0,
        });
      }
    }

    return {
      entries,
      total,
      pages: Math.ceil(total / limit),
    };
  }

  /**
   * Get unique sources for filter dropdown
   */
  async getSources(): Promise<string[]> {
    await this.ensureInitialized();

    if (!this.db) return [];

    const result = this.db.exec('SELECT DISTINCT source FROM ai_usage ORDER BY source');

    if (!result[0]) return [];

    return result[0].values.map((row: SqlValue[]) => row[0] as string);
  }

  /**
   * Cleanup old entries
   * @returns Number of deleted entries
   */
  async cleanup(retentionMs: number = DEFAULT_RETENTION_MS): Promise<number> {
    await this.ensureInitialized();

    if (!this.db) return 0;

    const cutoff = Date.now() - retentionMs;

    // Get count before delete
    const beforeResult = this.db.exec('SELECT COUNT(*) FROM ai_usage WHERE timestamp < ?', [cutoff]);
    const count = (beforeResult[0]?.values[0]?.[0] as number) || 0;

    if (count > 0) {
      this.db.run('DELETE FROM ai_usage WHERE timestamp < ?', [cutoff]);
      this.save();
    }

    return count;
  }

  /**
   * Close database connection
   */
  close(): void {
    if (this.db) {
      this.save();
      this.db.close();
      this.db = null;
    }
  }
}
