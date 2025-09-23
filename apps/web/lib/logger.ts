type LogLevel = 'debug' | 'info' | 'warn' | 'error';

interface LogEntry {
  level: LogLevel;
  message: string;
  timestamp: string;
  context?: Record<string, any>;
  error?: Error;
}

class Logger {
  private level: LogLevel;
  private format: 'json' | 'text';

  constructor() {
    this.level = (process.env.LOG_LEVEL as LogLevel) || 'info';
    this.format = (process.env.LOG_FORMAT as 'json' | 'text') || 'json';
  }

  private shouldLog(level: LogLevel): boolean {
    const levels = ['debug', 'info', 'warn', 'error'];
    return levels.indexOf(level) >= levels.indexOf(this.level);
  }

  private formatLog(entry: LogEntry): string {
    if (this.format === 'json') {
      return JSON.stringify({
        ...entry,
        error: entry.error ? {
          name: entry.error.name,
          message: entry.error.message,
          stack: entry.error.stack,
        } : undefined,
      });
    }

    const prefix = `[${entry.timestamp}] ${entry.level.toUpperCase()}`;
    const context = entry.context ? ` ${JSON.stringify(entry.context)}` : '';
    const error = entry.error ? `\n${entry.error.stack}` : '';
    return `${prefix}: ${entry.message}${context}${error}`;
  }

  private log(level: LogLevel, message: string, context?: Record<string, any>, error?: Error) {
    if (!this.shouldLog(level)) return;

    const entry: LogEntry = {
      level,
      message,
      timestamp: new Date().toISOString(),
      context,
      error,
    };

    const formatted = this.formatLog(entry);

    // In production, you might want to send to external logging service
    if (level === 'error') {
      console.error(formatted);
    } else if (level === 'warn') {
      console.warn(formatted);
    } else {
      console.log(formatted);
    }
  }

  debug(message: string, context?: Record<string, any>) {
    this.log('debug', message, context);
  }

  info(message: string, context?: Record<string, any>) {
    this.log('info', message, context);
  }

  warn(message: string, context?: Record<string, any>) {
    this.log('warn', message, context);
  }

  error(message: string, error?: Error, context?: Record<string, any>) {
    this.log('error', message, context, error);
  }

  // Convenience methods for specific use cases
  apiRequest(method: string, path: string, status: number, duration: number) {
    this.info('API Request', {
      method,
      path,
      status,
      duration_ms: duration,
    });
  }

  queueJob(jobId: string, type: string, status: 'started' | 'completed' | 'failed', duration?: number) {
    const context = { jobId, type, ...(duration && { duration_ms: duration }) };

    if (status === 'failed') {
      this.error(`Queue job ${status}`, undefined, context);
    } else {
      this.info(`Queue job ${status}`, context);
    }
  }

  costAlert(amount: number, threshold: number, period: string) {
    this.warn('Cost threshold exceeded', {
      amount,
      threshold,
      period,
      excess: amount - threshold,
    });
  }
}

export const logger = new Logger();
export default logger;

// Function to create a namespaced logger
export function createLogger(namespace: string): Logger {
  const namespaceLogger = new Logger();

  // Override the log method to include namespace
  const originalLog = namespaceLogger['log'];
  namespaceLogger['log'] = function(level: LogLevel, message: string, context?: Record<string, any>, error?: Error) {
    const namespacedMessage = `[${namespace}] ${message}`;
    return originalLog.call(this, level, namespacedMessage, context, error);
  };

  return namespaceLogger;
}