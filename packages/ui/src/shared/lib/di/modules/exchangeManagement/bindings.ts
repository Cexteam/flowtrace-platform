/**
 * Exchange Management UI DI Bindings
 *
 * Configures dependency injection bindings for the exchangeManagement UI feature.
 * Binds HTTP adapter for Cloud and IPC adapter for Desktop.
 *
 */

import { Container } from 'inversify';
import { EXCHANGE_UI_TYPES } from './types';
import { UIPlatformType } from '../../core/types';
import { HttpExchangeAdapter } from '../../../../../features/exchangeManagement/infrastructure/adapters/http';
import { IpcExchangeAdapter } from '../../../../../features/exchangeManagement/infrastructure/adapters/ipc';

/**
 * Configure Exchange Management UI bindings
 *
 * @param container - InversifyJS container
 * @param platform - Platform type for adapter selection
 */
export function configureExchangeUIBindings(
  container: Container,
  platform: UIPlatformType
): void {
  // Unbind if already bound (for rebinding scenarios)
  if (container.isBound(EXCHANGE_UI_TYPES.ExchangeApiPort)) {
    container.unbind(EXCHANGE_UI_TYPES.ExchangeApiPort);
  }

  // Bind appropriate adapter based on platform
  if (platform === 'cloud') {
    container
      .bind(EXCHANGE_UI_TYPES.ExchangeApiPort)
      .to(HttpExchangeAdapter)
      .inSingletonScope();
  } else {
    container
      .bind(EXCHANGE_UI_TYPES.ExchangeApiPort)
      .to(IpcExchangeAdapter)
      .inSingletonScope();
  }
}
