/**
 * Core DI Types - Shared type definitions for runtime context and DI
 *
 * Defines types for distinguishing between main thread and worker thread
 * execution contexts, enabling runtime-specific DI container configuration.
 *
 */

// ============================================================================
// Runtime Types
// ============================================================================

/**
 * Runtime execution context type
 * - 'main': Main thread (app.ts entry point)
 * - 'worker': Worker thread (worker.ts entry point)
 */
export type RuntimeType = 'main' | 'worker';

/**
 * Configuration options for DI container creation
 */
export interface ContainerConfig {
  /** Runtime context for adapter binding */
  runtime: RuntimeType;

  /** Enable debug logging for DI resolution */
  debug?: boolean;

  /** Feature modules to load (defaults to all) */
  features?: string[];
}

// ============================================================================
// Core DI Tokens - Infrastructure Services
// ============================================================================

// Import cron types
import { CRON_TYPES } from '../bindings/core/cron/index.js';

/**
 * Core infrastructure DI tokens
 * These are foundational services used across all features
 */
export const CORE_TYPES = {
  /** Logger service for application-wide logging */
  Logger: Symbol.for('Core.Logger'),

  /** Database connection service */
  Database: Symbol.for('Core.Database'),

  /** Cache adapter service (in-memory for all deployments) */
  Cache: Symbol.for('Core.Cache'),

  /** Application lifecycle orchestrator (main thread only) */
  FlowTraceApplication: Symbol.for('Core.FlowTraceApplication'),

  /** Cron scheduler service - shared task scheduling infrastructure */
  ...CRON_TYPES,
} as const;

// ============================================================================
// Feature-Specific Types - Import directly from types files (no side effects)
// ============================================================================
import { MARKET_DATA_TYPES } from '../bindings/features/marketData/types.js';
import { SYMBOL_MANAGEMENT_TYPES } from '../bindings/features/symbolManagement/types.js';
import { CANDLE_PROCESSING_TYPES } from '../bindings/features/candleProcessing/types.js';
import { WORKER_MANAGEMENT_TYPES } from '../bindings/features/workerManagement/types.js';
import { EXCHANGE_MANAGEMENT_TYPES } from '../bindings/features/exchangeManagement/types.js';
import { DATABASE_SYMBOLS } from '../bindings/core/database/types.js';

// Re-export for direct access
export { MARKET_DATA_TYPES } from '../bindings/features/marketData/types.js';
export { SYMBOL_MANAGEMENT_TYPES } from '../bindings/features/symbolManagement/types.js';
export { CANDLE_PROCESSING_TYPES } from '../bindings/features/candleProcessing/types.js';
export { WORKER_MANAGEMENT_TYPES } from '../bindings/features/workerManagement/types.js';
export { EXCHANGE_MANAGEMENT_TYPES } from '../bindings/features/exchangeManagement/types.js';
export { DATABASE_SYMBOLS } from '../bindings/core/database/types.js';
export { CRON_TYPES } from '../bindings/core/cron/index.js';

// ============================================================================
// Unified TYPES - Centralized registry for all DI symbols
// ============================================================================

export const TYPES = {
  // Core infrastructure types (delegated to CORE_TYPES)
  ...CORE_TYPES,

  // Market data types (delegated to MARKET_DATA_TYPES)
  ...MARKET_DATA_TYPES,

  // Symbol Management types (delegated to SYMBOL_MANAGEMENT_TYPES)
  ...SYMBOL_MANAGEMENT_TYPES,

  // Candle Processing types (delegated to CANDLE_PROCESSING_TYPES)
  ...CANDLE_PROCESSING_TYPES,

  // Worker Management types (delegated to WORKER_MANAGEMENT_TYPES)
  ...WORKER_MANAGEMENT_TYPES,

  // Exchange Management types (delegated to EXCHANGE_MANAGEMENT_TYPES)
  ...EXCHANGE_MANAGEMENT_TYPES,

  // Database infrastructure types (delegated to DATABASE_SYMBOLS)
  ...DATABASE_SYMBOLS,
} as const;
