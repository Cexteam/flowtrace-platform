import * as winston from 'winston';
import * as path from 'path';
import * as fs from 'fs';

// Get log level from environment with fallback (avoid env validation at import time)
const LOG_LEVEL = process.env.LOG_LEVEL || 'info';
const NODE_ENV = process.env.NODE_ENV || 'development';

/**
 * Get the appropriate log directory based on environment
 * Uses LOG_DIR env var if set, otherwise defaults to 'logs' directory
 */
function getLogDirectory(): string {
  // Use LOG_DIR env var if set
  if (process.env.LOG_DIR) {
    return process.env.LOG_DIR;
  }

  // Default: use relative logs directory
  return 'logs';
}

/**
 * Ensure log directory exists
 */
function ensureLogDirectory(logDir: string): boolean {
  try {
    if (!fs.existsSync(logDir)) {
      fs.mkdirSync(logDir, { recursive: true });
    }
    return true;
  } catch {
    // Can't create directory, disable file logging
    return false;
  }
}

const logDir = getLogDirectory();
const canWriteLogs = ensureLogDirectory(logDir);
const logFilePath = path.join(logDir, 'service.log');

const logFormat = winston.format.combine(
  winston.format.timestamp(),
  winston.format.errors({ stack: true }),
  winston.format.json(),
  winston.format.printf(({ timestamp, level, message, ...meta }) => {
    return JSON.stringify({
      timestamp,
      level,
      message,
      ...meta,
    });
  })
);

// Console transport for development
const consoleTransport = new winston.transports.Console({
  level: LOG_LEVEL,
  format: winston.format.combine(
    winston.format.colorize(),
    winston.format.simple()
  ),
});

// File transport for production (only if we can write logs)
const fileTransport = new winston.transports.File({
  filename: logFilePath,
  level: 'error',
  format: logFormat,
  silent: !canWriteLogs || NODE_ENV !== 'production',
});

export const logger = winston.createLogger({
  level: LOG_LEVEL,
  format: logFormat,
  transports: [consoleTransport, fileTransport],
});

// Add helper methods for structured logging
export class LoggerService {
  private context: string;

  constructor(context: string) {
    this.context = context;
  }

  info(message: string, meta?: any) {
    logger.info(message, { ...meta, context: this.context });
  }

  error(message: string, error?: any, meta?: any) {
    logger.error(message, {
      ...meta,
      error: error?.message || error,
      context: this.context,
    });
  }

  warn(message: string, meta?: any) {
    logger.warn(message, { ...meta, context: this.context });
  }

  debug(message: string, meta?: any) {
    logger.debug(message, { ...meta, context: this.context });
  }

  // Binance-specific logging
  binance(event: string, symbol?: string, data?: any) {
    this.info(`Binance ${event}`, { symbol, data });
  }

  // Trades logging
  trade(symbol: string, count: number, timeframe?: string) {
    this.debug(`Processed ${count} trades for ${symbol}`, { count, timeframe });
  }

  // Connection logging
  connection(event: string, details?: any) {
    this.info(`WebSocket ${event}`, details);
  }

  // Performance logging
  performance(operation: string, duration: number, meta?: any) {
    this.info(`Performance: ${operation} took ${duration}ms`, {
      operation,
      duration,
      ...meta,
    });
  }
}

// Factory function to create logger instances
export function createLogger(context: string): LoggerService {
  return new LoggerService(context);
}
