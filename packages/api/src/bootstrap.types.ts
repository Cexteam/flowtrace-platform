import type { INestApplicationContext } from '@nestjs/common';
import type { NestFastifyApplication } from '@nestjs/platform-fastify';
import type { Container } from 'inversify';
import type { CandleReaderPort, GapReaderPort } from '@flowtrace/persistence';

/**
 * Base options shared by all bootstrap modes
 */
export interface BaseBootstrapOptions {
  /**
   * Suppress console logs during initialization (useful for testing)
   * @default false
   */
  silent?: boolean;

  /**
   * CandleReaderPort instance for reading historical candle data.
   * If provided, FootprintModule will use this reader instead of creating one.
   * This allows desktop app to inject reader from persistence package.
   */
  candleReader?: CandleReaderPort | null;

  /**
   * GapReaderPort instance for reading gap records.
   * If provided, DataQualityModule will use this reader.
   * This allows desktop app to inject reader from persistence package.
   */
  gapReader?: GapReaderPort | null;
}

/**
 * Options for bootstrapping in server mode (with HTTP server)
 */
export interface ServerBootstrapOptions extends BaseBootstrapOptions {
  /**
   * Bootstrap mode - 'server' starts an HTTP server
   */
  mode: 'server';

  /**
   * Port number for the HTTP server
   * @default 3001
   */
  port?: number;

  /**
   * Host address to bind the server to
   * @default '0.0.0.0'
   */
  host?: string;

  /**
   * Enable Swagger/OpenAPI documentation
   * @default true
   */
  enableSwagger?: boolean;

  /**
   * Enable CORS (Cross-Origin Resource Sharing)
   * @default true
   */
  enableCors?: boolean;

  /**
   * CORS origin configuration
   * @default '*'
   */
  corsOrigin?: string | string[];
}

/**
 * Options for bootstrapping in context mode (without HTTP server)
 * Used for desktop applications and CLI tools
 */
export interface ContextBootstrapOptions extends BaseBootstrapOptions {
  /**
   * Bootstrap mode - 'context' creates an application context without HTTP server
   */
  mode: 'context';
}

/**
 * Discriminated union of all bootstrap options
 * TypeScript will enforce mode-specific options at compile time
 */
export type BootstrapOptions = ServerBootstrapOptions | ContextBootstrapOptions;

/**
 * Result from bootstrapping in server mode
 */
export interface ServerBootstrapResult {
  /**
   * Bootstrap mode - 'server'
   */
  mode: 'server';

  /**
   * NestJS Fastify application instance with HTTP server
   */
  app: NestFastifyApplication;

  /**
   * URL where the server is listening
   * Example: 'http://0.0.0.0:3001'
   */
  url: string;

  /**
   * Gracefully shut down the application and release resources
   */
  close: () => Promise<void>;
}

/**
 * Result from bootstrapping in context mode
 */
export interface ContextBootstrapResult {
  /**
   * Bootstrap mode - 'context'
   */
  mode: 'context';

  /**
   * NestJS application context (no HTTP server)
   */
  app: INestApplicationContext;

  /**
   * Gracefully shut down the application and release resources
   */
  close: () => Promise<void>;
}

/**
 * Discriminated union of all bootstrap results
 * TypeScript will enforce mode-specific result types at compile time
 */
export type BootstrapResult = ServerBootstrapResult | ContextBootstrapResult;

/**
 * Error codes for bootstrap failures
 */
export const BootstrapErrorCodes = {
  INVALID_CONTAINER: 'INVALID_CONTAINER',
  INVALID_OPTIONS: 'INVALID_OPTIONS',
  INITIALIZATION_FAILED: 'INITIALIZATION_FAILED',
  PORT_IN_USE: 'PORT_IN_USE',
  SHUTDOWN_FAILED: 'SHUTDOWN_FAILED',
} as const;

export type BootstrapErrorCode =
  (typeof BootstrapErrorCodes)[keyof typeof BootstrapErrorCodes];

/**
 * Custom error class for bootstrap failures
 */
export class BootstrapError extends Error {
  constructor(
    message: string,
    public readonly code: BootstrapErrorCode,
    public readonly cause?: Error
  ) {
    super(message);
    this.name = 'BootstrapError';

    // Maintain proper stack trace for where our error was thrown (only available on V8)
    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, BootstrapError);
    }
  }
}

/**
 * Type guard to check if bootstrap options are for server mode
 */
export function isServerBootstrapOptions(
  options: BootstrapOptions
): options is ServerBootstrapOptions {
  return options.mode === 'server';
}

/**
 * Type guard to check if bootstrap options are for context mode
 */
export function isContextBootstrapOptions(
  options: BootstrapOptions
): options is ContextBootstrapOptions {
  return options.mode === 'context';
}

/**
 * Type guard to check if bootstrap result is from server mode
 */
export function isServerBootstrapResult(
  result: BootstrapResult
): result is ServerBootstrapResult {
  return result.mode === 'server';
}

/**
 * Type guard to check if bootstrap result is from context mode
 */
export function isContextBootstrapResult(
  result: BootstrapResult
): result is ContextBootstrapResult {
  return result.mode === 'context';
}
