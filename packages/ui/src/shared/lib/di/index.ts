/**
 * UI Dependency Injection Module - Single Entry Point
 *
 * This is the main entry point for all UI DI-related imports.
 * Supports platform switching between Cloud (HTTP) and Desktop (IPC).
 *
 */

// ============================================================================
// Core Types and Factory
// ============================================================================
export {
  UI_CORE_TYPES,
  UIContainerFactory,
  createUIContainer,
  getUIContainer,
} from './core';

export type { UIPlatformType, UIContainerConfig } from './core';

// ============================================================================
// Feature Module Types and Bindings
// ============================================================================
export {
  UI_TYPES,
  WORKER_UI_TYPES,
  EXCHANGE_UI_TYPES,
  SYMBOL_UI_TYPES,
  DATA_QUALITY_UI_TYPES,
  configureWorkerUIBindings,
  configureExchangeUIBindings,
  configureSymbolUIBindings,
  configureDataQualityUIBindings,
} from './modules';

export type {
  WorkerUITypes,
  ExchangeUITypes,
  SymbolUITypes,
  DataQualityUITypes,
} from './modules';

// ============================================================================
// React Provider and Hooks
// ============================================================================
export {
  UIContainerProvider,
  useUIContainer,
  usePlatform,
  useIsDesktop,
  useIsCloud,
} from './UIContainerProvider';

// ============================================================================
// Container Instance
// NOTE: Import this when you need the DI container.
// ============================================================================
import { UIContainerFactory } from './core';

/**
 * Singleton UI container instance
 * Auto-detects platform (cloud/desktop) on first access
 */
export const uiContainer = UIContainerFactory.getContainer();
