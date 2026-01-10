/**
 * RuntimeDatabase implementation
 *
 * Provides persistent storage for:
 * - Message queue: Reliable IPC fallback
 * - Candle state: CandleGroup state persistence for service restarts
 * - Gap records: Gap detection records for admin monitoring
 *
 * This class replaces SQLiteQueue with additional state persistence capabilities.
 */

import Database from 'better-sqlite3';
import { existsSync, mkdirSync } from 'fs';
import { dirname } from 'path';
import { MIGRATIONS, SCHEMA_VERSION_TABLE } from './schema.js';
import type { RuntimeDatabaseConfig } from './types.js';
import type {
  QueueMessageDTO,
  GapRecordInputDTO,
  GapRecordDTO,
  GapLoadOptionsDTO,
} from '../../dto/dto.js';

export class RuntimeDatabase {
  private db: Database.Database;
  private readonly retentionHours: number;

  constructor(config: RuntimeDatabaseConfig) {
    // Ensure parent directory exists (better-sqlite3 doesn't create it)
    const dbDir = dirname(config.runtimeDbPath);
    if (!existsSync(dbDir)) {
      mkdirSync(dbDir, { recursive: true });
    }

    this.db = new Database(config.runtimeDbPath);
    this.retentionHours = config.retentionHours ?? 24;
    this.runMigrations();
  }

  // ============ Migration Methods ============

  /**
   * Run all pending migrations
   */
  private runMigrations(): void {
    // Create schema version table if it doesn't exist
    this.db.exec(SCHEMA_VERSION_TABLE);

    const currentVersion = this.getSchemaVersion();

    for (const migration of MIGRATIONS) {
      if (migration.version > currentVersion) {
        this.db.exec(migration.sql);
        this.db
          .prepare(
            'INSERT INTO schema_version (version, description) VALUES (?, ?)'
          )
          .run(migration.version, migration.description);
      }
    }
  }

  /**
   * Get the current schema version
   */
  getSchemaVersion(): number {
    try {
      const row = this.db
        .prepare('SELECT MAX(version) as version FROM schema_version')
        .get() as { version: number | null } | undefined;
      return row?.version ?? 0;
    } catch {
      // Table doesn't exist yet
      return 0;
    }
  }

  // ============ Message Queue Methods ============

  /**
   * Enqueue a message
   */
  enqueue(message: QueueMessageDTO): void {
    const stmt = this.db.prepare(`
      INSERT INTO message_queue (message_id, type, payload, timestamp)
      VALUES (?, ?, ?, ?)
    `);

    stmt.run(
      message.id,
      message.type,
      JSON.stringify(message.payload),
      message.timestamp
    );
  }

  /**
   * Dequeue messages (retrieve unprocessed messages)
   */
  dequeue(batchSize: number = 50): QueueMessageDTO[] {
    const stmt = this.db.prepare(`
      SELECT message_id, type, payload, timestamp
      FROM message_queue
      WHERE processed = 0
      ORDER BY timestamp ASC
      LIMIT ?
    `);

    const rows = stmt.all(batchSize) as Array<{
      message_id: string;
      type: string;
      payload: string;
      timestamp: number;
    }>;

    return rows.map((row) => ({
      id: row.message_id,
      type: row.type,
      payload: JSON.parse(row.payload),
      timestamp: row.timestamp,
    }));
  }

  /**
   * Mark a message as processed
   */
  markProcessed(messageId: string): void {
    const stmt = this.db.prepare(`
      UPDATE message_queue
      SET processed = 1, processed_at = strftime('%s', 'now')
      WHERE message_id = ?
    `);

    stmt.run(messageId);
  }

  /**
   * Clean up old processed messages
   *
   * @returns Number of messages deleted
   */
  cleanup(retentionHours?: number): number {
    const hours = retentionHours ?? this.retentionHours;
    const cutoff = Math.floor(Date.now() / 1000) - hours * 60 * 60;

    const stmt = this.db.prepare(`
      DELETE FROM message_queue
      WHERE processed = 1 AND processed_at < ?
    `);

    const result = stmt.run(cutoff);
    return result.changes;
  }

  // ============ State Persistence Methods ============

  /**
   * Save a single CandleGroup state
   */
  saveState(exchange: string, symbol: string, stateJson: string): void {
    const stmt = this.db.prepare(`
      INSERT OR REPLACE INTO candle_state (exchange, symbol, state_json, updated_at)
      VALUES (?, ?, ?, ?)
    `);
    stmt.run(exchange, symbol, stateJson, Date.now());
  }

  /**
   * Save multiple CandleGroup states in a single transaction
   */
  saveStateBatch(
    states: Array<{ exchange: string; symbol: string; stateJson: string }>
  ): void {
    const stmt = this.db.prepare(`
      INSERT OR REPLACE INTO candle_state (exchange, symbol, state_json, updated_at)
      VALUES (?, ?, ?, ?)
    `);

    const transaction = this.db.transaction(
      (
        items: Array<{ exchange: string; symbol: string; stateJson: string }>
      ) => {
        const now = Date.now();
        for (const { exchange, symbol, stateJson } of items) {
          stmt.run(exchange, symbol, stateJson, now);
        }
      }
    );

    transaction(states);
  }

  /**
   * Load a single CandleGroup state
   */
  loadState(exchange: string, symbol: string): string | null {
    const row = this.db
      .prepare(
        'SELECT state_json FROM candle_state WHERE exchange = ? AND symbol = ?'
      )
      .get(exchange, symbol) as { state_json: string } | undefined;
    return row?.state_json ?? null;
  }

  /**
   * Load states for specific symbols (within an exchange)
   */
  loadStatesBatch(
    exchange: string,
    symbols: string[]
  ): Array<{ exchange: string; symbol: string; stateJson: string }> {
    if (symbols.length === 0) return [];

    const placeholders = symbols.map(() => '?').join(',');
    const rows = this.db
      .prepare(
        `SELECT exchange, symbol, state_json FROM candle_state 
         WHERE exchange = ? AND symbol IN (${placeholders})`
      )
      .all(exchange, ...symbols) as Array<{
      exchange: string;
      symbol: string;
      state_json: string;
    }>;

    return rows.map((row) => ({
      exchange: row.exchange,
      symbol: row.symbol,
      stateJson: row.state_json,
    }));
  }

  /**
   * Load all persisted CandleGroup states
   */
  loadAllStates(): Array<{
    exchange: string;
    symbol: string;
    stateJson: string;
  }> {
    const rows = this.db
      .prepare('SELECT exchange, symbol, state_json FROM candle_state')
      .all() as Array<{ exchange: string; symbol: string; state_json: string }>;

    return rows.map((row) => ({
      exchange: row.exchange,
      symbol: row.symbol,
      stateJson: row.state_json,
    }));
  }

  /**
   * Load all states for a specific exchange
   */
  loadStatesByExchange(
    exchange: string
  ): Array<{ exchange: string; symbol: string; stateJson: string }> {
    const rows = this.db
      .prepare(
        'SELECT exchange, symbol, state_json FROM candle_state WHERE exchange = ?'
      )
      .all(exchange) as Array<{
      exchange: string;
      symbol: string;
      state_json: string;
    }>;

    return rows.map((row) => ({
      exchange: row.exchange,
      symbol: row.symbol,
      stateJson: row.state_json,
    }));
  }

  // ============ Gap Records Methods ============

  /**
   * Save a gap record
   */
  saveGap(gap: GapRecordInputDTO): void {
    const stmt = this.db.prepare(`
      INSERT OR IGNORE INTO gap_records (exchange, symbol, from_trade_id, to_trade_id, gap_size, detected_at)
      VALUES (?, ?, ?, ?, ?, ?)
    `);
    stmt.run(
      gap.exchange,
      gap.symbol,
      gap.fromTradeId,
      gap.toTradeId,
      gap.gapSize,
      gap.detectedAt
    );
  }

  /**
   * Save multiple gap records in a single transaction
   * Used by queue-based gap persistence to reduce IPC overhead
   */
  saveGapBatch(gaps: GapRecordInputDTO[]): void {
    if (gaps.length === 0) return;

    const stmt = this.db.prepare(`
      INSERT OR IGNORE INTO gap_records (exchange, symbol, from_trade_id, to_trade_id, gap_size, detected_at)
      VALUES (?, ?, ?, ?, ?, ?)
    `);

    const transaction = this.db.transaction((items: GapRecordInputDTO[]) => {
      for (const gap of items) {
        stmt.run(
          gap.exchange,
          gap.symbol,
          gap.fromTradeId,
          gap.toTradeId,
          gap.gapSize,
          gap.detectedAt
        );
      }
    });

    transaction(gaps);
  }

  /**
   * Load gap records with optional filtering
   */
  loadGaps(options?: GapLoadOptionsDTO): GapRecordDTO[] {
    let sql = 'SELECT * FROM gap_records WHERE 1=1';
    const params: (string | number)[] = [];

    if (options?.exchange) {
      sql += ' AND exchange = ?';
      params.push(options.exchange);
    }
    if (options?.symbol) {
      sql += ' AND symbol = ?';
      params.push(options.symbol);
    }
    if (options?.syncedOnly !== undefined) {
      sql += ' AND synced = ?';
      params.push(options.syncedOnly ? 1 : 0);
    }

    sql += ' ORDER BY detected_at DESC';

    const rows = this.db.prepare(sql).all(...params) as Array<{
      id: number;
      exchange: string;
      symbol: string;
      from_trade_id: number;
      to_trade_id: number;
      gap_size: number;
      detected_at: number;
      synced: number;
      synced_at: number | null;
    }>;

    return rows.map((row) => ({
      id: row.id,
      exchange: row.exchange,
      symbol: row.symbol,
      fromTradeId: row.from_trade_id,
      toTradeId: row.to_trade_id,
      gapSize: row.gap_size,
      detectedAt: row.detected_at,
      synced: row.synced === 1,
      syncedAt: row.synced_at,
    }));
  }

  /**
   * Mark gap records as synced
   */
  markGapsSynced(gapIds: number[]): void {
    if (gapIds.length === 0) return;

    const placeholders = gapIds.map(() => '?').join(',');
    const stmt = this.db.prepare(`
      UPDATE gap_records 
      SET synced = 1, synced_at = ? 
      WHERE id IN (${placeholders})
    `);
    stmt.run(Date.now(), ...gapIds);
  }

  // ============ Lifecycle Methods ============

  /**
   * Close the database connection
   */
  close(): void {
    this.db.close();
  }
}
