/**
 * Logging utility for consistent logging across the application
 * Automatically filters out debug logs in production
 */

type LogLevel = 'debug' | 'info' | 'warn' | 'error';

const isDevelopment = import.meta.env.DEV;

/**
 * Log a debug message (only in development)
 */
export const debug = (...args: unknown[]): void => {
  if (isDevelopment) {
    console.log('[DEBUG]', ...args);
  }
};

/**
 * Log an info message (only in development)
 */
export const info = (...args: unknown[]): void => {
  if (isDevelopment) {
    console.info('[INFO]', ...args);
  }
};

/**
 * Log a warning message
 */
export const warn = (...args: unknown[]): void => {
  console.warn('[WARN]', ...args);
};

/**
 * Log an error message
 */
export const error = (...args: unknown[]): void => {
  console.error('[ERROR]', ...args);
};

/**
 * Generic log function with level
 */
export const log = (level: LogLevel, ...args: unknown[]): void => {
  switch (level) {
    case 'debug':
      debug(...args);
      break;
    case 'info':
      info(...args);
      break;
    case 'warn':
      warn(...args);
      break;
    case 'error':
      error(...args);
      break;
  }
};

export const logger = {
  debug,
  info,
  warn,
  error,
  log,
};
