// Sentry Configuration for DealershipAI Production Error Tracking

import * as Sentry from '@sentry/nextjs';
import { BrowserTracing } from '@sentry/tracing';

// Environment configuration
const SENTRY_DSN = process.env.SENTRY_DSN || '';
const ENVIRONMENT = process.env.NODE_ENV || 'development';
const RELEASE = process.env.VERCEL_GIT_COMMIT_SHA || 'development';

// User context for error tracking
export interface UserContext {
  id: string;
  email?: string;
  role: 'admin' | 'dealer' | 'user';
  dealershipId?: string;
}

// Custom error tags for better categorization
export const ErrorTags = {
  API_ERROR: 'api_error',
  AUTH_ERROR: 'auth_error',
  DATABASE_ERROR: 'database_error',
  AI_ERROR: 'ai_service_error',
  UI_ERROR: 'ui_error',
  INTEGRATION_ERROR: 'integration_error'
} as const;

// Initialize Sentry
export function initSentry() {
  Sentry.init({
    dsn: SENTRY_DSN,
    environment: ENVIRONMENT,
    release: RELEASE,

    // Performance monitoring
    integrations: [
      new BrowserTracing({
        tracingOrigins: [
          'localhost',
          /^https:\/\/.*\.dealershipai\.com/,
          /^https:\/\/dealershipai\.com/
        ],
        routingInstrumentation: Sentry.nextRouterInstrumentation
      })
    ],

    // Performance sampling
    tracesSampleRate: ENVIRONMENT === 'production' ? 0.1 : 1.0,

    // Error sampling
    sampleRate: 1.0,

    // Capture unhandled promise rejections
    captureUnhandledRejections: true,

    // Filter out non-critical errors
    beforeSend(event) {
      // Filter out known non-critical errors
      if (event.exception) {
        const error = event.exception.values?.[0];
        if (error?.type === 'ChunkLoadError' ||
            error?.type === 'ResizeObserver loop limit exceeded') {
          return null;
        }
      }

      // Filter out localhost and development URLs in production
      if (ENVIRONMENT === 'production' && event.request?.url?.includes('localhost')) {
        return null;
      }

      return event;
    },

    // Additional configuration for Next.js
    tunnel: ENVIRONMENT === 'production' ? '/api/monitoring/sentry-tunnel' : undefined,
    debug: ENVIRONMENT === 'development'
  });
}

// Set user context for error tracking
export function setSentryUser(user: UserContext) {
  Sentry.setUser({
    id: user.id,
    email: user.email,
    role: user.role,
    dealershipId: user.dealershipId
  });

  Sentry.setTag('user.role', user.role);
  if (user.dealershipId) {
    Sentry.setTag('dealership.id', user.dealershipId);
  }
}

// Clear user context on logout
export function clearSentryUser() {
  Sentry.setUser(null);
}

// Custom error reporting with context
export function reportError(
  error: Error,
  context: {
    tag?: keyof typeof ErrorTags;
    level?: 'error' | 'warning' | 'info';
    extra?: Record<string, any>;
    user?: UserContext;
  } = {}
) {
  const { tag, level = 'error', extra, user } = context;

  Sentry.withScope(scope => {
    // Set error level
    scope.setLevel(level);

    // Set error tag
    if (tag) {
      scope.setTag('error_category', ErrorTags[tag]);
    }

    // Add extra context
    if (extra) {
      Object.entries(extra).forEach(([key, value]) => {
        scope.setExtra(key, value);
      });
    }

    // Set user context if provided
    if (user) {
      setSentryUser(user);
    }

    Sentry.captureException(error);
  });
}

// Performance monitoring for API calls
export function startTransaction(name: string, op: string = 'http') {
  return Sentry.startTransaction({
    name,
    op,
    tags: {
      'component': 'api'
    }
  });
}

// Monitor database operations
export function monitorDatabaseOperation<T>(
  operationName: string,
  operation: () => Promise<T>
): Promise<T> {
  const transaction = startTransaction(`db.${operationName}`, 'db');

  return operation()
    .then(result => {
      transaction.setStatus('ok');
      transaction.finish();
      return result;
    })
    .catch(error => {
      transaction.setStatus('internal_error');
      transaction.finish();

      reportError(error, {
        tag: 'DATABASE_ERROR',
        extra: {
          operation: operationName,
          timestamp: new Date().toISOString()
        }
      });

      throw error;
    });
}

// Monitor AI service calls
export function monitorAIOperation<T>(
  provider: string,
  operation: () => Promise<T>
): Promise<T> {
  const transaction = startTransaction(`ai.${provider}`, 'ai');

  return operation()
    .then(result => {
      transaction.setStatus('ok');
      transaction.finish();
      return result;
    })
    .catch(error => {
      transaction.setStatus('internal_error');
      transaction.finish();

      reportError(error, {
        tag: 'AI_ERROR',
        extra: {
          provider,
          timestamp: new Date().toISOString()
        }
      });

      throw error;
    });
}

// Health check monitoring
export function reportHealthCheckStatus(
  service: string,
  status: 'healthy' | 'unhealthy',
  details?: Record<string, any>
) {
  if (status === 'unhealthy') {
    Sentry.withScope(scope => {
      scope.setTag('service', service);
      scope.setLevel('error');

      if (details) {
        Object.entries(details).forEach(([key, value]) => {
          scope.setExtra(key, value);
        });
      }

      Sentry.captureMessage(`Health check failed: ${service}`, 'error');
    });
  }
}

export default Sentry;