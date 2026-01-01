/**
 * Data Quality UI DI Bindings
 *
 * Configures dependency injection bindings for the dataQuality UI feature.
 * Binds HTTP adapter for Cloud and IPC adapter for Desktop.
 *
 */

import { Container } from 'inversify';
import { DATA_QUALITY_UI_TYPES } from './types';
import { UIPlatformType } from '../../core/types';
import { HttpDataQualityAdapter } from '../../../../../features/dataQuality/infrastructure/adapters/http';
import { IpcDataQualityAdapter } from '../../../../../features/dataQuality/infrastructure/adapters/ipc';

/**
 * Configure Data Quality UI bindings
 *
 * @param container - InversifyJS container
 * @param platform - Platform type for adapter selection
 */
export function configureDataQualityUIBindings(
  container: Container,
  platform: UIPlatformType
): void {
  // Unbind if already bound (for rebinding scenarios)
  if (container.isBound(DATA_QUALITY_UI_TYPES.DataQualityApiPort)) {
    container.unbind(DATA_QUALITY_UI_TYPES.DataQualityApiPort);
  }

  // Bind appropriate adapter based on platform
  if (platform === 'cloud') {
    container
      .bind(DATA_QUALITY_UI_TYPES.DataQualityApiPort)
      .to(HttpDataQualityAdapter)
      .inSingletonScope();
  } else {
    container
      .bind(DATA_QUALITY_UI_TYPES.DataQualityApiPort)
      .to(IpcDataQualityAdapter)
      .inSingletonScope();
  }
}
