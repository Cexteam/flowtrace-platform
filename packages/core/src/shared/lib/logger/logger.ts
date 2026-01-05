import * as winston from 'winston';
import * as path from 'path';
import * as fs from 'fs';

/**
 * Get the appropriate log directory based on environment
 * Uses LOG_DIR env var if set, otherwise defaults to 'logs' directory
 *
 * NOTE: This is called lazily to support late LOG_DIR configuration
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

/**
 * Create log format
 */
function createLogFormat() {
  return winston.format.combine(
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
}

// Lazy-initialized logger instance
let _logger: winston.Logger | null = null;
let _currentLogDir: string | null = null;

/**
 * Get or create the winston logger instance
 *
 * Supports lazy initialization to allow LOG_DIR to be set after module import.
 * If LOG_DIR changes, the file transport will be reconfigured.
 */
function getLogger(): winston.Logger {
  const LOG_LEVEL = process.env.LOG_LEVEL || 'info';
  const ENABLE_FILE_LOG = process.env.ENABLE_FILE_LOG !== 'false';
  const logDir = getLogDirectory();

  // Create logger if not exists or if LOG_DIR changed
  if (!_logger || _currentLogDir !== logDir) {
    const canWriteLogs = ensureLogDirectory(logDir);
    const logFilePath = path.join(logDir, 'service.log');
    const logFormat = createLogFormat();

    // Console transport
    const consoleTransport = new winston.transports.Console({
      level: LOG_LEVEL,
      format: winston.format.combine(
        winston.format.colorize(),
        winston.format.simple()
      ),
    });

    // File transport - enabled by default for debugging
    const fileTransport = new winston.transports.File({
      filename: logFilePath,
      level: LOG_LEVEL,
      format: logFormat,
      silent: !canWriteLogs || !ENABLE_FILE_LOG,
    });

    // If logger exists but LOG_DIR changed, close old transports
    if (_logger && _currentLogDir !== logDir) {
      _logger.close();
    }

    _logger = winston.createLogger({
      level: LOG_LEVEL,
      format: logFormat,
      transports: [consoleTransport, fileTransport],
    });

    _currentLogDir = logDir;
  }

  return _logger;
}

// Export a proxy that delegates to the lazy-initialized logger
export const logger = {
  info: (message: string, meta?: any) => getLogger().info(message, meta),
  error: (message: string, meta?: any) => getLogger().error(message, meta),
  warn: (message: string, meta?: any) => getLogger().warn(message, meta),
  debug: (message: string, meta?: any) => getLogger().debug(message, meta),
};

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
