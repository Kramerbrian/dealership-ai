import pino, { Logger } from 'pino';

const isProduction = process.env.NODE_ENV === 'production';
const isDevelopment = process.env.NODE_ENV === 'development';

// Create base logger configuration
const loggerConfig = {
  level: process.env.LOG_LEVEL || (isDevelopment ? 'debug' : 'info'),

  // Use pino-pretty for development, structured JSON for production
  transport: isDevelopment ? {
    target: 'pino-pretty',
    options: {
      colorize: true,
      translateTime: 'HH:MM:ss Z',
      ignore: 'pid,hostname',
    },
  } : undefined,

  // Add custom serializers
  serializers: {
    error: pino.stdSerializers.err,
    req: pino.stdSerializers.req,
    res: pino.stdSerializers.res,
  },

  // Base context for all logs
  base: {
    service: 'dealershipai-web',
    environment: process.env.NODE_ENV,
    version: process.env.VERCEL_GIT_COMMIT_SHA || 'dev',
  },

  // Custom formatters for production
  formatters: isProduction ? {
    level(label: string) {
      return { level: label };
    },
    bindings(bindings: any) {
      return {
        pid: bindings.pid,
        hostname: bindings.hostname,
        service: bindings.service,
        environment: bindings.environment,
        version: bindings.version,
      };
    },
  } : {},
};

// Create the main logger instance
export const logger: Logger = pino(loggerConfig);

// Specialized loggers for different components
export const apiLogger = logger.child({ component: 'api' });
export const authLogger = logger.child({ component: 'auth' });
export const dbLogger = logger.child({ component: 'database' });
export const aiLogger = logger.child({ component: 'ai' });
export const integrationLogger = logger.child({ component: 'integrations' });

// Performance logging utilities
export class PerformanceLogger {
  private startTime: number;
  private logger: Logger;
  private context: Record<string, any>;

  constructor(logger: Logger, context: Record<string, any> = {}) {
    this.startTime = Date.now();
    this.logger = logger;
    this.context = context;
  }

  end(additionalContext: Record<string, any> = {}) {
    const duration = Date.now() - this.startTime;

    this.logger.info({
      ...this.context,
      ...additionalContext,
      duration,
      performance: true,
    }, 'Operation completed');

    return duration;
  }

  static start(logger: Logger, context: Record<string, any> = {}) {
    return new PerformanceLogger(logger, context);
  }
}

// Error logging with Sentry integration
export const logError = (error: Error, context: Record<string, any> = {}, logger_instance: Logger = logger) => {
  const errorInfo = {
    error: {
      message: error.message,
      name: error.name,
      stack: error.stack,
    },
    ...context,
  };

  logger_instance.error(errorInfo, 'Error occurred');

  // Send to Sentry if available
  if (typeof window !== 'undefined' && (window as any).Sentry) {
    (window as any).Sentry.captureException(error, {
      contexts: {
        dealershipai: context,
      },
    });
  } else if (typeof global !== 'undefined' && (global as any).Sentry) {
    (global as any).Sentry.captureException(error, {
      contexts: {
        dealershipai: context,
      },
    });
  }
};

// Business metrics logging
export const logBusinessMetric = (metric: string, value: number, context: Record<string, any> = {}) => {
  logger.info({
    metric,
    value,
    timestamp: new Date().toISOString(),
    ...context,
    business_metric: true,
  }, `Business metric: ${metric}`);
};

// API request/response logging middleware
export const createAPILogger = (endpoint: string) => {
  return {
    logRequest: (req: any, context: Record<string, any> = {}) => {
      apiLogger.info({
        endpoint,
        method: req.method,
        url: req.url,
        userAgent: req.headers['user-agent'],
        ip: req.headers['x-forwarded-for'] || req.connection?.remoteAddress,
        ...context,
      }, `API request: ${req.method} ${endpoint}`);
    },

    logResponse: (statusCode: number, duration: number, context: Record<string, any> = {}) => {
      const logLevel = statusCode >= 400 ? 'warn' : statusCode >= 500 ? 'error' : 'info';

      apiLogger[logLevel]({
        endpoint,
        statusCode,
        duration,
        ...context,
      }, `API response: ${statusCode} (${duration}ms)`);
    },

    logError: (error: Error, context: Record<string, any> = {}) => {
      logError(error, { endpoint, ...context }, apiLogger);
    },
  };
};

// Database operation logging
export const logDatabaseOperation = (
  operation: string,
  table: string,
  duration: number,
  context: Record<string, any> = {}
) => {
  dbLogger.info({
    operation,
    table,
    duration,
    ...context,
    database_operation: true,
  }, `Database operation: ${operation} on ${table} (${duration}ms)`);
};

// AI provider logging
export const logAIOperation = (
  provider: string,
  model: string,
  tokens: { prompt?: number; completion?: number; total?: number },
  cost: number,
  duration: number,
  context: Record<string, any> = {}
) => {
  aiLogger.info({
    provider,
    model,
    tokens,
    cost,
    duration,
    ...context,
    ai_operation: true,
  }, `AI operation: ${provider}/${model} (${duration}ms, $${cost.toFixed(4)})`);
};

// Security event logging
export const logSecurityEvent = (
  event: string,
  severity: 'low' | 'medium' | 'high' | 'critical',
  context: Record<string, any> = {}
) => {
  const logLevel = severity === 'critical' || severity === 'high' ? 'error' : 'warn';

  logger[logLevel]({
    event,
    severity,
    timestamp: new Date().toISOString(),
    ...context,
    security_event: true,
  }, `Security event: ${event} (${severity})`);

  // Send high/critical security events to Sentry immediately
  if ((severity === 'high' || severity === 'critical') && typeof global !== 'undefined' && (global as any).Sentry) {
    (global as any).Sentry.captureMessage(`Security event: ${event}`, severity === 'critical' ? 'error' : 'warning', {
      contexts: {
        security: { severity, event, ...context },
      },
    });
  }
};

// Health check logging
export const logHealthCheck = (
  service: string,
  status: 'healthy' | 'unhealthy' | 'degraded',
  responseTime: number,
  details: Record<string, any> = {}
) => {
  const logLevel = status === 'healthy' ? 'info' : status === 'degraded' ? 'warn' : 'error';

  logger[logLevel]({
    service,
    status,
    responseTime,
    ...details,
    health_check: true,
  }, `Health check: ${service} is ${status} (${responseTime}ms)`);
};

export default logger;