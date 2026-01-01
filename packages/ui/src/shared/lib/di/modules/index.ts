/**
 * UI DI Modules Index
 *
 * Exports all feature-specific DI modules for the UI package.
 * Each module follows the pattern: types.ts, bindings.ts, index.ts
 *
 */

// Import types for combining
import { WORKER_UI_TYPES } from './workerManagement/types';
import { EXCHANGE_UI_TYPES } from './exchangeManagement/types';
import { SYMBOL_UI_TYPES } from './symbolManagement/types';
import { DATA_QUALITY_UI_TYPES } from './dataQuality/types';

// Worker Management
export { WORKER_UI_TYPES, configureWorkerUIBindings } from './workerManagement';
export type { WorkerUITypes } from './workerManagement';

// Exchange Management
export {
  EXCHANGE_UI_TYPES,
  configureExchangeUIBindings,
} from './exchangeManagement';
export type { ExchangeUITypes } from './exchangeManagement';

// Symbol Management
export { SYMBOL_UI_TYPES, configureSymbolUIBindings } from './symbolManagement';
export type { SymbolUITypes } from './symbolManagement';

// Data Quality
export {
  DATA_QUALITY_UI_TYPES,
  configureDataQualityUIBindings,
} from './dataQuality';
export type { DataQualityUITypes } from './dataQuality';

// ============================================================================
// Combined Types Export
// ============================================================================

/**
 * All UI DI types combined
 */
export const UI_TYPES = {
  ...WORKER_UI_TYPES,
  ...EXCHANGE_UI_TYPES,
  ...SYMBOL_UI_TYPES,
  ...DATA_QUALITY_UI_TYPES,
} as const;
