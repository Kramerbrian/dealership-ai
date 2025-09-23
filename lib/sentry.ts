// Sentry error monitoring and performance tracking
import { createLogger } from './logger'

const logger = createLogger('sentry')

interface SentryConfig {
  dsn?: string
  environment: string
  enabled: boolean
  sampleRate: number
}

interface ErrorContext {
  user?: {
    id: string
    email?: string
    dealerId?: string
  }
  request?: {
    method: string
    url: string
    headers?: Record<string, string>
  }
  extra?: Record<string, any>
}

class SentryService {
  private config: SentryConfig
  private initialized = false

  constructor() {
    this.config = {
      dsn: process.env.SENTRY_DSN,
      environment: process.env.NODE_ENV || 'development',
      enabled: !!process.env.SENTRY_DSN && process.env.NODE_ENV === 'production',
      sampleRate: parseFloat(process.env.SENTRY_SAMPLE_RATE || '1.0')
    }
  }

  async init() {
    if (this.initialized || !this.config.enabled) return

    try {
      // Dynamic import to avoid issues if Sentry is not installed
      const Sentry = await import('@sentry/nextjs')

      Sentry.init({
        dsn: this.config.dsn,
        environment: this.config.environment,
        tracesSampleRate: this.config.sampleRate,

        beforeSend: (event, hint) => {
          // Filter out known non-critical errors
          if (this.shouldIgnoreError(event.exception)) {
            return null
          }
          return event
        },

        integrations: [
          // Add performance monitoring
          new Sentry.BrowserTracing({
            tracePropagationTargets: ['localhost', /^https:\/\/[^\/]*\.vercel\.app\/api/],
          }),
        ],
      })

      this.initialized = true
      logger.info('Sentry initialized successfully')
    } catch (error) {
      logger.warn({ error }, 'Failed to initialize Sentry')
    }
  }

  private shouldIgnoreError(exception?: any): boolean {
    if (!exception) return false

    const message = exception.values?.[0]?.value || ''

    // Ignore common non-critical errors
    const ignoredErrors = [
      'Network request failed',
      'ResizeObserver loop limit exceeded',
      'Non-Error promise rejection captured',
      'ChunkLoadError'
    ]

    return ignoredErrors.some(ignored => message.includes(ignored))
  }

  captureError(error: Error, context?: ErrorContext) {
    if (!this.config.enabled) {
      logger.error({ error, context }, 'Error captured (Sentry disabled)')
      return
    }

    import('@sentry/nextjs').then(Sentry => {
      Sentry.withScope((scope) => {
        if (context?.user) {
          scope.setUser(context.user)
        }

        if (context?.request) {
          scope.setContext('request', context.request)
        }

        if (context?.extra) {
          Object.entries(context.extra).forEach(([key, value]) => {
            scope.setExtra(key, value)
          })
        }

        scope.setTag('component', 'dealership-ai')
        Sentry.captureException(error)
      })
    }).catch(() => {
      logger.error({ error, context }, 'Failed to send error to Sentry')
    })
  }

  captureMessage(message: string, level: 'info' | 'warning' | 'error' = 'info', context?: ErrorContext) {
    if (!this.config.enabled) {
      logger[level]({ message, context }, 'Message captured (Sentry disabled)')
      return
    }

    import('@sentry/nextjs').then(Sentry => {
      Sentry.withScope((scope) => {
        if (context?.user) {
          scope.setUser(context.user)
        }

        if (context?.extra) {
          Object.entries(context.extra).forEach(([key, value]) => {
            scope.setExtra(key, value)
          })
        }

        scope.setTag('component', 'dealership-ai')
        Sentry.captureMessage(message, level)
      })
    }).catch(() => {
      logger[level]({ message, context }, 'Failed to send message to Sentry')
    })
  }

  // Performance monitoring
  startTransaction(name: string, operation: string) {
    if (!this.config.enabled) return null

    return import('@sentry/nextjs').then(Sentry => {
      return Sentry.startTransaction({
        name,
        op: operation,
        tags: { component: 'dealership-ai' }
      })
    }).catch(() => null)
  }

  // API route error handler
  withSentryAPI<T extends any[], R>(
    handler: (...args: T) => Promise<R>,
    options: { operation: string; name?: string }
  ) {
    return async (...args: T): Promise<R> => {
      const transaction = await this.startTransaction(
        options.name || 'api-handler',
        options.operation
      )

      try {
        const result = await handler(...args)
        transaction?.setStatus('ok')
        return result
      } catch (error) {
        transaction?.setStatus('internal_error')

        if (error instanceof Error) {
          this.captureError(error, {
            extra: {
              operation: options.operation,
              handler: options.name
            }
          })
        }

        throw error
      } finally {
        transaction?.finish()
      }
    }
  }

  // Add breadcrumbs for debugging
  addBreadcrumb(message: string, category: string, data?: Record<string, any>) {
    if (!this.config.enabled) return

    import('@sentry/nextjs').then(Sentry => {
      Sentry.addBreadcrumb({
        message,
        category,
        data,
        level: 'info',
        timestamp: Date.now() / 1000,
      })
    }).catch(() => {
      logger.debug({ message, category, data }, 'Failed to add breadcrumb to Sentry')
    })
  }
}

export const sentry = new SentryService()

// Initialize Sentry on import
sentry.init()

// Error boundary helpers
export const withErrorBoundary = <P extends object>(
  Component: React.ComponentType<P>,
  fallback?: React.ComponentType<{ error: Error; resetError: () => void }>
) => {
  return (props: P) => {
    // This would be implemented with a proper error boundary component
    // For now, return the component as-is
    return React.createElement(Component, props)
  }
}

// Hook for error reporting in React components
export const useErrorReporting = () => {
  return {
    reportError: (error: Error, context?: ErrorContext) => {
      sentry.captureError(error, context)
    },
    reportMessage: (message: string, level: 'info' | 'warning' | 'error' = 'info') => {
      sentry.captureMessage(message, level)
    }
  }
}