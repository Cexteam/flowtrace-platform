/**
 * Worker Management UI DI Bindings
 *
 * Configures dependency injection bindings for the workerManagement UI feature.
 * Binds HTTP adapter for Cloud and IPC adapter for Desktop.
 *
 */

import { Container } from 'inversify';
import { WORKER_UI_TYPES } from './types';
import { UIPlatformType } from '../../core/types';
import { HttpWorkerAdapter } from '../../../../../features/workerManagement/infrastructure/adapters/http';
import { IpcWorkerAdapter } from '../../../../../features/workerManagement/infrastructure/adapters/ipc';

/**
 * Configure Worker Management UI bindings
 *
 * @param container - InversifyJS container
 * @param platform - Platform type for adapter selection
 */
export function configureWorkerUIBindings(
  container: Container,
  platform: UIPlatformType
): void {
  // Unbind if already bound (for rebinding scenarios)
  if (container.isBound(WORKER_UI_TYPES.WorkerApiPort)) {
    container.unbind(WORKER_UI_TYPES.WorkerApiPort);
  }

  // Bind appropriate adapter based on platform
  if (platform === 'cloud') {
    container
      .bind(WORKER_UI_TYPES.WorkerApiPort)
      .to(HttpWorkerAdapter)
      .inSingletonScope();
  } else {
    container
      .bind(WORKER_UI_TYPES.WorkerApiPort)
      .to(IpcWorkerAdapter)
      .inSingletonScope();
  }
}
