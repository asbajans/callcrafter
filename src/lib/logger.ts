const LOG_LEVELS = {
  debug: 0,
  info: 1,
  warn: 2,
  error: 3,
} as const;

type LogLevel = keyof typeof LOG_LEVELS;

interface LogEntry {
  timestamp: string;
  level: LogLevel;
  message: string;
  service: string;
  metadata?: Record<string, unknown>;
  error?: Error;
}

class Logger {
  private service: string;
  private minLevel: number;

  constructor(service: string) {
    this.service = service;
    this.minLevel = LOG_LEVELS[(process.env.LOG_LEVEL as LogLevel) || 'info'] ?? LOG_LEVELS.info;
  }

  private shouldLog(level: LogLevel): boolean {
    return LOG_LEVELS[level] >= this.minLevel;
  }

  private formatEntry(level: LogLevel, message: string, metadata?: Record<string, unknown>): LogEntry {
    return {
      timestamp: new Date().toISOString(),
      level,
      message,
      service: this.service,
      metadata,
    };
  }

  debug(message: string, metadata?: Record<string, unknown>) {
    if (!this.shouldLog('debug')) return;
    const entry = this.formatEntry('debug', message, metadata);
    if (process.env.NODE_ENV === 'development') {
      console.debug(`[${entry.timestamp}] [DEBUG] [${entry.service}] ${entry.message}`, entry.metadata || '');
    } else {
      console.log(JSON.stringify(entry));
    }
  }

  info(message: string, metadata?: Record<string, unknown>) {
    if (!this.shouldLog('info')) return;
    const entry = this.formatEntry('info', message, metadata);
    if (process.env.NODE_ENV === 'development') {
      console.log(`[${entry.timestamp}] [INFO] [${entry.service}] ${entry.message}`, entry.metadata || '');
    } else {
      console.log(JSON.stringify(entry));
    }
  }

  warn(message: string, metadata?: Record<string, unknown>) {
    if (!this.shouldLog('warn')) return;
    const entry = this.formatEntry('warn', message, metadata);
    if (process.env.NODE_ENV === 'development') {
      console.warn(`[${entry.timestamp}] [WARN] [${entry.service}] ${entry.message}`, entry.metadata || '');
    } else {
      console.warn(JSON.stringify(entry));
    }
  }

  error(message: string, error?: Error, metadata?: Record<string, unknown>) {
    if (!this.shouldLog('error')) return;
    const entry = {
      ...this.formatEntry('error', message, metadata),
      error: error ? {
        name: error.name,
        message: error.message,
        stack: process.env.NODE_ENV === 'development' ? error.stack : undefined,
      } : undefined,
    };
    if (process.env.NODE_ENV === 'development') {
      console.error(`[${entry.timestamp}] [ERROR] [${entry.service}] ${entry.message}`, error || '', entry.metadata || '');
    } else {
      console.error(JSON.stringify(entry));
    }
  }
}

// Create service-specific loggers
export const appLogger = new Logger('callcrafter-app');
export const wsLogger = new Logger('callcrafter-ws');
export const aiLogger = new Logger('callcrafter-ai');
export const billingLogger = new Logger('callcrafter-billing');

export default Logger;
