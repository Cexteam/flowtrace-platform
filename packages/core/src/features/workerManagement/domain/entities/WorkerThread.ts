/**
 * WorkerThread Entity - Domain representation of a worker thread
 *
 * Encapsulates the state and behavior of a worker thread in the pool.
 * This is a domain entity that represents the worker's logical state,
 * separate from the infrastructure-level Node.js Worker instance.
 *
 */

/**
 * Possible states for a worker thread
 */
export type WorkerState =
  | 'initializing'
  | 'ready'
  | 'busy'
  | 'unhealthy'
  | 'terminated';

/**
 * Health metrics for a worker
 */
export interface WorkerHealthMetrics {
  /** Last heartbeat timestamp */
  lastHeartbeat: Date;
  /** Total trades processed */
  totalTradesProcessed: number;
  /** Events published via IPC */
  eventsPublished: number;
  /** Average processing time in ms */
  averageProcessingTimeMs: number;
  /** Memory usage in bytes */
  memoryUsageBytes: number;
  /** CPU usage percentage (0-100) */
  cpuUsagePercent: number;
  /** Error count */
  errorCount: number;
  /** Last error if any */
  lastError?: string;
}

/**
 * CPU usage snapshot for delta calculation
 */
export interface CpuUsageSnapshot {
  userMs: number;
  systemMs: number;
  timestamp: number;
}

/**
 * WorkerThread - Domain entity representing a worker thread
 */
export class WorkerThread {
  private _state: WorkerState;
  private _assignedSymbols: Set<string>;
  private _healthMetrics: WorkerHealthMetrics;
  private _createdAt: Date;
  private _lastActivityAt: Date;
  /** Flag indicating if worker has sent WORKER_READY message */
  private _isReady: boolean;
  /** Timestamp when worker became ready (sent WORKER_READY) */
  private _readyTimestamp?: number;
  /** Last CPU usage snapshot for delta calculation */
  private _lastCpuSnapshot?: CpuUsageSnapshot;

  constructor(
    public readonly workerId: string,
    public readonly threadId: number,
    initialSymbols: string[] = []
  ) {
    this._state = 'initializing';
    this._assignedSymbols = new Set(initialSymbols);
    this._createdAt = new Date();
    this._lastActivityAt = new Date();
    this._isReady = false;
    this._healthMetrics = {
      lastHeartbeat: new Date(),
      totalTradesProcessed: 0,
      eventsPublished: 0,
      averageProcessingTimeMs: 0,
      memoryUsageBytes: 0,
      cpuUsagePercent: 0,
      errorCount: 0,
    };
  }

  // ============================================================================
  // State Management
  // ============================================================================

  /**
   * Get current worker state
   */
  get state(): WorkerState {
    return this._state;
  }

  /**
   * Check if worker is healthy and ready to process
   */
  get isHealthy(): boolean {
    return this._state === 'ready' || this._state === 'busy';
  }

  /**
   * Check if worker is available for new work
   */
  get isAvailable(): boolean {
    return this._state === 'ready';
  }

  /**
   * Check if worker has sent WORKER_READY message
   */
  get isReady(): boolean {
    return this._isReady;
  }

  /**
   * Get timestamp when worker became ready
   */
  get readyTimestamp(): number | undefined {
    return this._readyTimestamp;
  }

  /**
   * Mark worker as ready (state transition)
   */
  markReady(): void {
    this._state = 'ready';
    this._lastActivityAt = new Date();
  }

  /**
   * Mark worker as ready after receiving WORKER_READY message
   */
  markWorkerReady(timestamp?: number): void {
    this._isReady = true;
    this._readyTimestamp = timestamp ?? Date.now();
    this._state = 'ready';
    this._lastActivityAt = new Date();
  }

  /**
   * Mark worker as busy processing
   */
  markBusy(): void {
    this._state = 'busy';
    this._lastActivityAt = new Date();
  }

  /**
   * Mark worker as unhealthy
   */
  markUnhealthy(reason?: string): void {
    this._state = 'unhealthy';
    this._lastActivityAt = new Date();
    if (reason) {
      this._healthMetrics.lastError = reason;
      this._healthMetrics.errorCount++;
    }
  }

  /**
   * Mark worker as terminated
   */
  markTerminated(): void {
    this._state = 'terminated';
    this._lastActivityAt = new Date();
  }

  // ============================================================================
  // Symbol Assignment
  // ============================================================================

  /**
   * Get all assigned symbols
   */
  get assignedSymbols(): string[] {
    return Array.from(this._assignedSymbols);
  }

  /**
   * Get count of assigned symbols
   */
  get symbolCount(): number {
    return this._assignedSymbols.size;
  }

  /**
   * Assign a symbol to this worker
   */
  assignSymbol(symbol: string): void {
    this._assignedSymbols.add(symbol);
    this._lastActivityAt = new Date();
  }

  /**
   * Remove a symbol from this worker
   */
  removeSymbol(symbol: string): void {
    this._assignedSymbols.delete(symbol);
    this._lastActivityAt = new Date();
  }

  /**
   * Check if worker handles a specific symbol
   */
  hasSymbol(symbol: string): boolean {
    return this._assignedSymbols.has(symbol);
  }

  /**
   * Replace all assigned symbols
   */
  replaceSymbols(symbols: string[]): void {
    this._assignedSymbols = new Set(symbols);
    this._lastActivityAt = new Date();
  }

  // ============================================================================
  // Health Metrics
  // ============================================================================

  /**
   * Get current health metrics
   */
  get healthMetrics(): WorkerHealthMetrics {
    return { ...this._healthMetrics };
  }

  /**
   * Update heartbeat timestamp
   */
  recordHeartbeat(): void {
    this._healthMetrics.lastHeartbeat = new Date();
    this._lastActivityAt = new Date();
  }

  /**
   * Record trade processing metrics
   */
  recordTradeProcessing(
    tradesProcessed: number,
    processingTimeMs: number
  ): void {
    this._healthMetrics.totalTradesProcessed += tradesProcessed;

    // Rolling average for processing time
    const currentAvg = this._healthMetrics.averageProcessingTimeMs;
    this._healthMetrics.averageProcessingTimeMs =
      (currentAvg + processingTimeMs) / 2;

    this._lastActivityAt = new Date();
  }

  /**
   * Record events published
   */
  recordEventsPublished(count: number): void {
    this._healthMetrics.eventsPublished += count;
    this._lastActivityAt = new Date();
  }

  /**
   * Update memory usage
   */
  updateMemoryUsage(bytes: number): void {
    this._healthMetrics.memoryUsageBytes = bytes;
  }

  /**
   * Update CPU usage from worker metrics
   * Calculates percentage based on delta from last snapshot
   * @param cpuUsage - Current CPU usage snapshot { userMs, systemMs }
   */
  updateCpuUsage(cpuUsage: { userMs: number; systemMs: number }): void {
    const now = Date.now();
    const currentSnapshot: CpuUsageSnapshot = {
      userMs: cpuUsage.userMs,
      systemMs: cpuUsage.systemMs,
      timestamp: now,
    };

    if (this._lastCpuSnapshot) {
      // Calculate delta
      const timeDeltaMs = now - this._lastCpuSnapshot.timestamp;
      if (timeDeltaMs > 0) {
        const userDelta = cpuUsage.userMs - this._lastCpuSnapshot.userMs;
        const systemDelta = cpuUsage.systemMs - this._lastCpuSnapshot.systemMs;
        const totalCpuMs = userDelta + systemDelta;

        // CPU percentage = (CPU time used / wall clock time) * 100
        // Clamp to 0-100 range
        const cpuPercent = Math.min(
          100,
          Math.max(0, (totalCpuMs / timeDeltaMs) * 100)
        );
        this._healthMetrics.cpuUsagePercent = Math.round(cpuPercent * 10) / 10; // 1 decimal place
      }
    }

    // Store current snapshot for next calculation
    this._lastCpuSnapshot = currentSnapshot;
  }

  /**
   * Record an error
   */
  recordError(error: string): void {
    this._healthMetrics.errorCount++;
    this._healthMetrics.lastError = error;
    this._lastActivityAt = new Date();
  }

  // ============================================================================
  // Timestamps
  // ============================================================================

  /**
   * Get creation timestamp
   */
  get createdAt(): Date {
    return this._createdAt;
  }

  /**
   * Get last activity timestamp
   */
  get lastActivityAt(): Date {
    return this._lastActivityAt;
  }

  /**
   * Get uptime in seconds
   */
  get uptimeSeconds(): number {
    return Math.floor((Date.now() - this._createdAt.getTime()) / 1000);
  }

  // ============================================================================
  // Serialization
  // ============================================================================

  /**
   * Convert to plain object for serialization
   */
  toJSON(): Record<string, unknown> {
    return {
      workerId: this.workerId,
      threadId: this.threadId,
      state: this._state,
      assignedSymbols: this.assignedSymbols,
      healthMetrics: this._healthMetrics,
      createdAt: this._createdAt.toISOString(),
      lastActivityAt: this._lastActivityAt.toISOString(),
      uptimeSeconds: this.uptimeSeconds,
      isReady: this._isReady,
      readyTimestamp: this._readyTimestamp,
    };
  }

  /**
   * Create a WorkerThread from serialized data
   */
  static fromJSON(data: Record<string, unknown>): WorkerThread {
    const worker = new WorkerThread(
      data.workerId as string,
      data.threadId as number,
      data.assignedSymbols as string[]
    );

    worker._state = data.state as WorkerState;
    worker._healthMetrics = data.healthMetrics as WorkerHealthMetrics;
    worker._createdAt = new Date(data.createdAt as string);
    worker._lastActivityAt = new Date(data.lastActivityAt as string);
    worker._isReady = (data.isReady as boolean) ?? false;
    worker._readyTimestamp = data.readyTimestamp as number | undefined;

    return worker;
  }
}
