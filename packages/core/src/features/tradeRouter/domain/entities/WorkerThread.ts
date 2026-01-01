/**
 * Domain Entity: Worker Thread
 * Represents a worker thread in the routing system with health and ownership state
 */

export class WorkerThread {
  constructor(
    public readonly id: WorkerId,
    public readonly type: WorkerType = 'footprint_processor',
    private _status: WorkerStatus = 'initializing'
  ) {
    this.symbolsOwned = new Set();
    this.healthMetrics = {
      lastHeartbeat: new Date(),
      activeConnections: 0,
      messageQueueSize: 0,
      symbolsProcessedThisMinute: 0,
      averageProcessingTime: 0,
      memoryUsage: 0,
      cpuUsage: 0
    };
  }

  public symbolsOwned: Set<Symbol>;
  public healthMetrics: WorkerHealthMetrics;
  public readonly createdAt: Date = new Date();
  public lastActivityAt: Date = new Date();

  /**
   * Status management
   */
  get status(): WorkerStatus {
    return this._status;
  }

  setStatus(newStatus: WorkerStatus): void {
    this.validateStatusTransition(this._status, newStatus);
    this._status = newStatus;
    this.updateActivityTime();
  }

  private validateStatusTransition(from: WorkerStatus, to: WorkerStatus): void {
    const validTransitions: Record<WorkerStatus, WorkerStatus[]> = {
      'initializing': ['ready', 'error'],
      'ready': ['busy', 'error', 'shutdown'],
      'busy': ['ready', 'error', 'shutdown'],
      'error': ['initializing', 'shutdown'],
      'shutdown': []
    };

    if (!validTransitions[from].includes(to)) {
      throw new Error(`Invalid worker status transition: ${from} → ${to}`);
    }
  }

  /**
   * Symbol ownership management
   */
  assignSymbol(symbol: Symbol): boolean {
    if (this.symbolsOwned.has(symbol)) {
      return false; // Already owns
    }

    if (this.symbolsOwned.size >= this.getMaxSymbolsPerWorker()) {
      return false; // At capacity
    }

    this.symbolsOwned.add(symbol);
    this.updateActivityTime();
    return true;
  }

  removeSymbol(symbol: Symbol): boolean {
    const removed = this.symbolsOwned.delete(symbol);
    if (removed) {
      this.updateActivityTime();
    }
    return removed;
  }

  hasSymbol(symbol: Symbol): boolean {
    return this.symbolsOwned.has(symbol);
  }

  getSymbolCount(): number {
    return this.symbolsOwned.size;
  }

  getSymbolList(): Symbol[] {
    return Array.from(this.symbolsOwned);
  }

  /**
   * Health monitoring
   */
  recordHeartbeat(): void {
    this.healthMetrics.lastHeartbeat = new Date();
    this.updateActivityTime();
  }

  updateMetrics(metrics: Partial<WorkerHealthMetrics>): void {
    this.healthMetrics = { ...this.healthMetrics, ...metrics };
    this.updateActivityTime();
  }

  isHealthy(): boolean {
    const now = new Date();
    const timeSinceHeartbeat = now.getTime() - this.healthMetrics.lastHeartbeat.getTime();
    const healthy = timeSinceHeartbeat < 30000; // 30 seconds

    // Auto-transition to error status if unhealthy
    if (!healthy && this._status === 'ready') {
      this.setStatus('error');
    }

    return healthy;
  }

  getLoadFactor(): number {
    // Higher number = more loaded
    const connectionWeight = 0.3;
    const queueWeight = 0.4;
    const symbolWeight = 0.3;

    const normalizedConnections = this.healthMetrics.activeConnections / 50; // Max expected connections
    const normalizedQueue = this.healthMetrics.messageQueueSize / 100; // Max expected queue size
    const normalizedSymbols = this.symbolsOwned.size / this.getMaxSymbolsPerWorker();

    return (connectionWeight * normalizedConnections) +
           (queueWeight * normalizedQueue) +
           (symbolWeight * normalizedSymbols);
  }

  /**
   * Capacity management
   */
  private getMaxSymbolsPerWorker(): number {
    // Adjust based on worker performance
    const baseCapacity = 100;
    const cpuFactor = Math.max(0, 1 - (this.healthMetrics.cpuUsage / 100));
    const memoryFactor = Math.max(0, 1 - (this.healthMetrics.memoryUsage / 1024 / 1024 / 512)); // 512MB threshold

    return Math.floor(baseCapacity * cpuFactor * memoryFactor);
  }

  private updateActivityTime(): void {
    this.lastActivityAt = new Date();
  }
}

/**
 * Domain types
 */

export type WorkerId = string;
export type Symbol = string;

export type WorkerType = 'footprint_processor' | 'analytics_collector' | 'market_data_publisher';

export type WorkerStatus = 'initializing' | 'ready' | 'busy' | 'error' | 'shutdown';

export interface WorkerHealthMetrics {
  lastHeartbeat: Date;
  activeConnections: number;
  messageQueueSize: number;
  symbolsProcessedThisMinute: number;
  averageProcessingTime: number;
  memoryUsage: number; // bytes
  cpuUsage: number; // percentage
}
