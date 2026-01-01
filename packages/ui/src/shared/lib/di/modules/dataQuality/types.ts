/**
 * Data Quality UI DI Types
 *
 * Defines dependency injection symbols for the dataQuality UI feature.
 * Following Hexagonal Architecture pattern with ports and adapters.
 *
 */

export const DATA_QUALITY_UI_TYPES = {
  // Port Out - API adapters
  DataQualityApiPort: Symbol.for('DataQualityUI.DataQualityApiPort'),

  // Port In - Operations
  DataQualityOperationsPort: Symbol.for(
    'DataQualityUI.DataQualityOperationsPort'
  ),

  // Adapters
  HttpDataQualityAdapter: Symbol.for('DataQualityUI.HttpDataQualityAdapter'),
  IpcDataQualityAdapter: Symbol.for('DataQualityUI.IpcDataQualityAdapter'),
} as const;

export type DataQualityUITypes = typeof DATA_QUALITY_UI_TYPES;
