/**
 * ConfigSyncNotifierAdapter - Infrastructure adapter for config sync notifications
 *
 * Implements ConfigSyncNotifierPort to notify about config changes.
 * Sets pending config in CandleStorage - will be applied when 1d candle completes.
 * Also updates TradeIngestionService cache for new trades.
 *
 * Hexagonal Architecture:
 * - Implements Port Out (ConfigSyncNotifierPort)
 * - Located in infrastructure/adapters/ (correct location for Port Out impl)
 */

import { injectable, inject, optional } from 'inversify';
import {
  ConfigSyncNotifierPort,
  ConfigUpdateMessage,
  ConfigFullReloadMessage,
} from '../../application/ports/out/ConfigSyncNotifierPort.js';
import { TradeIngestionPort } from '../../../marketData/application/ports/in/TradeIngestionPort.js';
import { MARKET_DATA_TYPES } from '../../../../shared/lib/di/bindings/features/marketData/types.js';
import { createLogger } from '../../../../shared/lib/logger/logger.js';

const logger = createLogger('ConfigSyncNotifierAdapter');

/**
 * ConfigSyncNotifierAdapter
 *
 * Infrastructure adapter that implements ConfigSyncNotifierPort.
 * Notifies about config changes and updates TradeIngestionService cache.
 */
@injectable()
export class ConfigSyncNotifierAdapter implements ConfigSyncNotifierPort {
  constructor(
    @inject(MARKET_DATA_TYPES.TradeIngestionPort)
    @optional()
    private tradeIngestionPort?: TradeIngestionPort
  ) {}

  /**
   * Notify about config update for specific symbols
   * Updates TradeIngestionService cache so new trades use new config
   * Pending config will be applied to CandleGroup when 1d candle completes
   *
   * @param symbols - List of symbols that have updated config
   */
  async notifyConfigUpdate(symbols: string[]): Promise<void> {
    if (symbols.length === 0) {
      logger.debug('No symbols to notify, skipping');
      return;
    }

    const message: ConfigUpdateMessage = {
      type: 'CONFIG_UPDATE',
      payload: {
        symbols,
        timestamp: Date.now(),
      },
    };

    logger.info('Config update notification', {
      symbolCount: symbols.length,
      symbols: symbols.slice(0, 10),
      timestamp: message.payload.timestamp,
    });

    // Reload cached config in TradeIngestionService
    // This ensures new trades are routed with new config
    // But CandleGroup will only use new config after 1d complete
    if (this.tradeIngestionPort) {
      try {
        await this.tradeIngestionPort.reloadSymbolConfigs(symbols);
        logger.info(
          `Reloaded TradeIngestionService cache for ${symbols.length} symbols (pending until 1d complete)`
        );
      } catch (error) {
        logger.warn('Failed to reload config cache (non-fatal)', error);
      }
    }
  }

  /**
   * Notify all workers to reload all symbol configs
   */
  async notifyFullReload(): Promise<void> {
    const message: ConfigFullReloadMessage = {
      type: 'CONFIG_FULL_RELOAD',
      payload: {
        timestamp: Date.now(),
      },
    };

    logger.info('Full config reload notification', {
      timestamp: message.payload.timestamp,
    });
  }
}
