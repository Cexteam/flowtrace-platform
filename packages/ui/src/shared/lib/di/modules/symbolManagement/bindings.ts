/**
 * Symbol Management UI DI Bindings
 *
 * Configures dependency injection bindings for the symbolManagement UI feature.
 * Binds HTTP adapter for Cloud and IPC adapter for Desktop.
 *
 */

import { Container } from 'inversify';
import { SYMBOL_UI_TYPES } from './types';
import { UIPlatformType } from '../../core/types';
import { HttpSymbolAdapter } from '../../../../../features/symbolManagement/infrastructure/adapters/http';
import { IpcSymbolAdapter } from '../../../../../features/symbolManagement/infrastructure/adapters/ipc';

/**
 * Configure Symbol Management UI bindings
 *
 * @param container - InversifyJS container
 * @param platform - Platform type for adapter selection
 */
export function configureSymbolUIBindings(
  container: Container,
  platform: UIPlatformType
): void {
  // Unbind if already bound (for rebinding scenarios)
  if (container.isBound(SYMBOL_UI_TYPES.SymbolApiPort)) {
    container.unbind(SYMBOL_UI_TYPES.SymbolApiPort);
  }

  // Bind appropriate adapter based on platform
  if (platform === 'cloud') {
    container
      .bind(SYMBOL_UI_TYPES.SymbolApiPort)
      .to(HttpSymbolAdapter)
      .inSingletonScope();
  } else {
    container
      .bind(SYMBOL_UI_TYPES.SymbolApiPort)
      .to(IpcSymbolAdapter)
      .inSingletonScope();
  }
}
