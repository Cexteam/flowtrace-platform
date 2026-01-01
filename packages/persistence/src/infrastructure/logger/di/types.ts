/**
 * Logger DI Types
 * Separated to avoid circular dependencies.
 */

export const LOGGER_TYPES = {
  Logger: Symbol.for('Logger'),
} as const;

export interface Logger {
  info(message: string, ...args: unknown[]): void;
  warn(message: string, ...args: unknown[]): void;
  error(message: string, ...args: unknown[]): void;
  debug(message: string, ...args: unknown[]): void;
}
