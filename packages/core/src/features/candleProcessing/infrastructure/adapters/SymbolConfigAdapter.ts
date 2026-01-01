/**
 * Unified SymbolConfig Adapter
 *
 * Single implementation of SymbolConfigPort for all contexts (main thread, worker thread).
 * Uses in-memory Map storage for fast access. Context is injected for logging purposes.
 *
 * Replaces WorkerSymbolConfig to eliminate naming confusion and provide unified implementation.
 *
 */

import { injectable, inject } from 'inversify';
import { SymbolConfigPort } from '../../application/ports/out/SymbolConfigPort.js';
import { SymbolConfig as SymbolConfigType } from '../../domain/types/index.js';
import { createLogger } from '../../../../shared/lib/logger/logger.js';

/**
 * Unified SymbolConfig
 * Implements SymbolConfigPort for all contexts
 * Uses in-memory Map for fast access
 */
@injectable()
export class SymbolConfigAdapter implements SymbolConfigPort {
  private configs: Map<string, SymbolConfigType> = new Map();
  private logger;

  constructor(@inject('SYMBOL_CONFIG_CONTEXT') context: string) {
    this.logger = createLogger(`${context}SymbolConfig`);
  }

  /**
   * Get configuration for a symbol
   */
  async getConfig(symbol: string): Promise<SymbolConfigType | null> {
    const config = this.configs.get(symbol);

    if (config) {
      this.logger.debug('Retrieved symbol config', {
        symbol,
        exchange: config.exchange,
      });
    }

    return config || null;
  }

  /**
   * Set configuration for a symbol
   */
  async setConfig(symbol: string, config: SymbolConfigType): Promise<void> {
    this.configs.set(symbol, config);

    this.logger.debug('Set symbol config', {
      symbol,
      exchange: config.exchange,
      tickValue: config.tickValue,
    });
  }

  /**
   * Check if a symbol has configuration
   */
  async hasConfig(symbol: string): Promise<boolean> {
    return this.configs.has(symbol);
  }

  /**
   * Delete configuration for a symbol
   */
  async deleteConfig(symbol: string): Promise<void> {
    const deleted = this.configs.delete(symbol);

    if (deleted) {
      this.logger.info('Deleted symbol config', { symbol });
    } else {
      this.logger.debug('No symbol config to delete', { symbol });
    }
  }

  /**
   * Get all configured symbols
   * Utility method for status reporting
   */
  getAllSymbols(): string[] {
    return Array.from(this.configs.keys());
  }

  /**
   * Get total number of configured symbols
   * Utility method for status reporting
   */
  getSymbolCount(): number {
    return this.configs.size;
  }

  /**
   * Clear all configurations
   * Utility method for shutdown/reset
   */
  clear(): void {
    const count = this.configs.size;
    this.configs.clear();
    this.logger.info('Cleared all symbol configs', { count });
  }
}
