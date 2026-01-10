/**
 * StatePersistenceServicePort - Port In for state persistence operations
 *
 * Defines what external actors can do with state persistence.
 * This is the inbound port that external actors use to interact with
 * the StatePersistenceService.
 *
 * Hexagonal Architecture: This is a DRIVING port (inbound)
 * - External actors call through this interface
 * - Application layer (StatePersistenceService) implements it
 */

/**
 * StatePersistenceServicePort - Port In interface
 *
 * Provides state persistence operations for CandleGroup states.
 * Used by worker threads to manage state persistence lifecycle.
 */
export interface StatePersistenceServicePort {
  /**
   * Load states for assigned symbols from persistence
   * Called during WORKER startup, BEFORE signaling ready to main thread
   *
   * @param assignedSymbols - Symbols assigned to this worker
   * @returns Map of symbol to lastTradeId for gap detection
   */
  loadStatesForSymbols(assignedSymbols: string[]): Promise<Map<string, number>>;

  /**
   * Start periodic flush timer
   * Flushes dirty states at configured interval (default: 30s)
   */
  startPeriodicFlush(): void;

  /**
   * Stop periodic flush timer
   */
  stopPeriodicFlush(): void;

  /**
   * Flush ALL dirty states immediately
   * Used for graceful shutdown
   */
  flushAll(): Promise<void>;

  /**
   * Check if periodic flush is running
   *
   * @returns true if periodic flush timer is active
   */
  isPeriodicFlushRunning(): boolean;

  /**
   * Get current configuration
   *
   * @returns Configuration object with flushIntervalMs and batchSize
   */
  getConfig(): { flushIntervalMs: number; batchSize: number };
}
