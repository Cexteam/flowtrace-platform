/**
 * Storage Configuration Validator
 * Validates storage configuration options for the persistence service.
 * Ensures configuration is valid before initializing storage adapters.
 */

import type { PersistenceBootstrapConfig } from '../../bootstrap.js';

/**
 * Storage configuration validation result
 */
export interface StorageConfigValidationResult {
  /** Whether the configuration is valid */
  valid: boolean;

  /** Validation errors (if any) */
  errors: StorageConfigError[];

  /** Validation warnings (if any) */
  warnings: StorageConfigWarning[];

  /** Normalized configuration with defaults applied */
  normalizedConfig?: NormalizedStorageConfig;
}

/**
 * Storage configuration error
 */
export interface StorageConfigError {
  /** Error code for programmatic handling */
  code: string;

  /** Human-readable error message */
  message: string;

  /** Configuration field that caused the error */
  field: string;

  /** Invalid value that was provided */
  value?: unknown;
}

/**
 * Storage configuration warning
 */
export interface StorageConfigWarning {
  /** Warning code for programmatic handling */
  code: string;

  /** Human-readable warning message */
  message: string;

  /** Configuration field that triggered the warning */
  field: string;

  /** Suggested value or action */
  suggestion?: string;
}

/**
 * Normalized storage configuration with all defaults applied
 */
export interface NormalizedStorageConfig {
  /** Base directory for storage files */
  baseDir: string;

  /** Use database storage (true) or file storage (false) */
  useDatabase: boolean;

  /** Organize databases by exchange */
  organizeByExchange: boolean;

  /** Maximum candles per block/batch operation */
  maxCandlesPerBlock: number;

  /** Enable WAL mode (only for database mode) */
  walMode: boolean;

  /** Cache size in KB */
  cacheSize: number;

  /** Memory-mapped I/O size in bytes */
  mmapSize: number;
}

/**
 * Default storage configuration values
 */
export const DEFAULT_STORAGE_CONFIG: Omit<NormalizedStorageConfig, 'baseDir'> =
  {
    useDatabase: true,
    organizeByExchange: false,
    maxCandlesPerBlock: 1000,
    walMode: true,
    cacheSize: 65536, // 64MB
    mmapSize: 268435456, // 256MB
  };

/**
 * Storage configuration constraints
 */
export const STORAGE_CONFIG_CONSTRAINTS = {
  /** Minimum cache size in KB (1MB) */
  MIN_CACHE_SIZE: 1024,

  /** Maximum cache size in KB (1GB) */
  MAX_CACHE_SIZE: 1048576,

  /** Minimum mmap size in bytes (1MB) */
  MIN_MMAP_SIZE: 1048576,

  /** Maximum mmap size in bytes (4GB) */
  MAX_MMAP_SIZE: 4294967296,

  /** Minimum candles per block */
  MIN_CANDLES_PER_BLOCK: 1,

  /** Maximum candles per block */
  MAX_CANDLES_PER_BLOCK: 10000,

  /** Recommended cache size for large deployments (128MB) */
  RECOMMENDED_CACHE_SIZE_LARGE: 131072,

  /** Recommended mmap size for large deployments (512MB) */
  RECOMMENDED_MMAP_SIZE_LARGE: 536870912,
};

/**
 * Storage Configuration Validator
 * Validates and normalizes storage configuration for the persistence service.
 */
export class StorageConfigValidator {
  /**
   * Validate storage configuration
   *
   * @param config - Bootstrap configuration to validate
   * @returns Validation result with errors, warnings, and normalized config
   */
  static validate(
    config: PersistenceBootstrapConfig
  ): StorageConfigValidationResult {
    const errors: StorageConfigError[] = [];
    const warnings: StorageConfigWarning[] = [];

    // Validate required fields
    if (!config.storage) {
      errors.push({
        code: 'MISSING_STORAGE_CONFIG',
        message: 'Storage configuration is required',
        field: 'storage',
      });
      return { valid: false, errors, warnings };
    }

    if (!config.storage.baseDir) {
      errors.push({
        code: 'MISSING_BASE_DIR',
        message: 'Storage base directory is required',
        field: 'storage.baseDir',
      });
    }

    if (config.storage.baseDir && typeof config.storage.baseDir !== 'string') {
      errors.push({
        code: 'INVALID_BASE_DIR_TYPE',
        message: 'Storage base directory must be a string',
        field: 'storage.baseDir',
        value: config.storage.baseDir,
      });
    }

    // Validate cache size
    if (config.storage.cacheSize !== undefined) {
      if (typeof config.storage.cacheSize !== 'number') {
        errors.push({
          code: 'INVALID_CACHE_SIZE_TYPE',
          message: 'Cache size must be a number',
          field: 'storage.cacheSize',
          value: config.storage.cacheSize,
        });
      } else if (
        config.storage.cacheSize < STORAGE_CONFIG_CONSTRAINTS.MIN_CACHE_SIZE
      ) {
        errors.push({
          code: 'CACHE_SIZE_TOO_SMALL',
          message: `Cache size must be at least ${STORAGE_CONFIG_CONSTRAINTS.MIN_CACHE_SIZE} KB (1MB)`,
          field: 'storage.cacheSize',
          value: config.storage.cacheSize,
        });
      } else if (
        config.storage.cacheSize > STORAGE_CONFIG_CONSTRAINTS.MAX_CACHE_SIZE
      ) {
        errors.push({
          code: 'CACHE_SIZE_TOO_LARGE',
          message: `Cache size must not exceed ${STORAGE_CONFIG_CONSTRAINTS.MAX_CACHE_SIZE} KB (1GB)`,
          field: 'storage.cacheSize',
          value: config.storage.cacheSize,
        });
      }
    }

    // Validate mmap size
    if (config.storage.mmapSize !== undefined) {
      if (typeof config.storage.mmapSize !== 'number') {
        errors.push({
          code: 'INVALID_MMAP_SIZE_TYPE',
          message: 'Memory-mapped I/O size must be a number',
          field: 'storage.mmapSize',
          value: config.storage.mmapSize,
        });
      } else if (
        config.storage.mmapSize < STORAGE_CONFIG_CONSTRAINTS.MIN_MMAP_SIZE
      ) {
        errors.push({
          code: 'MMAP_SIZE_TOO_SMALL',
          message: `Memory-mapped I/O size must be at least ${STORAGE_CONFIG_CONSTRAINTS.MIN_MMAP_SIZE} bytes (1MB)`,
          field: 'storage.mmapSize',
          value: config.storage.mmapSize,
        });
      } else if (
        config.storage.mmapSize > STORAGE_CONFIG_CONSTRAINTS.MAX_MMAP_SIZE
      ) {
        errors.push({
          code: 'MMAP_SIZE_TOO_LARGE',
          message: `Memory-mapped I/O size must not exceed ${STORAGE_CONFIG_CONSTRAINTS.MAX_MMAP_SIZE} bytes (4GB)`,
          field: 'storage.mmapSize',
          value: config.storage.mmapSize,
        });
      }
    }

    // Validate maxCandlesPerBlock
    if (config.storage.maxCandlesPerBlock !== undefined) {
      if (typeof config.storage.maxCandlesPerBlock !== 'number') {
        errors.push({
          code: 'INVALID_MAX_CANDLES_TYPE',
          message: 'Max candles per block must be a number',
          field: 'storage.maxCandlesPerBlock',
          value: config.storage.maxCandlesPerBlock,
        });
      } else if (
        config.storage.maxCandlesPerBlock <
        STORAGE_CONFIG_CONSTRAINTS.MIN_CANDLES_PER_BLOCK
      ) {
        errors.push({
          code: 'MAX_CANDLES_TOO_SMALL',
          message: `Max candles per block must be at least ${STORAGE_CONFIG_CONSTRAINTS.MIN_CANDLES_PER_BLOCK}`,
          field: 'storage.maxCandlesPerBlock',
          value: config.storage.maxCandlesPerBlock,
        });
      } else if (
        config.storage.maxCandlesPerBlock >
        STORAGE_CONFIG_CONSTRAINTS.MAX_CANDLES_PER_BLOCK
      ) {
        errors.push({
          code: 'MAX_CANDLES_TOO_LARGE',
          message: `Max candles per block must not exceed ${STORAGE_CONFIG_CONSTRAINTS.MAX_CANDLES_PER_BLOCK}`,
          field: 'storage.maxCandlesPerBlock',
          value: config.storage.maxCandlesPerBlock,
        });
      }
    }

    // Validate boolean fields
    if (
      config.storage.useDatabase !== undefined &&
      typeof config.storage.useDatabase !== 'boolean'
    ) {
      errors.push({
        code: 'INVALID_USE_DATABASE_TYPE',
        message: 'useDatabase must be a boolean',
        field: 'storage.useDatabase',
        value: config.storage.useDatabase,
      });
    }

    if (
      config.storage.organizeByExchange !== undefined &&
      typeof config.storage.organizeByExchange !== 'boolean'
    ) {
      errors.push({
        code: 'INVALID_ORGANIZE_BY_EXCHANGE_TYPE',
        message: 'organizeByExchange must be a boolean',
        field: 'storage.organizeByExchange',
        value: config.storage.organizeByExchange,
      });
    }

    if (
      config.storage.walMode !== undefined &&
      typeof config.storage.walMode !== 'boolean'
    ) {
      errors.push({
        code: 'INVALID_WAL_MODE_TYPE',
        message: 'walMode must be a boolean',
        field: 'storage.walMode',
        value: config.storage.walMode,
      });
    }

    // Generate warnings for suboptimal configurations
    this.generateWarnings(config, warnings);

    // If there are errors, return early
    if (errors.length > 0) {
      return { valid: false, errors, warnings };
    }

    // Create normalized configuration
    const normalizedConfig: NormalizedStorageConfig = {
      baseDir: config.storage.baseDir,
      useDatabase:
        config.storage.useDatabase ?? DEFAULT_STORAGE_CONFIG.useDatabase,
      organizeByExchange:
        config.storage.organizeByExchange ??
        DEFAULT_STORAGE_CONFIG.organizeByExchange,
      maxCandlesPerBlock:
        config.storage.maxCandlesPerBlock ??
        DEFAULT_STORAGE_CONFIG.maxCandlesPerBlock,
      walMode: config.storage.walMode ?? DEFAULT_STORAGE_CONFIG.walMode,
      cacheSize: config.storage.cacheSize ?? DEFAULT_STORAGE_CONFIG.cacheSize,
      mmapSize: config.storage.mmapSize ?? DEFAULT_STORAGE_CONFIG.mmapSize,
    };

    return { valid: true, errors, warnings, normalizedConfig };
  }

  /**
   * Generate warnings for suboptimal configurations
   */
  private static generateWarnings(
    config: PersistenceBootstrapConfig,
    warnings: StorageConfigWarning[]
  ): void {
    // Warn if using file storage (legacy mode)
    if (config.storage.useDatabase === false) {
      warnings.push({
        code: 'LEGACY_FILE_STORAGE',
        message:
          'File-based storage is legacy mode. Consider using database storage for better performance.',
        field: 'storage.useDatabase',
        suggestion:
          'Set useDatabase to true for improved performance and scalability',
      });
    }

    // Warn if WAL mode is disabled
    if (
      config.storage.walMode === false &&
      config.storage.useDatabase !== false
    ) {
      warnings.push({
        code: 'WAL_MODE_DISABLED',
        message:
          'WAL mode is disabled. This may reduce concurrent read performance.',
        field: 'storage.walMode',
        suggestion: 'Enable WAL mode for better concurrent access performance',
      });
    }

    // Warn if organizeByExchange is enabled but useDatabase is false
    if (
      config.storage.organizeByExchange === true &&
      config.storage.useDatabase === false
    ) {
      warnings.push({
        code: 'ORGANIZE_BY_EXCHANGE_FILE_MODE',
        message: 'organizeByExchange has no effect in file storage mode',
        field: 'storage.organizeByExchange',
        suggestion:
          'Enable database storage to use exchange-based partitioning',
      });
    }

    // Warn if cache size is small for database mode
    if (
      config.storage.useDatabase !== false &&
      config.storage.cacheSize !== undefined &&
      config.storage.cacheSize < DEFAULT_STORAGE_CONFIG.cacheSize
    ) {
      warnings.push({
        code: 'SMALL_CACHE_SIZE',
        message: `Cache size (${config.storage.cacheSize} KB) is smaller than recommended (${DEFAULT_STORAGE_CONFIG.cacheSize} KB)`,
        field: 'storage.cacheSize',
        suggestion: `Consider increasing cache size to at least ${DEFAULT_STORAGE_CONFIG.cacheSize} KB for better performance`,
      });
    }
  }

  /**
   * Validate and throw if configuration is invalid
   *
   * @param config - Bootstrap configuration to validate
   * @throws Error if configuration is invalid
   */
  static validateOrThrow(
    config: PersistenceBootstrapConfig
  ): NormalizedStorageConfig {
    const result = this.validate(config);

    if (!result.valid) {
      const errorMessages = result.errors
        .map((e) => `${e.field}: ${e.message}`)
        .join('; ');
      throw new Error(`Invalid storage configuration: ${errorMessages}`);
    }

    // Log warnings
    if (result.warnings.length > 0) {
      for (const warning of result.warnings) {
        console.warn(
          `[StorageConfig Warning] ${warning.field}: ${warning.message}${
            warning.suggestion ? ` - ${warning.suggestion}` : ''
          }`
        );
      }
    }

    return result.normalizedConfig!;
  }

  /**
   * Check if database storage mode is enabled
   */
  static isDatabaseMode(config: PersistenceBootstrapConfig): boolean {
    return config.storage?.useDatabase ?? DEFAULT_STORAGE_CONFIG.useDatabase;
  }

  /**
   * Check if exchange-based partitioning is enabled
   */
  static isExchangePartitioned(config: PersistenceBootstrapConfig): boolean {
    return (
      this.isDatabaseMode(config) &&
      (config.storage?.organizeByExchange ??
        DEFAULT_STORAGE_CONFIG.organizeByExchange)
    );
  }

  /**
   * Get recommended configuration for deployment size
   *
   * @param symbolCount - Expected number of symbols
   * @param exchangeCount - Expected number of exchanges
   * @returns Recommended storage configuration
   */
  static getRecommendedConfig(
    symbolCount: number,
    exchangeCount: number
  ): Partial<NormalizedStorageConfig> {
    const isLargeDeployment = symbolCount >= 100 || exchangeCount > 1;

    return {
      useDatabase: true,
      organizeByExchange: exchangeCount > 1,
      walMode: true,
      cacheSize: isLargeDeployment
        ? STORAGE_CONFIG_CONSTRAINTS.RECOMMENDED_CACHE_SIZE_LARGE
        : DEFAULT_STORAGE_CONFIG.cacheSize,
      mmapSize: isLargeDeployment
        ? STORAGE_CONFIG_CONSTRAINTS.RECOMMENDED_MMAP_SIZE_LARGE
        : DEFAULT_STORAGE_CONFIG.mmapSize,
      maxCandlesPerBlock: isLargeDeployment ? 2000 : 1000,
    };
  }
}
