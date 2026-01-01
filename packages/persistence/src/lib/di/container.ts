/**
 * Container Factory - Creates and configures DI containers
 */

import { Container } from 'inversify';
import 'reflect-metadata';

import type { PersistenceBootstrapConfig } from '../../bootstrap.js';
import { StorageConfigValidator } from '../validation/StorageConfigValidator.js';

// Feature DI modules
import { registerCandlePersistenceBindings } from '../../features/candlePersistence/di/module.js';
import { registerStatePersistenceBindings } from '../../features/statePersistence/di/module.js';

// Application DI module
import { registerApplicationBindings } from '../../application/di/module.js';

// Infrastructure DI modules
import { registerLoggerBindings } from '../../infrastructure/logger/di/module.js';
import { registerIPCBindings } from '../../infrastructure/ipc/di/module.js';
import { registerHealthBindings } from '../../infrastructure/health/di/module.js';

// =============================================================================
// Container Factory
// =============================================================================

export class ContainerFactory {
  private static instance: Container | null = null;
  private static currentConfig: PersistenceBootstrapConfig | null = null;

  /**
   * Create a fully configured DI container.
   * Validates config, creates container, and registers all bindings.
   */
  static create(config: PersistenceBootstrapConfig): Container {
    if (this.instance && this.isSameConfig(config)) {
      return this.instance;
    }

    // Validate storage config
    const validationResult = StorageConfigValidator.validate(config);
    if (!validationResult.valid) {
      const errors = validationResult.errors
        .map((e) => `${e.field}: ${e.message}`)
        .join('; ');
      throw new Error(`Invalid storage configuration: ${errors}`);
    }

    const container = new Container();

    // Register bindings in correct order
    registerLoggerBindings(container);
    registerCandlePersistenceBindings(
      container,
      validationResult.normalizedConfig!
    );
    registerStatePersistenceBindings(container);
    registerIPCBindings(container, {
      socketPath: config.socketPath,
      runtimeDbPath: config.runtimeDbPath,
      pollInterval: config.pollInterval,
      batchSize: config.batchSize,
    });
    registerHealthBindings(container, config);
    registerApplicationBindings(container);

    this.instance = container;
    this.currentConfig = config;

    return container;
  }

  private static isSameConfig(config: PersistenceBootstrapConfig): boolean {
    if (!this.currentConfig) return false;
    return (
      this.currentConfig.socketPath === config.socketPath &&
      this.currentConfig.runtimeDbPath === config.runtimeDbPath &&
      this.currentConfig.storage.baseDir === config.storage.baseDir
    );
  }
}
