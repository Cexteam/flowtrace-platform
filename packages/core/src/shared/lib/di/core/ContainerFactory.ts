/**
 * ContainerFactory - Creates DI containers for main and worker threads
 *
 * Static factory class that creates InversifyJS containers with bindings
 * configured for the specific runtime context (main or worker thread).
 */

import 'reflect-metadata';
import { Container } from 'inversify';

// Import namespace functions
import { MainThread } from '../contexts/main.js';
import { WorkerThread } from '../contexts/worker.js';

// Import core infrastructure binding functions
import { configureDatabaseBindings } from '../bindings/core/database/index.js';
import { configureLoggerBindings } from '../bindings/core/logger.js';
import { configureCacheBindings } from '../bindings/core/cache.js';
import { configureApplicationBindings } from '../bindings/core/application.js';
import { bindCoreCron } from '../bindings/core/cron/index.js';

// Import validation utilities
import {
  validateContainer,
  logContainerBindings,
  checkCircularDependencies,
} from './validation.js';

// Import types for validation
import { CORE_TYPES } from './types.js';

/**
 * ContainerFactory - Static factory for creating DI containers
 */
export class ContainerFactory {
  /**
   * Container cache - stores containers by runtime key
   */
  private static containerCache = new Map<string, Container>();

  /**
   * Create a main thread container with all features
   *
   * Configures:
   * - Core infrastructure (database, logger, cache, application)
   * - CandleProcessing, SymbolManagement, TradeRouter
   * - WorkerManagement, MarketData, ExchangeManagement
   *
   * @returns Configured container for main thread
   */
  static createMainThread(): Container {
    const cacheKey = 'main';

    // Return cached container if exists
    if (this.containerCache.has(cacheKey)) {
      return this.containerCache.get(cacheKey)!;
    }

    const container = new Container();

    // Configure core infrastructure
    this.configureCoreInfrastructure(container);

    // Configure main thread features
    MainThread.configureCandleProcessing(container);
    MainThread.configureSymbolManagement(container);
    MainThread.configureTradeRouter(container);
    MainThread.configureWorkerManagement(container);
    MainThread.configureMarketData(container);
    MainThread.configureExchangeManagement(container);

    // Validate core infrastructure bindings
    this.validateMainThreadContainer(container);

    // Log bindings in development mode
    if (process.env.NODE_ENV === 'development' && process.env.DEBUG_DI) {
      logContainerBindings(container);
    }

    // Check for circular dependencies in development mode
    if (process.env.NODE_ENV === 'development') {
      checkCircularDependencies(container, 'main');
    }

    // Cache the container
    this.containerCache.set(cacheKey, container);

    return container;
  }

  /**
   * Create a worker thread container with minimal features
   *
   * Configures:
   * - Core infrastructure (database, logger, cache)
   * - CandleProcessing (worker thread role)
   *
   * @returns Configured container for worker thread
   */
  static createWorkerThread(): Container {
    const cacheKey = 'worker';

    // Return cached container if exists
    if (this.containerCache.has(cacheKey)) {
      return this.containerCache.get(cacheKey)!;
    }

    const container = new Container();

    // Configure minimal infrastructure for workers
    this.configureCoreInfrastructure(container);

    // Configure worker thread features
    WorkerThread.configureCandleProcessing(container);

    // Validate worker thread bindings
    this.validateWorkerThreadContainer(container);

    // Log bindings in development mode
    if (process.env.NODE_ENV === 'development' && process.env.DEBUG_DI) {
      logContainerBindings(container);
    }

    // Check for circular dependencies in development mode
    if (process.env.NODE_ENV === 'development') {
      checkCircularDependencies(container, 'worker');
    }

    // Cache the container
    this.containerCache.set(cacheKey, container);

    return container;
  }

  /**
   * Auto-detect runtime and create appropriate container
   *
   * @returns Configured container
   */
  static create(): Container {
    const runtime = this.detectRuntime();

    if (runtime === 'main') {
      return this.createMainThread();
    } else {
      return this.createWorkerThread();
    }
  }

  /**
   * Clear container cache (for testing)
   */
  static clearCache(): void {
    this.containerCache.clear();
  }

  /**
   * Configure core infrastructure bindings
   */
  private static configureCoreInfrastructure(container: Container): void {
    configureDatabaseBindings(container);
    configureLoggerBindings(container);
    configureCacheBindings(container);
    bindCoreCron(container);
    configureApplicationBindings(container);
  }

  /**
   * Detect runtime context from environment
   */
  private static detectRuntime(): 'main' | 'worker' {
    return typeof process.env.WORKER_ID !== 'undefined' ? 'worker' : 'main';
  }

  /**
   * Validate main thread container has required bindings
   */
  private static validateMainThreadContainer(container: Container): void {
    // Core infrastructure that must be present in all main thread containers
    const requiredBindings = [
      CORE_TYPES.Logger,
      CORE_TYPES.FlowTraceApplication,
    ];

    validateContainer(container, requiredBindings, 'main');
  }

  /**
   * Validate worker thread container has required bindings
   */
  private static validateWorkerThreadContainer(container: Container): void {
    const requiredBindings = [CORE_TYPES.Logger];
    validateContainer(container, requiredBindings, 'worker');
  }
}

// Re-export types for convenience
export type { RuntimeType } from './types.js';
